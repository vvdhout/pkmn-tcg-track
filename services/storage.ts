import type { AppState } from '@/types';

const KEY = 'pkmn-tcg-track-v1';

const DEFAULT: AppState = {
  decks: [],
  standaloneCards: [],
  settings: { searchSortOrder: 'asc', setRangeFrom: null, setRangeTo: null, defaultCardFilter: 'all' },
};

export function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...DEFAULT, ...parsed };
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
