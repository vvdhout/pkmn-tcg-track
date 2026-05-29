import type { TcgCard, TcgSet } from '@/types';
import { getFormat } from '@/services/formats';
import {
  buildCardmarketProductUrl,
  fetchSetMeta,
  getSetReleaseDate,
  prefetchSetMeta,
  resolveCardImageUrls,
  resolveSymbolUrl,
} from '@/services/tcgAssets';

const BASE_URL = 'https://api.tcgdex.net/v2/en';
const HYDRATE_CONCURRENCY = 6;
const SEARCH_PAGE_SIZE = 20;
const API_BRIEF_BATCH = 250;
const MAX_API_PAGES = 20;

export interface SearchSession {
  sortedBriefs: TcgDexCardBrief[];
  shownCount: number;
  allowedSetIds: string[] | null;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedSearchResult {
  cards: TcgCard[];
  hasMore: boolean;
  session: SearchSession;
}

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
    .replace(/-+/g, '-')
    .toLowerCase();
}

// Derives the Cardmarket set abbreviation used in card slugs (e.g. "Neo Genesis" → "NG").
// Cardmarket uses the initials of each word, skipping non-alphabetic tokens like "&".
function toCmSetCode(setName: string): string {
  return setName
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .join('');
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
  const cardSlug = `${toCardmarketSlug(raw.name)}-${toCmSetCode(set.name)}${raw.localId ?? ''}`;
  const slugPath = `https://www.cardmarket.com/en/Pokemon/Products/Singles/${toCardmarketSlug(set.name)}/${cardSlug}`;
  return buildCardmarketProductUrl(slugPath, cm?.idProduct);
}

function mapCard(
  raw: TcgDexCard,
  images: { small: string; large: string },
): TcgCard | null {
  const set = raw.set;
  if (!set?.id) return null;

  const cm = raw.pricing?.cardmarket ?? undefined;
  const prices = cardmarketPrices(cm);
  const rawCat = raw.category ?? '';
  const supertype = rawCat === 'Pokemon' ? 'Pokémon' : rawCat;
  const symbol = resolveSymbolUrl(set.symbol);

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
      images: symbol ? { symbol } : undefined,
    },
    images,
    cardmarket: {
      url: cardmarketUrl(raw, cm),
      prices,
    },
  };
}

function compareCardsByRelease(
  a: { setId: string; localId: string; releaseDate?: string },
  b: { setId: string; localId: string; releaseDate?: string },
  order: 'asc' | 'desc',
): number {
  const da = a.releaseDate || getSetReleaseDate(a.setId);
  const db = b.releaseDate || getSetReleaseDate(b.setId);
  let cmp = da.localeCompare(db);
  if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
  cmp = a.setId.localeCompare(b.setId);
  if (cmp !== 0) return cmp;
  return a.localId.localeCompare(b.localId, undefined, { numeric: true });
}

function clientSort(cards: TcgCard[], order: 'asc' | 'desc'): TcgCard[] {
  return [...cards].sort((a, b) =>
    compareCardsByRelease(
      { setId: a.set.id, localId: a.number, releaseDate: a.set.releaseDate },
      { setId: b.set.id, localId: b.number, releaseDate: b.set.releaseDate },
      order,
    ),
  );
}

