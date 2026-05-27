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
  localId?: string;
  name: string;
  image?: string;
  category?: string;
  supertype?: string;
  // Some promo/special cards have set: null in TCGdex
  set?: {
    id: string;
    name: string;
    symbol?: string;
    releaseDate?: string;
    serie?: { id: string; name: string };
    cardCount?: { total: number; official: number };
  } | null;
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
  const rawCat = raw.category ?? raw.supertype ?? '';
  const supertype = rawCat === 'Pokemon' ? 'Pokémon' : rawCat;
  // raw.set can be null for promo/special cards in TCGdex
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
        // Skip sets with no release date — can't determine format eligibility
        if (!set.releaseDate) continue;
        if (
          (!format.fromDate || set.releaseDate >= format.fromDate) &&
          (!format.toDate   || set.releaseDate <= format.toDate)
        ) {
          matchingIds.add(set.id);
        }
      }
    }
    // If nothing matched (e.g. all sets lack release dates), fall back to no filter
    if (matchingIds.size === 0) return null;
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

  const sortOrder = options?.sortOrder === 'desc' ? 'Desc' : 'Asc';

  // Client-side sort helper — TCGdex /cards doesn't reliably support sort:field
  function sortCards(cards: TcgCard[]): TcgCard[] {
    return cards.sort((a, b) =>
      sortOrder === 'Desc'
        ? b.set.releaseDate.localeCompare(a.set.releaseDate)
        : a.set.releaseDate.localeCompare(b.set.releaseDate),
    );
  }

  if (allowedSetIds) {
    // Pass the matching set IDs directly to TCGdex so the API does the filtering.
    // TCGdex interprets repeated set.id params as OR — cards from any of those sets.
    // Cap at 60 set IDs to keep URL sane (Expanded has 150+ sets; beyond 60 fall
    // back to a broad fetch + client-side filter).
    const useServerFilter = allowedSetIds.length <= 60;
    let cards: TcgCard[];

    if (useServerFilter) {
      const setParams = allowedSetIds.map((id) => `set.id=${id}`).join('&');
      const url = `${BASE_URL}/cards?name=*${encodeURIComponent(query.trim())}*&${setParams}&pagination:page=${page}&pagination:itemsPerPage=250`;
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
      const json = await res.json();
      const mapped = unwrap<TcgDexCard>(json).filter((r) => r?.set).map(mapCard);
      // If TCGdex treated the repeated set.id params as AND (returns 0), fall back
      // to an unfiltered fetch + client-side filter so results still appear.
      if (mapped.length > 0) {
        cards = mapped;
      } else {
        const fallbackUrl = `${BASE_URL}/cards?name=*${encodeURIComponent(query.trim())}*&pagination:page=${page}&pagination:itemsPerPage=500`;
        const fb = await fetch(fallbackUrl, signal ? { signal } : undefined);
        if (!fb.ok) throw new Error(`TCG API error: ${fb.status}`);
        const fbJson = await fb.json();
        const allowed = new Set(allowedSetIds);
        cards = unwrap<TcgDexCard>(fbJson)
          .filter((r) => r?.set)
          .map(mapCard)
          .filter((c) => c.set.id && allowed.has(c.set.id));
      }
    } else {
      // Expanded / very large formats: fetch a big window and filter client-side
      const url = `${BASE_URL}/cards?name=*${encodeURIComponent(query.trim())}*&pagination:page=${page}&pagination:itemsPerPage=500`;
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
      const json = await res.json();
      const allowed = new Set(allowedSetIds);
      cards = unwrap<TcgDexCard>(json)
        .filter((r) => r?.set)
        .map(mapCard)
        .filter((c) => c.set.id && allowed.has(c.set.id));
    }

    return sortCards(cards);
  }

  // No format filter: fetch 20 with user's sort preference
  const url = `${BASE_URL}/cards?name=*${encodeURIComponent(query.trim())}*&pagination:page=${page}&pagination:itemsPerPage=20`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return sortCards(unwrap<TcgDexCard>(json).filter((r) => r?.set).map(mapCard));
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
    const url = `${BASE_URL}/cards?${parts.join('&')}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    let cards = unwrap<TcgDexCard>(json).filter((r) => r?.set).map(mapCard);
    if (allowedSetIds) {
      const allowed = new Set(allowedSetIds);
      cards = cards.filter((c) => c.set.id && allowed.has(c.set.id));
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
