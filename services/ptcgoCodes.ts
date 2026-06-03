// Fetches official PTCGO/PTCGL set codes from the Pokémon TCG API.
// TCGdex set IDs (e.g. "sv1", "swsh3") match pokemontcg.io set IDs,
// which carry a ptcgoCode field (e.g. "SVI", "BST").

const PKMN_API = 'https://api.pokemontcg.io/v2';

let cache: Map<string, string> | null = null;

/** Synchronous read from the cache — returns null if cache not yet loaded. */
export function getCachedPtcgoCode(setId: string): string | null {
  return cache?.get(setId) ?? null;
}

export async function getPtcgoCodes(): Promise<Map<string, string>> {
  if (cache) return cache;

  const apiKey = process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY;
  const headers: Record<string, string> = apiKey ? { 'X-Api-Key': apiKey } : {};

  const map = new Map<string, string>();
  let page = 1;

  while (true) {
    const res = await fetch(
      `${PKMN_API}/sets?select=id,ptcgoCode&pageSize=250&page=${page}`,
      { headers }
    );
    if (!res.ok) break;
    const json = (await res.json()) as { data: { id: string; ptcgoCode?: string }[]; count: number; totalCount: number };
    for (const set of json.data) {
      if (set.ptcgoCode) map.set(set.id, set.ptcgoCode);
    }
    if (json.data.length < 250) break;
    page++;
  }

  cache = map;
  return map;
}

export function clearPtcgoCodeCache() {
  cache = null;
}
