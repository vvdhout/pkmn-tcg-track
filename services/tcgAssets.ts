const ASSETS_BASE = 'https://assets.tcgdex.net';
const SET_API = 'https://api.tcgdex.net/v2/en/sets';

/** Cardmarket link defaults: English listings, Excellent or better. */
const CARDMARKET_LINK_PARAMS = {
  language: '1',
  minCondition: '4',
} as const;

/** Append language + minCondition, preserving any existing query (e.g. idProduct). */
export function cardmarketLinkHref(url?: string): string | undefined {
  if (!url) return undefined;

  const qIndex = url.indexOf('?');
  const base = qIndex === -1 ? url : url.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? '' : url.slice(qIndex + 1));
  params.set('language', CARDMARKET_LINK_PARAMS.language);
  params.set('minCondition', CARDMARKET_LINK_PARAMS.minCondition);
  return `${base}?${params.toString()}`;
}

export function buildCardmarketProductUrl(
  slugPath: string,
  idProduct?: number,
): string {
  const params = new URLSearchParams();
  params.set('language', CARDMARKET_LINK_PARAMS.language);
  params.set('minCondition', CARDMARKET_LINK_PARAMS.minCondition);
  if (idProduct != null) params.set('idProduct', String(idProduct));
  return `${slugPath}?${params.toString()}`;
}

export interface SetMeta {
  serieId?: string;
  releaseDate: string; // YYYY/MM/DD
}

const _setMetaCache = new Map<string, SetMeta>();

/** Fetch set detail once (serie + releaseDate) and cache. */
export async function fetchSetMeta(
  setId: string,
  signal?: AbortSignal,
): Promise<SetMeta | null> {
  const cached = _setMetaCache.get(setId);
  if (cached) return cached;

  const res = await fetch(
    `${SET_API}/${encodeURIComponent(setId)}`,
    signal ? { signal } : undefined,
  );
  if (!res.ok) return null;

  const json = (await res.json()) as {
    serie?: { id: string };
    releaseDate?: string;
  };

  const meta: SetMeta = {
    serieId: json.serie?.id,
    releaseDate: json.releaseDate?.replace(/-/g, '/') ?? '',
  };
  _setMetaCache.set(setId, meta);
  return meta;
}

export function getSetReleaseDate(setId: string): string {
  return _setMetaCache.get(setId)?.releaseDate ?? '';
}

export async function prefetchSetMeta(
  setIds: string[],
  signal?: AbortSignal,
  concurrency = 6,
): Promise<void> {
  const pending = [...new Set(setIds)].filter((id) => !_setMetaCache.has(id));
  for (let i = 0; i < pending.length; i += concurrency) {
    await Promise.all(
      pending.slice(i, i + concurrency).map((id) => fetchSetMeta(id, signal)),
    );
  }
}

export async function fetchSetSerieId(
  setId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const meta = await fetchSetMeta(setId, signal);
  return meta?.serieId ?? null;
}

/** TCGdex returns symbol URLs without a file extension; assets live at .webp */
export function resolveSymbolUrl(symbol?: string): string | undefined {
  if (!symbol) return undefined;
  if (/\.(webp|png|jpg|jpeg|gif)$/i.test(symbol)) return symbol;
  return `${symbol}.webp`;
}

export function fixStoredSymbolUrl(symbol?: string): string | undefined {
  return resolveSymbolUrl(symbol);
}

export function fixStoredCardImageUrl(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes('pokemontcg.io')) return url;
  if (!url.includes('assets.tcgdex.net')) return url;
  if (/\/(low|high)\.(webp|png)$/i.test(url) || /\.(webp|png|jpg|jpeg)$/i.test(url)) return url;
  return `${url.replace(/\/$/, '')}/low.webp`;
}

interface ImageResolveInput {
  apiImage?: string;
  briefImage?: string;
  setId?: string;
  localId?: string;
}

/** Resolve display URLs for card thumbnails (search + hydrate). */
export async function resolveCardImageUrls(
  input: ImageResolveInput,
  signal?: AbortSignal,
): Promise<{ small: string; large: string }> {
  const apiBase = input.apiImage ?? input.briefImage ?? '';
  let constructed = false;
  let base = apiBase;

  if (!base && input.setId && input.localId != null && input.localId !== '') {
    const serieId = await fetchSetSerieId(input.setId, signal);
    if (serieId) {
      base = `${ASSETS_BASE}/en/${serieId}/${input.setId}/${input.localId}`;
      constructed = true;
    }
  }

  if (!base) return { small: '', large: '' };

  if (!constructed) {
    return {
      small: `${base}/low.webp`,
      large: `${base}/high.webp`,
    };
  }

  // Older / promo cards: CDN often has /png only, not /low.webp
  return {
    small: `${base}/png`,
    large: `${base}/png`,
  };
}
