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
    imageSmall: card.images.small,
    imageLarge: card.images.large,
    cardmarketUrl: card.cardmarket?.url,
    cardmarketLowPrice,
    cardmarketAvg30: prices?.avg30,
    collected: 0,
    needed,
  };
}
