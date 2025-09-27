// app/api/games/live/route.ts
export const runtime = "nodejs";

const BASE = "https://statsapi.mlb.com/api/v1";

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

// YYYY-MM-DD (defaults to today in ET)
function todayET(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value!;
  const m = parts.find(p => p.type === "month")?.value!;
  const d = parts.find(p => p.type === "day")?.value!;
  return `${y}-${m}-${d}`;
}

async function getSchedule(isoDate: string) {
  const u = new URL(`${BASE}/schedule`);
  u.searchParams.set("sportId", "1");        // MLB
  u.searchParams.set("date", isoDate);
  return getJSON(u.toString());
}

async function getLinescore(gamePk: number) {
  return getJSON(`${BASE}/game/${gamePk}/linescore`);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayET();

    const sched = await getSchedule(date);
    const games = (sched?.dates?.[0]?.games ?? []) as any[];

    // Only games that are currently live
    const liveGames = games.filter(
      g => g?.status?.abstractGameState === "Live"
    );

    // Enrich with quick linescore (runs + inning)
    const enriched = await Promise.all(
      liveGames.map(async (g) => {
        const gamePk = Number(g.gamePk);
        let ls: any = null;
        try {
          ls = await getLinescore(gamePk);
        } catch {
          // ignore linescore fetch errors; still return schedule data
        }
        const home = g?.teams?.home?.team?.name ?? "Home";
        const away = g?.teams?.away?.team?.name ?? "Away";
        const start = g?.gameDate;

        const homeRuns = ls?.teams?.home?.runs ?? g?.linescore?.teams?.home?.runs ?? null;
        const awayRuns = ls?.teams?.away?.runs ?? g?.linescore?.teams?.away?.runs ?? null;

        const inning = ls?.currentInning ?? g?.linescore?.currentInning ?? null;
        const desc = (ls?.inningState || ls?.currentInningOrdinal)
          ? `${ls?.inningState ?? ""} ${ls?.currentInningOrdinal ?? ""}`.trim()
          : g?.status?.detailedState ?? "Live";

        return {
          gamePk,
          status: g?.status?.detailedState ?? "Live",
          startTimeUTC: start,
          venue: g?.venue?.name ?? null,
          awayTeam: away,
          homeTeam: home,
          score: {
            away: awayRuns,
            home: homeRuns,
          },
          inning,
          inningDesc: desc,
        };
      })
    );

    return new Response(JSON.stringify({
      date,
      count: enriched.length,
      games: enriched,
    }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502 });
  }
}