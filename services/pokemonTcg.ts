import type { TcgCard, TcgSet } from '@/types';
import { getFormat } from '@/services/formats';

const BASE_URL = 'https://api.tcgdex.net/v2/en';
const HYDRATE_CONCURRENCY = 6;
const SEARCH_PAGE_SIZE = 20;
const FORMAT_SEARCH_BRIEF_LIMIT = 250;

export interface SearchOptions {
  sortOrder?: 'asc' | 'desc';
  formatIds?: string[];
}

// List endpoints return CardBrief; full card data requires GET /cards/{id}.
interface TcgDexCardBrief {
  id: string;
  localId?: string;
  name: string;
  image?: string;
}

interface TcgDexCardmarketPricing {
  idProduct?: number;
  low?: number;
  avg?: number;
  avg30?: number;
  'low-holo'?: number;
  'avg30-holo'?: number;
}

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
  pricing?: {
    cardmarket?: TcgDexCardmarketPricing | null;
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

function buildListUrl(
  filters: Array<[string, string]>,
  pageSize: number,
  page = 1,
): string {
  const parts = filters.map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  parts.push(`pagination:page=${page}`);
  parts.push(`pagination:itemsPerPage=${pageSize}`);
  return `${BASE_URL}/cards?${parts.join('&')}`;
}

function setIdFromBrief(brief: TcgDexCardBrief): string {
  if (brief.localId) {
    const suffix = `-${brief.localId}`;
    if (brief.id.endsWith(suffix)) return brief.id.slice(0, -suffix.length);
  }
  const idx = brief.id.lastIndexOf('-');
  return idx > 0 ? brief.id.slice(0, idx) : brief.id;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function namesMatch(cardName: string, queryName: string, exact: boolean): boolean {
  const a = normalizeName(cardName);
  const b = normalizeName(queryName);
  if (exact) return a === b;
  return a.includes(b) || b.includes(a);
}

function normalizeCardNumber(n: string): string {
  const stripped = n.replace(/\/.*$/, '').trim();
  const digits = stripped.replace(/^0+/, '');
  return digits || '0';
}

function numbersMatch(cardNumber: string, searchNumber: string | null): boolean {
  if (!searchNumber) return true;
  return normalizeCardNumber(cardNumber) === normalizeCardNumber(searchNumber);
}

function localIdVariants(n: string): string[] {
  const base = n.replace(/\/.*$/, '').trim();
  return [...new Set([base, base.padStart(3, '0')])];
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

function cardmarketPrices(cm: TcgDexCardmarketPricing | null | undefined) {
  if (!cm) return undefined;
  const low = cm.low ?? cm['low-holo'];
  const avg30 = cm.avg30 ?? cm['avg30-holo'];
  if (low == null && avg30 == null) return undefined;
  return { lowPrice: low, avg30 };
}

function cardmarketUrl(
  raw: TcgDexCard,
  cm: TcgDexCardmarketPricing | null | undefined,
): string | undefined {
  const set = raw.set;
  if (!set?.name) return undefined;
  const slugPath = `https://www.cardmarket.com/en/Pokemon/Products/Singles/${toCardmarketSlug(set.name)}/${toCardmarketSlug(raw.name)}`;
  if (cm?.idProduct != null) {
    return `${slugPath}?idProduct=${cm.idProduct}`;
  }
  return slugPath;
}

function mapCard(raw: TcgDexCard): TcgCard | null {
  const set = raw.set;
  if (!set?.id) return null;

  const cm = raw.pricing?.cardmarket ?? undefined;
  const prices = cardmarketPrices(cm);
  const imageBase = raw.image ?? '';
  const rawCat = raw.category ?? '';
  const supertype = rawCat === 'Pokemon' ? 'Pokémon' : rawCat;

  return {
    id: raw.id,
    name: raw.name,
    supertype,
    number: raw.localId ?? '',
    set: {
      id: set.id,
      name: set.name,
      series: set.serie?.name ?? '',
      releaseDate: set.releaseDate?.replace(/-/g, '/') ?? '',
      printedTotal: set.cardCount?.official ?? 0,
      total: set.cardCount?.total ?? 0,
      images: set.symbol ? { symbol: set.symbol } : undefined,
    },
    images: {
      small: imageBase ? `${imageBase}/low.webp` : '',
      large: imageBase ? `${imageBase}/high.webp` : '',
    },
    cardmarket: {
      url: cardmarketUrl(raw, cm),
      prices,
    },
  };
}

function clientSort(cards: TcgCard[], order: 'asc' | 'desc'): TcgCard[] {
  return [...cards].sort((a, b) => {
    const cmp = a.set.releaseDate.localeCompare(b.set.releaseDate);
    return order === 'desc' ? -cmp : cmp;
  });
}

function filterByFormat(cards: TcgCard[], allowedSetIds: string[] | null): TcgCard[] {
  if (!allowedSetIds) return cards;
  const allowed = new Set(allowedSetIds);
  return cards.filter((c) => c.set.id && allowed.has(c.set.id));
}

function filterBriefsByFormat(
  briefs: TcgDexCardBrief[],
  allowedSetIds: string[] | null,
): TcgDexCardBrief[] {
  if (!allowedSetIds) return briefs;
  const allowed = new Set(allowedSetIds);
  return briefs.filter((b) => allowed.has(setIdFromBrief(b)));
}

async function fetchCardBriefs(
  filters: Array<[string, string]>,
  pageSize: number,
  page = 1,
  signal?: AbortSignal,
): Promise<TcgDexCardBrief[]> {
  const res = await fetch(buildListUrl(filters, pageSize, page), signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = await res.json();
  return unwrap<TcgDexCardBrief>(json);
}

async function hydrateCards(
  briefs: TcgDexCardBrief[],
  signal?: AbortSignal,
): Promise<TcgCard[]> {
  const cards: TcgCard[] = [];
  for (let i = 0; i < briefs.length; i += HYDRATE_CONCURRENCY) {
    const chunk = briefs.slice(i, i + HYDRATE_CONCURRENCY);
    const batch = await Promise.all(
      chunk.map(async (brief) => {
        try {
          return await getCard(brief.id, signal);
        } catch {
          return null;
        }
      }),
    );
    for (const card of batch) {
      if (card) cards.push(card);
    }
  }
  return cards;
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
          (!format.toDate || set.releaseDate <= format.toDate)
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCard(id: string, signal?: AbortSignal): Promise<TcgCard> {
  const res = await fetch(`${BASE_URL}/cards/${encodeURIComponent(id)}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = (await res.json()) as TcgDexCard;
  const card = mapCard(json);
  if (!card) throw new Error(`Card ${id} has no set data`);
  return card;
}

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
  const briefLimit = allowedSetIds ? FORMAT_SEARCH_BRIEF_LIMIT : SEARCH_PAGE_SIZE;

  const briefs = await fetchCardBriefs(
    [['name', query.trim()]],
    briefLimit,
    page,
    signal,
  );

  const filteredBriefs = filterBriefsByFormat(briefs, allowedSetIds).slice(0, SEARCH_PAGE_SIZE);
  const cards = filterByFormat(await hydrateCards(filteredBriefs, signal), allowedSetIds);

  return clientSort(cards, sortOrder);
}

export async function findCards(
  name: string,
  setCode?: string | null,
  number?: string | null,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<TcgCard[]> {
  const cleanNumber = number?.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1') ?? null;
  const setId = setCode?.toLowerCase().trim() || null;

  const allowedSetIds = await resolveFormatFilter(options?.formatIds, signal);
  if (allowedSetIds !== null && allowedSetIds.length === 0) return [];

  const sortOrder = options?.sortOrder ?? 'asc';

  async function finish(briefs: TcgDexCardBrief[]): Promise<TcgCard[]> {
    const limited = briefs.slice(0, SEARCH_PAGE_SIZE);
    const cards = filterByFormat(await hydrateCards(limited, signal), allowedSetIds);
    return clientSort(cards, sortOrder);
  }

  // Stage 1 — set + collector number (TCGdex supports these together; name+set does not)
  if (setId && cleanNumber) {
    for (const localId of localIdVariants(cleanNumber)) {
      const briefs = await fetchCardBriefs(
        [
          ['set.id', setId],
          ['localId', localId],
        ],
        20,
        1,
        signal,
      );
      const matched = briefs.filter(
        (b) => namesMatch(b.name, name, true) && numbersMatch(b.localId ?? '', cleanNumber),
      );
      if (matched.length > 0) return finish(matched);
      if (briefs.length === 1 && namesMatch(briefs[0].name, name, false)) {
        return finish(briefs);
      }
      if (briefs.length > 0 && matched.length === 0) {
        const byNumber = briefs.filter((b) => numbersMatch(b.localId ?? '', cleanNumber));
        if (byNumber.length > 0) return finish(byNumber);
      }
    }
  }

  // Stage 2 — all cards in set, match name client-side
  if (setId) {
    const briefs = filterBriefsByFormat(
      await fetchCardBriefs([['set.id', setId]], 250, 1, signal),
      allowedSetIds,
    );
    const exact = briefs.filter((b) => namesMatch(b.name, name, true));
    if (exact.length > 0) return finish(exact);
    const fuzzy = briefs.filter((b) => namesMatch(b.name, name, false));
    if (fuzzy.length > 0) return finish(fuzzy);
  }

  // Stage 3 — name contains + optional number filter on brief list
  if (cleanNumber) {
    for (const localId of localIdVariants(cleanNumber)) {
      const briefs = filterBriefsByFormat(
        await fetchCardBriefs(
          [
            ['name', name],
            ['localId', localId],
          ],
          50,
          1,
          signal,
        ),
        allowedSetIds,
      );
      const matched = briefs.filter((b) => namesMatch(b.name, name, false));
      if (matched.length > 0) return finish(matched);
    }
  }

  // Stage 4 — name search (hydrated)
  return searchCards(name, 1, options, signal);
}

export async function refreshCardPrices(
  ids: string[],
): Promise<{ tcgId: string; lowPrice?: number; avg30?: number }[]> {
  const unique = [...new Set(ids)];
  const updates: { tcgId: string; lowPrice?: number; avg30?: number }[] = [];

  for (let i = 0; i < unique.length; i += HYDRATE_CONCURRENCY) {
    const chunk = unique.slice(i, i + HYDRATE_CONCURRENCY);
    const batch = await Promise.all(
      chunk.map(async (tcgId) => {
        try {
          const card = await getCard(tcgId);
          const prices = card.cardmarket?.prices;
          return {
            tcgId,
            lowPrice: prices?.lowPrice,
            avg30: prices?.avg30,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const row of batch) {
      if (row && (row.lowPrice != null || row.avg30 != null)) {
        updates.push(row);
      }
    }
  }

  return updates;
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
