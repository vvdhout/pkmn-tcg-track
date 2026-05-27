'use client';

import { useState } from 'react';

interface Result {
  label: string;
  url: string;
  ok: boolean;
  status?: number;
  elapsed: number;
  sample?: string;
  error?: string;
}

async function probe(label: string, url: string): Promise<Result> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const elapsed = Date.now() - start;
    if (!res.ok) return { label, url, ok: false, status: res.status, elapsed };
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json.data ?? []);
    return { label, url, ok: true, status: res.status, elapsed, sample: JSON.stringify(arr[0] ?? null) };
  } catch (e) {
    return { label, url, ok: false, error: String(e), elapsed: Date.now() - start };
  }
}

export default function PingPage() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResults(null);

    // Use the same manual URL construction as pokemonTcg.ts (literal ':')
    const BASE = 'https://api.tcgdex.net/v2/en';
    const setsUrl = `${BASE}/sets?pagination:itemsPerPage=1`;
    // Mirrors searchCards() exactly — includes sort params which the previous test omitted
    const cardsNoSort = `${BASE}/cards?name=*pikachu*&pagination:itemsPerPage=1`;
    const cardsWithSort = `${BASE}/cards?name=*pikachu*&pagination:page=1&pagination:itemsPerPage=1&sort:field=set.releaseDate&sort:order=Asc`;

    const out = await Promise.all([
      probe('sets', setsUrl),
      probe('cards (no sort)', cardsNoSort),
      probe('cards (with sort)', cardsWithSort),
    ]);
    setResults(out);
    setRunning(false);
  }

  return (
    <div className="p-6 max-w-lg mx-auto font-mono text-sm">
      <h1 className="text-zinc-100 font-bold text-base mb-4">API reachability test</h1>
      <p className="text-zinc-500 text-xs mb-4">Runs from your browser — not from Vercel servers.</p>
      <button
        onClick={run}
        disabled={running}
        className="px-4 py-2 bg-white text-zinc-900 rounded text-sm font-medium disabled:opacity-50"
      >
        {running ? 'Testing…' : 'Run test'}
      </button>

      {results && (
        <div className="mt-6 space-y-4">
          {results.map((r) => (
            <div key={r.label} className="bg-app-surface border border-app-border rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.ok ? '✓' : '✗'}</span>
                <span className="text-zinc-200 font-bold">{r.label}</span>
                <span className="text-zinc-500">{r.elapsed}ms</span>
                {r.status && <span className="text-zinc-500">HTTP {r.status}</span>}
              </div>
              {r.error && <p className="text-red-400 text-xs break-all">{r.error}</p>}
              {r.sample && <p className="text-zinc-400 text-xs break-all">{JSON.stringify(r.sample)}</p>}
              <p className="text-zinc-600 text-[10px] break-all mt-1">{r.url}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
