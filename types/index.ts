export interface TcgCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  types?: string[];
  number: string;
  set: {
    id: string;
    name: string;
    series: string;
    releaseDate: string;
    printedTotal: number;
    total: number;
  };
  images: {
    small: string;
    large: string;
  };
  cardmarket?: {
    url?: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      lowPriceExPlus?: number;
      trendPrice?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
    };
  };
}

export interface TrackedCard {
  tcgId: string;
  name: string;
  supertype: string;
  number: string;
  setId: string;
  setName: string;
  imageSmall: string;
  imageLarge: string;
  cardmarketUrl?: string;
  cardmarketLowPrice?: number;
  cardmarketAvg30?: number;
  collected: number;
  needed: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: TrackedCard[];
  createdAt: number;
}

export interface AppState {
  decks: Deck[];
  standaloneCards: TrackedCard[];
}

export type CardFilter = 'all' | 'pokemon' | 'trainer' | 'energy' | 'missing' | 'complete';

export type AppAction =
  | { type: 'LOAD'; payload: AppState }
  | { type: 'CREATE_DECK'; name: string }
  | { type: 'DELETE_DECK'; deckId: string }
  | { type: 'RENAME_DECK'; deckId: string; name: string }
  | { type: 'ADD_CARD'; deckId: string | null; card: TrackedCard }
  | { type: 'REMOVE_CARD'; deckId: string | null; tcgId: string }
  | { type: 'SET_COLLECTED'; deckId: string | null; tcgId: string; value: number }
  | { type: 'SET_NEEDED'; deckId: string | null; tcgId: string; value: number }
  | { type: 'RESET_COLLECTED'; deckId: string | null };
