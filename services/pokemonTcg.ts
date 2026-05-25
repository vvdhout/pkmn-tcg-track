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

/** Normalise and return a date-range filter string to append to a query, or ''. */
function dateRangeFilter(options?: SearchOptions): string {
  let from = options?.setDateFrom;
  let to = options?.setDateTo;
  // Swap if user configured them backwards
  if (from && to && from > to) [from, to] = [to, from];
  const parts: string[] = [];
  if (from) parts.push(`set.releaseDate>=${from}`);
  if (to) parts.push(`set.releaseDate<=${to}`);
  return parts.join(' ');
}

export async function searchCards(query: string, page = 1, options?: SearchOptions): Promise<TcgCard[]> {
  if (!query.trim()) return [];
  const namePart = `name:*${query.trim()}*`;
  const dateFilter = dateRangeFilter(options);
  const q = [namePart, dateFilter].filter(Boolean).join(' ');

  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', q);
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
  // Strip "/198" total suffix and leading zeros from number
  const cleanNumber = number?.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1') ?? null;
  const dateFilter = dateRangeFilter(options);
  const orderBy = buildOrderBy(options);

  async function query(namePart: string, useSet: boolean, useNumber: boolean): Promise<TcgCard[]> {
    const parts = [namePart];
    if (useSet && setCode) parts.push(`set.id:${setCode.toLowerCase()}`);
    if (useNumber && cleanNumber) parts.push(`number:${cleanNumber}`);
    if (dateFilter) parts.push(dateFilter);
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

  // Strategy: try progressively looser filters.
  // Set codes from AI are often wrong (sv1 vs sv01 etc.), so we drop the set
  // filter quickly and rely on name + number which are usually accurate.

  // 1. Exact name + set + number (most precise)
  const r1 = await query(`name:"${name}"`, true, true);
  if (r1.length > 0) return r1;

  // 2. Exact name + number only (set code may have been wrong)
  if (setCode || cleanNumber) {
    const r2 = await query(`name:"${name}"`, false, true);
    if (r2.length > 0) return r2;
  }

  // 3. Wildcard name + number (handles slight name variations)
  const r3 = await query(`name:*${name}*`, false, true);
  if (r3.length > 0) return r3;

  // 4. Wildcard name only (last resort — no set or number filter)
  return query(`name:*${name}*`, false, false);
}

export async function fetchSets(): Promise<TcgSet[]> {
  const url = new URL(`${BASE_URL}/sets`);
  url.searchParams.set('orderBy', 'releaseDate'); // oldest first
  url.searchParams.set('pageSize', '250');
  url.searchParams.set('select', 'id,name,series,releaseDate,printedTotal');
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return json.data as TcgSet[];
}

export function mapToTracked(card: TcgCard, needed = 1) {
  const prices = card.cardmarket?.prices;
  // Prefer ExPlus (Excellent+ condition) as the "from" price; fall back to lowPrice if absent/zero
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
