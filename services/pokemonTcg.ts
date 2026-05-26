import type { TcgCard, TcgSet } from '@/types';
import { getFormat } from '@/services/formats';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const SELECTED_FIELDS = 'id,name,supertype,subtypes,types,number,set,images,cardmarket';

export interface SearchOptions {
  sortOrder?: 'asc' | 'desc'; // 'asc' = oldest first (default)
  formatIds?: string[];        // format IDs to filter by; undefined/empty = no filter
}

function buildOrderBy(options?: SearchOptions): string {
  return options?.sortOrder === 'desc' ? '-set.releaseDate' : 'set.releaseDate';
}

// ── Set list cache (fetched once per page-load, reused everywhere) ──────────

let _setCache: TcgSet[] | null = null;

export async function fetchSets(): Promise<TcgSet[]> {
  if (_setCache) return _setCache;
  const url = new URL(`${BASE_URL}/sets`);
  url.searchParams.set('orderBy', 'releaseDate');
  url.searchParams.set('pageSize', '250');
  url.searchParams.set('select', 'id,name,series,releaseDate,printedTotal,images');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  _setCache = json.data as TcgSet[];
  return _setCache;
}

/**
 * Resolves an array of format IDs to a Lucene set-id filter string.
 * Returns null   → no filter (show all sets)
 * Returns 'NONE' → no sets match (search should return [])
 * Returns string → e.g. "(set.id:sv5 OR set.id:sv6 OR ...)"
 */
async function resolveFormatFilter(formatIds?: string[]): Promise<string | null> {
  if (!formatIds || formatIds.length === 0) return null;

  // If any selected format is unlimited (no date bounds), the union is all sets → no filter
  if (formatIds.some((id) => {
    const f = getFormat(id);
    return !f || (!f.fromDate && !f.toDate);
  })) return null;

  try {
    const sets = await fetchSets();
    const matchingIds = new Set<string>();

    for (const formatId of formatIds) {
      const format = getFormat(formatId);
      if (!format) continue;
      for (const set of sets) {
        if (
          (!format.fromDate || set.releaseDate >= format.fromDate) &&
          (!format.toDate   || set.releaseDate <= format.toDate)
        ) {
          matchingIds.add(set.id);
        }
      }
    }

    if (matchingIds.size === 0) return 'NONE';
    return `(${[...matchingIds].map((id) => `set.id:${id}`).join(' OR ')})`;
  } catch {
    return null;
  }
}

// ── Public search functions ──────────────────────────────────────────────────

function buildNameQuery(query: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return words.map((w) => `name:*${w.replace(/'/g, "\\'")}*`).join(' ');
}

export async function searchCards(query: string, page = 1, options?: SearchOptions, signal?: AbortSignal): Promise<TcgCard[]> {
  if (!query.trim()) return [];

  const setFilter = await resolveFormatFilter(options?.formatIds);
  if (setFilter === 'NONE') return [];

  const parts = [buildNameQuery(query)];
  if (setFilter) parts.push(setFilter);

  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', parts.join(' '));
  url.searchParams.set('orderBy', buildOrderBy(options));
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('page', String(page));
  url.searchParams.set('select', SELECTED_FIELDS);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return json.data as TcgCard[];
}

export async function getCard(id: string): Promise<TcgCard> {
  const res = await fetch(`${BASE_URL}/cards/${id}`);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return json.data as TcgCard;
}

export async function findCards(
  name: string,
  setCode?: string | null,
  number?: string | null,
  options?: SearchOptions,
): Promise<TcgCard[]> {
  const cleanNumber = number?.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1') ?? null;
  const orderBy = buildOrderBy(options);

  const setFilter = await resolveFormatFilter(options?.formatIds);
  if (setFilter === 'NONE') return [];

  async function query(namePart: string, useSet: boolean, useNumber: boolean): Promise<TcgCard[]> {
    const parts = [namePart];
    if (useSet && setCode) parts.push(`set.id:${setCode.toLowerCase()}`);
    if (useNumber && cleanNumber) parts.push(`number:${cleanNumber}`);
    if (setFilter) parts.push(setFilter);
    const url = new URL(`${BASE_URL}/cards`);
    url.searchParams.set('q', parts.join(' '));
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('orderBy', orderBy);
    url.searchParams.set('select', SELECTED_FIELDS);
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    return json.data as TcgCard[];
  }

  const r1 = await query(`name:"${name}"`, true, true);
  if (r1.length > 0) return r1;

  if (setCode || cleanNumber) {
    const r2 = await query(`name:"${name}"`, false, true);
    if (r2.length > 0) return r2;
  }

  const r3 = await query(`name:*${name}*`, false, true);
  if (r3.length > 0) return r3;

  return query(`name:*${name}*`, false, false);
}

export async function refreshCardPrices(
  ids: string[],
): Promise<{ tcgId: string; lowPrice?: number; avg30?: number }[]> {
  if (ids.length === 0) return [];
  const BATCH = 20;
  const results: { tcgId: string; lowPrice?: number; avg30?: number }[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const url = new URL(`${BASE_URL}/cards`);
    url.searchParams.set('q', batch.map((id) => `id:${id}`).join(' OR '));
    url.searchParams.set('pageSize', String(BATCH));
    url.searchParams.set('select', 'id,cardmarket');
    try {
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const json = await res.json();
      for (const card of json.data as TcgCard[]) {
        const prices = card.cardmarket?.prices;
        const lowPrice =
          prices?.lowPriceExPlus != null && prices.lowPriceExPlus > 0
            ? prices.lowPriceExPlus
            : prices?.lowPrice;
        results.push({ tcgId: card.id, lowPrice, avg30: prices?.avg30 });
      }
    } catch {
      // skip failed batches silently
    }
  }
  return results;
}

export function mapToTracked(card: TcgCard, needed = 1) {
  const prices = card.cardmarket?.prices;
  const lowPriceExPlus = prices?.lowPriceExPlus;
  const lowPrice = prices?.lowPrice;
  const cardmarketLowPrice =
    lowPriceExPlus != null && lowPriceExPlus > 0 ? lowPriceExPlus : lowPrice;

  return {
    tcgId: card.id,
    name: card.name,
    supertype: card.supertype,
    number: card.number,
    setId: card.set.id,
    setName: card.set.name,
    setSymbol: card.set.images?.symbol,
    imageSmall: card.images.small,
    imageLarge: card.images.large,
    cardmarketUrl: card.cardmarket?.url,
    cardmarketLowPrice,
    cardmarketAvg30: prices?.avg30,
    collected: 0,
    needed,
  };
}
