import type { AppState, TrackedCard } from '@/types';
import { fixStoredCardImageUrl, fixStoredSymbolUrl } from '@/services/tcgAssets';

const KEY = 'pkmn-tcg-track-v1';

function migrateCard(card: TrackedCard): TrackedCard {
  return {
    ...card,
    setSymbol: fixStoredSymbolUrl(card.setSymbol),
    imageSmall: fixStoredCardImageUrl(card.imageSmall) ?? card.imageSmall,
    imageLarge: fixStoredCardImageUrl(card.imageLarge) ?? card.imageLarge,
  };
}

function migrateState(state: AppState): AppState {
  return {
    ...state,
    decks: state.decks.map((d) => ({
      ...d,
      cards: d.cards.map(migrateCard),
    })),
    standaloneCards: state.standaloneCards.map(migrateCard),
  };
}

const DEFAULT: AppState = {
  decks: [],
  standaloneCards: [],
  settings: { searchSortOrder: 'asc', defaultCardFilter: 'all', defaultDeckFormat: null, favoriteFormats: ['standard', 'expanded'] },
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return migrateState({ ...DEFAULT, ...parsed });
  } catch {
    return DEFAULT;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded — fail silently
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
