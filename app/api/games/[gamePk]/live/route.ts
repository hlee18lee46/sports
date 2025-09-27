// app/api/games/[gamePk]/live/route.ts
export const runtime = "nodejs";

const BASE = "https://statsapi.mlb.com/api/v1";

async function getJSON(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function getLinescore(gamePk: number) {
  return getJSON(`${BASE}/game/${gamePk}/linescore`);
}

async function getBoxscore(gamePk: number) {
  return getJSON(`${BASE}/game/${gamePk}/boxscore`);
}

function safeTeamNameFromLineSide(side: any): string | undefined {
  return side?.team?.name;
}

async function getTeamNames(gamePk: number, ls: any) {
  const homeSide = ls?.teams?.home ?? {};
  const awaySide = ls?.teams?.away ?? {};
  let home = safeTeamNameFromLineSide(homeSide);
  let away = safeTeamNameFromLineSide(awaySide);

  if (!home || !away) {
    const box = await getBoxscore(gamePk);
    home = home ?? box?.teams?.home?.team?.name;
    away = away ?? box?.teams?.away?.team?.name;
  }
  return { home: home ?? "Home", away: away ?? "Away" };
}

function sideRHE(side: any) {
  return { R: side?.runs ?? 0, H: side?.hits ?? 0, E: side?.errors ?? 0 };
}

export async function GET(
  _req: Request,
  { params }: { params: { gamePk: string } }
) {
  try {
    const gamePk = Number(params.gamePk);
    if (!Number.isFinite(gamePk)) {
      return new Response(JSON.stringify({ error: "invalid gamePk" }), { status: 400 });
    }

    const ls = await getLinescore(gamePk);
    const { home, away } = await getTeamNames(gamePk, ls);

    const homeSide = ls?.teams?.home ?? {};
    const awaySide = ls?.teams?.away ?? {};

    const offense = ls?.offense ?? {};
    const bases = {
      "1B": Boolean(offense?.first),
      "2B": Boolean(offense?.second),
      "3B": Boolean(offense?.third),
    };

    const payload = {
      gamePk,
      inning: ls?.currentInning ?? null,
      inning_desc:
        (ls?.inningState || ls?.currentInningOrdinal)
          ? `${ls?.inningState ?? ""} ${ls?.currentInningOrdinal ?? ""}`.trim()
          : "—",
      outs: ls?.outs ?? 0,
      away_team: away,
      home_team: home,
      away_RHE: sideRHE(awaySide),
      home_RHE: sideRHE(homeSide),
      balls: ls?.balls ?? null,
      strikes: ls?.strikes ?? null,
      bases,
      updatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502 });
  }
}