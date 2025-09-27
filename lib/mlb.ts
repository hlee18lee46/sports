export const MLB_BASE = "https://statsapi.mlb.com/api/v1";

export interface LinescoreTeamSide {
  team?: { name?: string };
  runs?: number;
  hits?: number;
  errors?: number;
}
export interface Linescore {
  currentInning?: number | null;
  currentInningOrdinal?: string | null;
  inningState?: string | null;
  outs?: number | null;
  balls?: number | null;
  strikes?: number | null;
  teams?: { home?: LinescoreTeamSide; away?: LinescoreTeamSide };
  offense?: { first?: unknown; second?: unknown; third?: unknown };
}
export interface ScheduleGame {
  gamePk: number;
  gameDate?: string;
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return (await r.json()) as T;
}

export async function getSchedule(dateISO: string) {
  const u = new URL(`${MLB_BASE}/schedule`);
  u.searchParams.set("sportId", "1");
  u.searchParams.set("date", dateISO);
  return getJSON<{ dates: Array<{ games: ScheduleGame[] }> }>(u.toString());
}

export async function getLinescore(gamePk: number) {
  return getJSON<Linescore>(`${MLB_BASE}/game/${gamePk}/linescore`);
}

export async function getBoxscore(gamePk: number) {
  return getJSON<{ teams?: { home?: { team?: { name?: string } }; away?: { team?: { name?: string } } } }>(
    `${MLB_BASE}/game/${gamePk}/boxscore`
  );
}
