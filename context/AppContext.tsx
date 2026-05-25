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
import type { AppState, AppAction, TrackedCard } from '@/types';
import { loadState, saveState } from '@/services/storage';

const DEFAULT: AppState = { decks: [], standaloneCards: [] };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'CREATE_DECK':
      return {
        ...state,
        decks: [
          ...state.decks,
          { id: crypto.randomUUID(), name: action.name, cards: [], createdAt: Date.now() },
        ],
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
  const [state, dispatch] = useReducer(reducer, DEFAULT);

  useEffect(() => {
    dispatch({ type: 'LOAD', payload: loadState() });
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
    (name: string) => dispatch({ type: 'CREATE_DECK', name }),
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
  const setNeeded = useCallback(
    (tcgId: string, value: number) => dispatch({ type: 'SET_NEEDED', deckId, tcgId, value }),
    [dispatch, deckId]
  );
  const resetCollected = useCallback(
    () => dispatch({ type: 'RESET_COLLECTED', deckId }),
    [dispatch, deckId]
  );

  return { addCard, removeCard, setCollected, setNeeded, resetCollected };
}