async function sortBriefsByReleaseDate(
  briefs: TcgDexCardBrief[],
  order: 'asc' | 'desc',
  signal?: AbortSignal,
): Promise<TcgDexCardBrief[]> {
  if (briefs.length <= 1) return briefs;
  await prefetchSetMeta(briefs.map((b) => setIdFromBrief(b)), signal);
  return [...briefs].sort((a, b) =>
    compareCardsByRelease(
      { setId: setIdFromBrief(a), localId: a.localId ?? '' },
      { setId: setIdFromBrief(b), localId: b.localId ?? '' },
      order,
    ),
  );
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
          return await getCard(brief.id, signal, brief.image);
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
    images: s.symbol ? { symbol: resolveSymbolUrl(s.symbol) } : undefined,
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
    await prefetchSetMeta(
      sets.map((s) => s.id),
      signal,
    );
    const matchingIds = new Set<string>();
    for (const formatId of formatIds) {
      const format = getFormat(formatId);
      if (!format) continue;
      for (const set of sets) {
        const releaseDate = getSetReleaseDate(set.id) || set.releaseDate;
        if (!releaseDate) continue;
        if (
          (!format.fromDate || releaseDate >= format.fromDate) &&
          (!format.toDate || releaseDate <= format.toDate)
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

export async function getCard(
  id: string,
  signal?: AbortSignal,
  briefImage?: string,
): Promise<TcgCard> {
  const res = await fetch(`${BASE_URL}/cards/${encodeURIComponent(id)}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const json = (await res.json()) as TcgDexCard;
  const images = await resolveCardImageUrls(
    {
      apiImage: json.image,
      briefImage,
      setId: json.set?.id,
      localId: json.localId,
    },
    signal,
  );
  let card = mapCard(json, images);
  if (!card) throw new Error(`Card ${id} has no set data`);

  if (!card.set.releaseDate) {
    const meta = await fetchSetMeta(card.set.id, signal);
    if (meta?.releaseDate) {
      card = { ...card, set: { ...card.set, releaseDate: meta.releaseDate } };
    }
  }

  return card;
}

async function fetchAllMatchingBriefs(
  query: string,
  signal?: AbortSignal,
): Promise<TcgDexCardBrief[]> {
  const all: TcgDexCardBrief[] = [];
  for (let page = 1; page <= MAX_API_PAGES; page++) {
    const batch = await fetchCardBriefs(
      [['name', query.trim()]],
      API_BRIEF_BATCH,
      page,
      signal,
    );
    all.push(...batch);
    if (batch.length < API_BRIEF_BATCH) break;
  }
  return all;
}

export async function searchCardsBegin(
  query: string,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<PaginatedSearchResult> {
  const emptySession: SearchSession = {
    sortedBriefs: [],
    shownCount: 0,
    allowedSetIds: null,
    sortOrder: options?.sortOrder ?? 'asc',
  };

  if (!query.trim()) {
    return { cards: [], hasMore: false, session: emptySession };
  }

  const allowedSetIds = await resolveFormatFilter(options?.formatIds, signal);
  if (allowedSetIds !== null && allowedSetIds.length === 0) {
    return { cards: [], hasMore: false, session: { ...emptySession, allowedSetIds } };
  }

  const sortOrder = options?.sortOrder ?? 'asc';
  const rawBriefs = await fetchAllMatchingBriefs(query, signal);
  const filteredBriefs = filterBriefsByFormat(rawBriefs, allowedSetIds);
  const sortedBriefs = await sortBriefsByReleaseDate(filteredBriefs, sortOrder, signal);
  const slice = sortedBriefs.slice(0, SEARCH_PAGE_SIZE);
  const cards = filterByFormat(await hydrateCards(slice, signal), allowedSetIds);

  return {
    cards: clientSort(cards, sortOrder),
    hasMore: slice.length < sortedBriefs.length,
    session: {
      sortedBriefs,
      shownCount: slice.length,
      allowedSetIds,
      sortOrder,
    },
  };
}

export async function searchCardsLoadMore(
  session: SearchSession,
  signal?: AbortSignal,
): Promise<PaginatedSearchResult> {
  const slice = session.sortedBriefs.slice(
    session.shownCount,
    session.shownCount + SEARCH_PAGE_SIZE,
  );

  if (slice.length === 0) {
    return { cards: [], hasMore: false, session };
  }

  const cards = filterByFormat(await hydrateCards(slice, signal), session.allowedSetIds);
  const shownCount = session.shownCount + slice.length;

  return {
    cards: clientSort(cards, session.sortOrder),
    hasMore: shownCount < session.sortedBriefs.length,
    session: { ...session, shownCount },
  };
}

/** First page only — used by findCards and other single-page callers. */
export async function searchCards(
  query: string,
  _page = 1,
  options?: SearchOptions,
  signal?: AbortSignal,
): Promise<TcgCard[]> {
  const result = await searchCardsBegin(query, options, signal);
  return result.cards;
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
    const sorted = await sortBriefsByReleaseDate(briefs, sortOrder, signal);
    const limited = sorted.slice(0, SEARCH_PAGE_SIZE);
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
): Promise<
  {
    tcgId: string;
    lowPrice?: number;
    avg30?: number;
    imageSmall?: string;
    imageLarge?: string;
    setSymbol?: string;
  }[]
> {
  const unique = [...new Set(ids)];
  const updates: {
    tcgId: string;
    lowPrice?: number;
    avg30?: number;
    imageSmall?: string;
    imageLarge?: string;
    setSymbol?: string;
  }[] = [];

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
            imageSmall: card.images.small || undefined,
            imageLarge: card.images.large || undefined,
            setSymbol: card.set.images?.symbol,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const row of batch) {
      if (!row) continue;
      if (
        row.lowPrice != null ||
        row.avg30 != null ||
        row.imageSmall ||
        row.imageLarge ||
        row.setSymbol
      ) {
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
