import type { TcgCard, TcgSet } from '@/types';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const SELECTED_FIELDS = 'id,name,supertype,subtypes,types,number,set,images,cardmarket';

function headers(): HeadersInit {
  const key = process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY;
  return key ? { 'X-Api-Key': key } : {};
}

export interface SearchOptions {
  sortOrder?: 'asc' | 'desc'; // 'asc' = oldest first (default)
  setDateFrom?: string;        // YYYY/MM/DD — include sets released on or after this date
  setDateTo?: string;          // YYYY/MM/DD — include sets released on or before this date
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
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  _setCache = json.data as TcgSet[];
  return _setCache;
}

/**
 * Resolves a date range to a Lucene set-id filter string.
 * Returns null  → no filter (apply none)
 * Returns 'NONE' → range contains zero sets (search should return [])
 * Returns string  → e.g. "(set.id:sv1 OR set.id:sv2 OR ...)"
 *
 * Using set IDs is reliable; the TCG API's Lucene parser doesn't always
 * handle date-comparison operators (>=, <=) on set.releaseDate correctly.
 */
async function resolveSetFilter(dateFrom?: string, dateTo?: string): Promise<string | null> {
  if (!dateFrom && !dateTo) return null;

  // Normalise order if user configured them backwards
  let from = dateFrom;
  let to = dateTo;
  if (from && to && from > to) [from, to] = [to, from];

  try {
    const sets = await fetchSets();
    const ids = sets
      .filter(
        (s) =>
          (!from || s.releaseDate >= from) &&
          (!to   || s.releaseDate <= to),
      )
      .map((s) => s.id);

    if (ids.length === 0) return 'NONE';
    return `(${ids.map((id) => `set.id:${id}`).join(' OR ')})`;
  } catch {
    // If the set-list fetch fails, silently skip the filter
    return null;
  }
}

// ── Public search functions ──────────────────────────────────────────────────

export async function searchCards(query: string, page = 1, options?: SearchOptions): Promise<TcgCard[]> {
  if (!query.trim()) return [];

  const setFilter = await resolveSetFilter(options?.setDateFrom, options?.setDateTo);
  if (setFilter === 'NONE') return [];

  const parts = [`name:*${query.trim()}*`];
  if (setFilter) parts.push(setFilter);

  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', parts.join(' '));
  url.searchParams.set('orderBy', buildOrderBy(options));
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('page', String(page));
  url.searchParams.set('select', SELECTED_FIELDS);

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return json.data as TcgCard[];
}

export async function getCard(id: string): Promise<TcgCard> {
  const res = await fetch(`${BASE_URL}/cards/${id}`, { headers: headers() });
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

  const setFilter = await resolveSetFilter(options?.setDateFrom, options?.setDateTo);
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
    const res = await fetch(url.toString(), { headers: headers() });
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
