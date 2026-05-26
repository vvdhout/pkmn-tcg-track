import { NextResponse } from 'next/server';

export async function GET() {
  const start = Date.now();
  try {
    const res = await fetch(
      'https://api.pokemontcg.io/v2/cards?q=name:pikachu&pageSize=1&select=id,name',
      { signal: AbortSignal.timeout(10000) },
    );
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, elapsed });
    }
    const json = await res.json();
    return NextResponse.json({ ok: true, status: res.status, elapsed, sample: json.data?.[0] ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), elapsed: Date.now() - start });
  }
}
