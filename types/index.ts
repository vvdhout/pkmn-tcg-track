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
    images?: { symbol?: string; logo?: string };
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
  setSymbol?: string;
  cardmarketUrl?: string;
  cardmarketLowPrice?: number;
  cardmarketAvg30?: number;
  collected: number;
  needed: number;
}

export interface TcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  images?: { symbol?: string; logo?: string };
}

export interface SetRef {
  id: string;
  name: string;
  releaseDate: string; // YYYY/MM/DD
}

export interface AppSettings {
  searchSortOrder: 'asc' | 'desc'; // 'asc' = oldest first
  defaultCardFilter: 'all' | 'missing';
  defaultDeckFormat: string | null;
  favoriteFormats: string[];
}

export interface Deck {
  id: string;
  name: string;
  cards: TrackedCard[];
  createdAt: number;
  format?: string; // format id from services/formats.ts
}

export interface AppState {
  decks: Deck[];
  standaloneCards: TrackedCard[];
  settings: AppSettings;
  pricesLastUpdated?: number;
}

export type CardFilter = 'all' | 'pokemon' | 'trainer' | 'energy' | 'missing' | 'complete';

export type AppAction =
  | { type: 'LOAD'; payload: AppState }
  | { type: 'CREATE_DECK'; name: string; format?: string }
  | { type: 'DELETE_DECK'; deckId: string }
  | { type: 'RENAME_DECK'; deckId: string; name: string }
  | { type: 'ADD_CARD'; deckId: string | null; card: TrackedCard }
  | { type: 'REMOVE_CARD'; deckId: string | null; tcgId: string }
  | { type: 'SET_COLLECTED'; deckId: string | null; tcgId: string; value: number }
  | { type: 'ADJUST_COLLECTED'; deckId: string | null; tcgId: string; delta: 1 | -1 }
  | { type: 'SET_NEEDED'; deckId: string | null; tcgId: string; value: number }
  | { type: 'RESET_COLLECTED'; deckId: string | null }
  | { type: 'MOVE_TO_STANDALONE'; deckId: string; tcgId: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | {
      type: 'UPDATE_CARD_PRICES';
      updates: {
        tcgId: string;
        lowPrice?: number;
        avg30?: number;
        imageSmall?: string;
        imageLarge?: string;
        setSymbol?: string;
      }[];
      timestamp: number;
    }
  | { type: 'SET_DECK_FORMAT'; deckId: string; format: string | null };
