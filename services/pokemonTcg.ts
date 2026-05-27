import type { TcgCard, TcgSet } from '@/types';
import { getFormat } from '@/services/formats';

const BASE_URL = 'https://api.tcgdex.net/v2/en';

export interface SearchOptions {
  sortOrder?: 'asc' | 'desc';
  formatIds?: string[];
}

// ── Internal TCGdex response shapes ─────────────────────────────────────────

interface TcgDexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  category?: string;
  supertype?: string;
  set: {
    id: string;
    name: string;
    symbol?: string;
    releaseDate?: string;
    serie?: { id: string; name: string };
    cardCount?: { total: number; official: number };
  };
  cardmarket?: {
    url?: string;
    prices?: {
      avg?: number;
      low?: number;
      avg30?: number;
      'avg30-holo'?: number;
      'low-holo'?: number;
    };
  };
}

interface TcgDexSet {
  id: string;
  name: string;
  releaseDate?: string;
  symbol?: string;
  serie?: { id: string; name: string };
  cardCount?: { total: number; official: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function unwrap<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  const j = json as Record<string, unknown>;
  if (Array.isArray(j?.data)) return j.data as T[];
  return [];
}

function toCardmarketSlug(s: string): string {
  return s
    .replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u').replace(/[ïî]/g, 'i').replace(/[ôö]/g, 'o')
    .replace(/[''']/g, '')
    .replace(/[&—–]/g, ' ')
    .replace(/[^a-zA-Z0-9 \-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapCard(raw: TcgDexCard): TcgCard {
  const prices = raw.cardmarket?.prices;
  const imageBase = raw.image ?? '';
  // TCGdex uses "Pokemon" (no accent); normalise to match UI filter expectations
  const rawCat = raw.category ?? raw.supertype ?? '';
  const supertype = rawCat === 'Pokemon' ? 'Pokémon' : rawCat;
  const cardmarketUrl =
    `https://www.cardmarket.com/en/Pokemon/Products/Singles/${toCardmarketSlug(raw.set.name)}/${toCardmarketSlug(raw.name)}`;

  return {
    id: raw.id,
    name: raw.name,
    supertype,
    number: raw.localId,
    set: {
      id: raw.set.id,
      name: raw.set.name,
      series: raw.set.serie?.name ?? '',
      releaseDate: raw.set.releaseDate?.replace(/-/g, '/') ?? '',
      printedTotal: raw.set.cardCount?.official ?? 0,
      total: raw.set.cardCount?.total ?? 0,
      images: raw.set.symbol ? { symbol: raw.set.symbol } : undefined,
    },
    images: {
      small: imageBase ? `${imageBase}/low.webp` : '',
      large: imageBase ? `${imageBase}/high.webp` : '',
    },
    cardmarket: {
      url: cardmarketUrl,
      prices: {
        lowPrice: prices?.low,
        avg30: prices?.avg30,
      },
    },
  };
}

// ── Set cache ────────────────────────────────────────────────────────────────

let _setCache: TcgSet[] | null = null;

export async function fetchSets(signal?: AbortSignal): Promise<TcgSet[]> {
  if (_setCache) return _setCache;
  // Build URL manually — URLSearchParams encodes ':' as '%3A' which TCGdex
  // may not decode, breaking the colon-namespaced filter params.
  const url = `${BASE_URL}/sets?pagination:itemsPerPage=500&sort:field=releaseDate&sort:order=Asc`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  _setCache = unwrap<TcgDexSet>(json).map((s) => ({
    id: s.id,
    name: s.name,
    series: s.serie?.name ?? '',
    // Normalise YYYY-MM-DD → YYYY/MM/DD to match formats.ts date boundaries
    releaseDate: s.releaseDate?.replace(/-/g, '/') ?? '',
    printedTotal: s.cardCount?.official ?? 0,
    images: s.symbol ? { symbol: s.symbol } : undefined,
  }));
  return _setCache;
}

// ── Format filter ────────────────────────────────────────────────────────────

// Returns null  → no filter
// Returns []    → no sets match (show nothing)
// Returns [...] → matching set IDs for client-side filtering
async function resolveFormatFilter(
  formatIds?: string[],
  signal?: AbortSignal,
): Promise<string[] | null> {
  if (!formatIds || formatIds.length === 0) return null;

  if (formatIds.some((id) => {
    const f = getFormat(id);
    return !f || (!f.fromDate && !f.toDate);
  })) return null;

  try {
    const sets = await fetchSets(signal);
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
    return [...matchingIds];
  } catch {
    return null;
  }
}

// ── Public search functions ──────────────────────────────────────────────────

export async function searchCards(
  query: string,
  page = 1,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<TcgCard[]> {
  if (!query.trim()) return [];

  const allowedSetIds = await resolveFormatFilter(options?.formatIds, signal);
  if (allowedSetIds !== null && allowedSetIds.length === 0) return [];

  // Fetch more when we'll be filtering client-side so the visible result
  // count doesn't shrink too aggressively.
  const pageSize = allowedSetIds ? 60 : 20;
  const sortOrder = options?.sortOrder === 'desc' ? 'Desc' : 'Asc';
  // Use manual URL construction so ':' stays literal (URLSearchParams encodes it as %3A)
  const url = `${BASE_URL}/cards?name=*${encodeURIComponent(query.trim())}*&pagination:page=${page}&pagination:itemsPerPage=${pageSize}&sort:field=set.releaseDate&sort:order=${sortOrder}`;

  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  let cards = unwrap<TcgDexCard>(json).map(mapCard);

  if (allowedSetIds) {
    const allowed = new Set(allowedSetIds);
    cards = cards.filter((c) => allowed.has(c.set.id));
  }

  return cards.slice(0, 20);
}

export async function getCard(id: string): Promise<TcgCard> {
  const res = await fetch(`${BASE_URL}/cards/${id}`);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json() as TcgDexCard;
  return mapCard(json);
}

export async function findCards(
  name: string,
  setCode?: string | null,
  number?: string | null,
  options?: SearchOptions,
): Promise<TcgCard[]> {
  const cleanNumber = number?.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1') ?? null;
  const sortOrder = options?.sortOrder === 'desc' ? 'Desc' : 'Asc';

  const allowedSetIds = await resolveFormatFilter(options?.formatIds);
  if (allowedSetIds !== null && allowedSetIds.length === 0) return [];

  async function query(
    nameParam: string,
    useSet: boolean,
    useNumber: boolean,
  ): Promise<TcgCard[]> {
    // Preserve leading/trailing '*' wildcards but encode the inner text
    const hasLeadWild = nameParam.startsWith('*');
    const hasTrailWild = nameParam.endsWith('*');
    const inner = nameParam.replace(/^\*/, '').replace(/\*$/, '');
    const nameValue = `${hasLeadWild ? '*' : ''}${encodeURIComponent(inner)}${hasTrailWild ? '*' : ''}`;
    const parts: string[] = [`name=${nameValue}`];
    if (useSet && setCode) parts.push(`set.id=${setCode.toLowerCase()}`);
    if (useNumber && cleanNumber) parts.push(`localId=${cleanNumber}`);
    parts.push(`pagination:itemsPerPage=20`);
    parts.push(`sort:field=set.releaseDate`);
    parts.push(`sort:order=${sortOrder}`);
    const url = `${BASE_URL}/cards?${parts.join('&')}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    let cards = unwrap<TcgDexCard>(json).map(mapCard);
    if (allowedSetIds) {
      const allowed = new Set(allowedSetIds);
      cards = cards.filter((c) => allowed.has(c.set.id));
    }
    return cards;
  }

  const r1 = await query(name, true, true);
  if (r1.length > 0) return r1;

  if (setCode || cleanNumber) {
    const r2 = await query(name, false, true);
    if (r2.length > 0) return r2;
  }

  const r3 = await query(`*${name}*`, false, true);
  if (r3.length > 0) return r3;

  return query(`*${name}*`, false, false);
}

// Price refresh is not supported with TCGdex (no batch ID query).
// Prices update naturally when cards are re-added via search.
export async function refreshCardPrices(
  _ids: string[],
): Promise<{ tcgId: string; lowPrice?: number; avg30?: number }[]> {
  return [];
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
