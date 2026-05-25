'use client';

import type { CardFilter } from '@/types';

const FILTERS: { id: CardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trainer', label: 'Trainers' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'missing', label: 'Missing' },
  { id: 'complete', label: 'Complete' },
];

interface FilterTabsProps {
  active: CardFilter;
  onChange: (f: CardFilter) => void;
  onReset: () => void;
}

export function FilterTabs({ active, onChange, onReset }: FilterTabsProps) {
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
