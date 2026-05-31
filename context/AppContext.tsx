'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { AppState, AppAction, AppSettings, TrackedCard } from '@/types';
import { loadState, saveState } from '@/services/storage';
import { refreshCardPrices } from '@/services/pokemonTcg';

const DEFAULT_SETTINGS: AppSettings = {
  searchSortOrder: 'asc',
  defaultCardFilter: 'all',
  defaultDeckFormat: null,
  favoriteFormats: ['standard', 'expanded'],
};

const DEFAULT: AppState = { decks: [], standaloneCards: [], settings: DEFAULT_SETTINGS };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...action.payload,
        settings: { ...DEFAULT_SETTINGS, ...(action.payload.settings ?? {}) },
      };

    case 'CREATE_DECK':
      return {
        ...state,
        decks: [
          ...state.decks,
          { id: crypto.randomUUID(), name: action.name, cards: [], createdAt: Date.now(), format: action.format },
        ],
      };

    case 'SET_DECK_FORMAT':
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === action.deckId
            ? { ...d, format: action.format ?? undefined }
            : d
        ),
      };

    case 'DELETE_DECK':
      return { ...state, decks: state.decks.filter((d) => d.id !== action.deckId) };

    case 'RENAME_DECK':
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === action.deckId ? { ...d, name: action.name } : d
        ),
      };

    case 'ADD_CARD': {
      if (action.deckId === null) {
        const exists = state.standaloneCards.some((c) => c.tcgId === action.card.tcgId);
        if (exists) return state;
        return { ...state, standaloneCards: [...state.standaloneCards, action.card] };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          const exists = d.cards.some((c) => c.tcgId === action.card.tcgId);
          if (exists) return d;
          return { ...d, cards: [...d.cards, action.card] };
        }),
      };
    }

    case 'REMOVE_CARD': {
      if (action.deckId === null) {
        return {
          ...state,
          standaloneCards: state.standaloneCards.filter((c) => c.tcgId !== action.tcgId),
        };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          return { ...d, cards: d.cards.filter((c) => c.tcgId !== action.tcgId) };
        }),
      };
    }

    case 'SET_COLLECTED': {
      const clamp = (c: TrackedCard) =>
        c.tcgId === action.tcgId
          ? { ...c, collected: Math.max(0, Math.min(action.value, c.needed)) }
          : c;
      if (action.deckId === null) {
        return { ...state, standaloneCards: state.standaloneCards.map(clamp) };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          return { ...d, cards: d.cards.map(clamp) };
        }),
      };
    }

    case 'ADJUST_COLLECTED': {
      const adjust = (c: TrackedCard) =>
        c.tcgId === action.tcgId
          ? { ...c, collected: Math.max(0, Math.min(c.collected + action.delta, c.needed)) }
          : c;
      if (action.deckId === null) {
        return { ...state, standaloneCards: state.standaloneCards.map(adjust) };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          return { ...d, cards: d.cards.map(adjust) };
        }),
      };
    }

    case 'SET_NEEDED': {
      const update = (c: TrackedCard) =>
        c.tcgId === action.tcgId
          ? { ...c, needed: Math.max(1, action.value), collected: Math.min(c.collected, Math.max(1, action.value)) }
          : c;
      if (action.deckId === null) {
        return { ...state, standaloneCards: state.standaloneCards.map(update) };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          return { ...d, cards: d.cards.map(update) };
        }),
      };
    }

    case 'RESET_COLLECTED': {
      const reset = (c: TrackedCard) => ({ ...c, collected: 0 });
      if (action.deckId === null) {
        return { ...state, standaloneCards: state.standaloneCards.map(reset) };
      }
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== action.deckId) return d;
          return { ...d, cards: d.cards.map(reset) };
        }),
      };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case 'UPDATE_CARD_PRICES': {
      const priceMap = new Map(action.updates.map((u) => [u.tcgId, u]));
      const applyPrices = (c: TrackedCard) => {
        const p = priceMap.get(c.tcgId);
        if (!p) return c;
        return {
          ...c,
          ...(p.lowPrice != null ? { cardmarketLowPrice: p.lowPrice } : {}),
          ...(p.avg30 != null ? { cardmarketAvg30: p.avg30 } : {}),
          ...(p.imageSmall ? { imageSmall: p.imageSmall } : {}),
          ...(p.imageLarge ? { imageLarge: p.imageLarge } : {}),
          ...(p.setSymbol ? { setSymbol: p.setSymbol } : {}),
        };
      };
      return {
        ...state,
        pricesLastUpdated: action.timestamp,
        decks: state.decks.map((d) => ({ ...d, cards: d.cards.map(applyPrices) })),
        standaloneCards: state.standaloneCards.map(applyPrices),
      };
    }

    case 'MOVE_TO_STANDALONE': {
      const sourceDeck = state.decks.find((d) => d.id === action.deckId);
      const card = sourceDeck?.cards.find((c) => c.tcgId === action.tcgId);
      if (!card) return state;
      const alreadyStandalone = state.standaloneCards.some((c) => c.tcgId === action.tcgId);
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === action.deckId
            ? { ...d, cards: d.cards.filter((c) => c.tcgId !== action.tcgId) }
            : d
        ),
        standaloneCards: alreadyStandalone
          ? state.standaloneCards
          : [...state.standaloneCards, { ...card, collected: 0 }],
      };
    }

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    const loaded = loadState();
    dispatch({ type: 'LOAD', payload: loaded });

    const staleAfter = 24 * 60 * 60 * 1000;
    const age = Date.now() - (loaded.pricesLastUpdated ?? 0);
    const allCards = [
      ...loaded.standaloneCards,
      ...loaded.decks.flatMap((d) => d.cards),
    ];
    const uniqueIds = [...new Set(allCards.map((c) => c.tcgId))];
    const needsAssetRefresh =
      uniqueIds.length > 0 &&
      (age > staleAfter || allCards.some((c) => !c.imageSmall || !c.setSymbol));

    if (needsAssetRefresh) {
      refreshCardPrices(uniqueIds).then((updates) => {
          if (updates.length > 0) {
          dispatch({ type: 'UPDATE_CARD_PRICES', updates, timestamp: Date.now() });
        }
      });
    }
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function useDecks() {
  const { state, dispatch } = useAppContext();

  const createDeck = useCallback(
    (name: string, format?: string) => dispatch({ type: 'CREATE_DECK', name, format }),
    [dispatch]
  );
  const deleteDeck = useCallback(
    (deckId: string) => dispatch({ type: 'DELETE_DECK', deckId }),
    [dispatch]
  );
  const renameDeck = useCallback(
    (deckId: string, name: string) => dispatch({ type: 'RENAME_DECK', deckId, name }),
    [dispatch]
  );

  return { decks: state.decks, createDeck, deleteDeck, renameDeck };
}

export function useCardActions(deckId: string | null) {
  const { dispatch } = useAppContext();

  const addCard = useCallback(
    (card: TrackedCard) => dispatch({ type: 'ADD_CARD', deckId, card }),
    [dispatch, deckId]
  );
  const removeCard = useCallback(
    (tcgId: string) => dispatch({ type: 'REMOVE_CARD', deckId, tcgId }),
    [dispatch, deckId]
  );
  const setCollected = useCallback(
    (tcgId: string, value: number) => dispatch({ type: 'SET_COLLECTED', deckId, tcgId, value }),
    [dispatch, deckId]
  );
  const adjustCollected = useCallback(
    (tcgId: string, delta: 1 | -1) => dispatch({ type: 'ADJUST_COLLECTED', deckId, tcgId, delta }),
    [dispatch, deckId]
  );
  const setNeeded = useCallback(
    (tcgId: string, value: number) => dispatch({ type: 'SET_NEEDED', deckId, tcgId, value }),
    [dispatch, deckId]
  );
  const resetCollected = useCallback(
    () => dispatch({ type: 'RESET_COLLECTED', deckId }),
    [dispatch, deckId]
  );

  return { addCard, removeCard, setCollected, adjustCollected, setNeeded, resetCollected };
}
