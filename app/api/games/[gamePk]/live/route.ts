// app/api/mlb/[gamePk]/route.ts
export const runtime = "nodejs";     // stable for fetch & Node libs
export const revalidate = 0;          // no caching (always live)
export const dynamic = "force-dynamic";

const BASE = "https://statsapi.mlb.com/api/v1";

async function getLinescore(gamePk: number) {
  const res = await fetch(`${BASE}/game/${gamePk}/linescore`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`MLB linescore error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function GET(
  _req: Request,
  { params }: { params: { gamePk: string } }
) {
  const gamePk = Number(params.gamePk);
  if (!Number.isFinite(gamePk)) {
    return new Response(JSON.stringify({ error: "invalid gamePk" }), { status: 400 });
  }

  try {
    const data = await getLinescore(gamePk);
    return Response.json({ ok: true, gamePk, data, fetchedAt: new Date().toISOString() });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 502,
    });
  }
}
