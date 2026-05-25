import type { TcgCard } from '@/types';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const SELECTED_FIELDS = 'id,name,supertype,subtypes,types,number,set,images,cardmarket';

function headers(): HeadersInit {
  const key = process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY;
  return key ? { 'X-Api-Key': key } : {};
}

export async function searchCards(query: string, page = 1): Promise<TcgCard[]> {
  if (!query.trim()) return [];
  const q = `name:*${query.trim()}*`;
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set('q', q);
  url.searchParams.set('orderBy', 'set.releaseDate');
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
): Promise<TcgCard[]> {
  // Strip "/198" total suffix and leading zeros from number
  const cleanNumber = number?.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1') ?? null;

  async function query(namePart: string, useSet: boolean, useNumber: boolean): Promise<TcgCard[]> {
    const parts = [namePart];
    if (useSet && setCode) parts.push(`set.id:${setCode.toLowerCase()}`);
    if (useNumber && cleanNumber) parts.push(`number:${cleanNumber}`);
    const url = new URL(`${BASE_URL}/cards`);
    url.searchParams.set('q', parts.join(' '));
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('orderBy', '-set.releaseDate');
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
