import { NextResponse } from 'next/server';

const BASE = 'https://api.pokemontcg.io/v2';

async function probe(label: string, url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const elapsed = Date.now() - start;
    let sample = null;
    if (res.ok) {
      const json = await res.json();
      sample = json.data?.[0] ?? json.data ?? null;
    }
    return { label, url, ok: res.ok, status: res.status, elapsed, sample };
  } catch (e) {
    return { label, url, ok: false, error: String(e), elapsed: Date.now() - start };
  }
}

export async function GET() {
  // Test 1: sets endpoint (no query, confirms basic connectivity)
  const setsUrl = new URL(`${BASE}/sets`);
  setsUrl.searchParams.set('pageSize', '1');
  setsUrl.searchParams.set('select', 'id,name');

  // Test 2: cards endpoint built exactly like the app (URLSearchParams-encoded)
  const cardsUrl = new URL(`${BASE}/cards`);
  cardsUrl.searchParams.set('q', 'name:*pikachu*');
  cardsUrl.searchParams.set('pageSize', '1');
  cardsUrl.searchParams.set('select', 'id,name');

  const [sets, cards] = await Promise.all([
    probe('sets', setsUrl.toString()),
    probe('cards', cardsUrl.toString()),
  ]);

  return NextResponse.json({ sets, cards });
}
