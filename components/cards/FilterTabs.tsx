'use client';

import type { CardFilter } from '@/types';

export type SortMode = 'default' | 'price-asc' | 'price-desc';

const FILTERS: { id: CardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trainer', label: 'Trainers' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'energy', label: 'Energy' },
  { id: 'missing', label: 'Missing' },
  { id: 'complete', label: 'Complete' },
];

interface FilterTabsProps {
  active: CardFilter;
  onChange: (f: CardFilter) => void;
  onReset: () => void;
  sortMode?: SortMode;
  onSortChange?: (m: SortMode) => void;
}

export function FilterTabs({ active, onChange, onReset, sortMode = 'default', onSortChange }: FilterTabsProps) {
  function cycleSortMode() {
    if (!onSortChange) return;
    if (sortMode === 'default') onSortChange('price-desc');
    else if (sortMode === 'price-desc') onSortChange('price-asc');
    else onSortChange('default');
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border touch-manipulation transition-colors ${
            active === f.id
              ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
              : 'bg-transparent border-zinc-700 text-zinc-400'
          }`}
        >
          {f.label}
        </button>
      ))}
      {onSortChange && (
        <button
          onClick={cycleSortMode}
          className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium border touch-manipulation transition-colors ${
            sortMode !== 'default'
              ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
              : 'bg-transparent border-zinc-700 text-zinc-400'
          }`}
        >
          <PriceIcon />
          {sortMode === 'price-desc' ? '↓' : sortMode === 'price-asc' ? '↑' : ''}
        </button>
      )}
      <button
        onClick={onReset}
        className="flex-shrink-0 ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border border-zinc-700 text-zinc-400 touch-manipulation active:bg-zinc-800"
      >
        <ResetIcon />
        Reset
      </button>
    </div>
  );
}

function PriceIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 3v.8M6 8.2V9M4.5 7.2c0 .66.67 1 1.5 1s1.5-.44 1.5-1c0-1.4-3-1-3-2.4 0-.56.67-1 1.5-1s1.5.34 1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M10 6A4 4 0 112 6a4 4 0 014-4 3.99 3.99 0 013 1.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9 2v2.5H6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
