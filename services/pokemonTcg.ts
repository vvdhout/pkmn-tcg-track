import type { TcgCard, TcgSet } from '@/types';
import { getFormat } from '@/services/formats';

const BASE_URL = 'https://api.tcgdex.net/v2/en';

export interface SearchOptions {
  sortOrder?: 'asc' | 'desc';
  formatIds?: string[];
}

// ── TCGdex response shapes ────────────────────────────────────────────────────
// TCGdex name search: plain `name=pikachu` does partial/contains matching.
// Do NOT use * wildcards — TCGdex ignores/mishandles them and returns [].
// Pagination: literal colons required — `pagination:page=N&pagination:itemsPerPage=N`
// Sort: sort params are NOT supported on /cards — sort client-side instead.
// Response: plain array [] for list endpoints (no {data:[...]} wrapper).
// Some promo cards have set:null — always guard before accessing set fields.

interface TcgDexCard {
  id: string;
  localId?: string;
  name: string;
  image?: string;
  category?: string;
  set?: {
    id: string;
    name: string;
    symbol?: string;
    releaseDate?: string;
    serie?: { id: string; name: string };
    cardCount?: { total: number; official: number };
  } | null;
  cardmarket?: {
    prices?: {
      avg?: number;
      low?: number;
      avg30?: number;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const rawCat = raw.category ?? '';
  const supertype = rawCat === 'Pokemon' ? 'Pokémon' : rawCat;
  const set = raw.set ?? null;
  const cardmarketUrl = set
    ? `https://www.cardmarket.com/en/Pokemon/Products/Singles/${toCardmarketSlug(set.name)}/${toCardmarketSlug(raw.name)}`
    : undefined;

  return {
    id: raw.id,
    name: raw.name,
    supertype,
    number: raw.localId ?? '',
    set: {
      id: set?.id ?? '',
      name: set?.name ?? '',
      series: set?.serie?.name ?? '',
      // TCGdex returns YYYY-MM-DD; normalise to YYYY/MM/DD to match formats.ts date boundaries
      releaseDate: set?.releaseDate?.replace(/-/g, '/') ?? '',
      printedTotal: set?.cardCount?.official ?? 0,
      total: set?.cardCount?.total ?? 0,
      images: set?.symbol ? { symbol: set.symbol } : undefined,
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

function clientSort(cards: TcgCard[], order: 'asc' | 'desc'): TcgCard[] {
  return cards.sort((a, b) => {
    const cmp = a.set.releaseDate.localeCompare(b.set.releaseDate);
    return order === 'desc' ? -cmp : cmp;
  });
}

// ── Set cache ─────────────────────────────────────────────────────────────────

let _setCache: TcgSet[] | null = null;

export async function fetchSets(signal?: AbortSignal): Promise<TcgSet[]> {
  if (_setCache) return _setCache;
  const url = `${BASE_URL}/sets?pagination:itemsPerPage=500`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  _setCache = unwrap<TcgDexSet>(json).map((s) => ({
    id: s.id,
    name: s.name,
    series: s.serie?.name ?? '',
    releaseDate: s.releaseDate?.replace(/-/g, '/') ?? '',
    printedTotal: s.cardCount?.official ?? 0,
    images: s.symbol ? { symbol: s.symbol } : undefined,
  }));
  return _setCache;
}

// ── Format filter ─────────────────────────────────────────────────────────────

// Returns null  → no filter active
// Returns [...] → set IDs that belong to the selected formats
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
        if (!set.releaseDate) continue;
        if (
          (!format.fromDate || set.releaseDate >= format.fromDate) &&
          (!format.toDate   || set.releaseDate <= format.toDate)
        ) {
          matchingIds.add(set.id);
        }
      }
    }
    if (matchingIds.size === 0) return null;
    return [...matchingIds];
  } catch {
    return null;
  }
}

// ── Public search functions ───────────────────────────────────────────────────

export async function searchCards(
  query: string,
  page = 1,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<TcgCard[]> {
  if (!query.trim()) return [];

  const allowedSetIds = await resolveFormatFilter(options?.formatIds, signal);
  if (allowedSetIds !== null && allowedSetIds.length === 0) return [];

  const sortOrder = options?.sortOrder ?? 'asc';

  // Fetch more when a format filter is active so client-side filtering leaves
  // enough results; for unfiltered searches 20 is a reasonable UI page size.
  const pageSize = allowedSetIds ? 250 : 20;

  const url = `${BASE_URL}/cards?name=${encodeURIComponent(query.trim())}&pagination:page=${page}&pagination:itemsPerPage=${pageSize}`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();

  let cards = unwrap<TcgDexCard>(json)
    .filter((r) => r?.set != null)
    .map(mapCard);

  if (allowedSetIds) {
    const allowed = new Set(allowedSetIds);
    cards = cards.filter((c) => c.set.id && allowed.has(c.set.id));
  }

  return clientSort(cards, sortOrder);
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

  const allowedSetIds = await resolveFormatFilter(options?.formatIds);
  if (allowedSetIds !== null && allowedSetIds.length === 0) return [];

  async function query(
    nameParam: string,
    exact: boolean,
    useSet: boolean,
    useNumber: boolean,
  ): Promise<TcgCard[]> {
    const parts: string[] = [];
    // `eq:` prefix requests exact matching; plain value does contains matching
    parts.push(`name=${exact ? 'eq:' : ''}${encodeURIComponent(nameParam)}`);
    if (useSet && setCode) parts.push(`set.id=${encodeURIComponent(setCode.toLowerCase())}`);
    if (useNumber && cleanNumber) parts.push(`localId=${encodeURIComponent(cleanNumber)}`);
    parts.push(`pagination:itemsPerPage=20`);
    const url = `${BASE_URL}/cards?${parts.join('&')}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    let cards = unwrap<TcgDexCard>(json)
      .filter((r) => r?.set != null)
      .map(mapCard);
    if (allowedSetIds) {
      const allowed = new Set(allowedSetIds);
      cards = cards.filter((c) => c.set.id && allowed.has(c.set.id));
    }
    return cards;
  }

  // Stage 1 — exact name + set + number
  const r1 = await query(name, true, true, true);
  if (r1.length > 0) return r1;

  // Stage 2 — exact name + number (drop set)
  if (setCode || cleanNumber) {
    const r2 = await query(name, true, false, true);
    if (r2.length > 0) return r2;
  }

  // Stage 3 — contains name + number
  const r3 = await query(name, false, false, true);
  if (r3.length > 0) return r3;

  // Stage 4 — contains name only
  return query(name, false, false, false);
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
  const lowPrice = prices?.lowPrice;

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
    cardmarketLowPrice: lowPrice,
    cardmarketAvg30: prices?.avg30,
    collected: 0,
    needed,
  };
}
