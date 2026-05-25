'use client';

import Image from 'next/image';
import { usePokemonSearch } from '@/hooks/usePokemonSearch';
import type { TcgCard } from '@/types';

interface CardSearchProps {
  onSelect: (card: TcgCard) => void;
  excludeIds?: string[];
}

export function CardSearch({ onSelect, excludeIds = [] }: CardSearchProps) {
  const { query, setQuery, results, loading, error, clear } = usePokemonSearch();
  const filtered = results.filter((c) => !excludeIds.includes(c.id));

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-3 py-3 border-b border-app-border">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <SearchIcon />
          </div>
          <input
            autoFocus
            type="search"
            inputMode="search"
            placeholder="Search cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2.5 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 touch-manipulation"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-green-400 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-red-400 px-4 py-8">{error}</p>
        )}
        {!loading && !error && query && filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-500 px-4 py-8">No cards found</p>
        )}
        {!loading && !query && (
          <p className="text-center text-sm text-zinc-600 px-4 py-8">Type to search cards</p>
        )}
        {filtered.map((card) => (
          <SearchResult key={card.id} card={card} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SearchResult({ card, onSelect }: { card: TcgCard; onSelect: (c: TcgCard) => void }) {
  const prices = card.cardmarket?.prices;
  const lowPrice =
    prices?.lowPriceExPlus != null && prices.lowPriceExPlus > 0
      ? prices.lowPriceExPlus
      : prices?.lowPrice;
  const avg30 = prices?.avg30;

  return (
    <button
      onClick={() => onSelect(card)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
    >
      <Image
        src={card.images.small}
        alt={card.name}
        width={36}
        height={50}
        className="w-9 h-[50px] rounded object-cover flex-shrink-0"
        unoptimized
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate">{card.name}</p>
        <p className="text-[11px] text-zinc-500 truncate">
          {card.set.name} · {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')}
        </p>
        {(lowPrice != null || avg30 != null) && (
          <p className="text-[11px] text-zinc-500">
            {[lowPrice != null ? `€${lowPrice.toFixed(2)}` : null, avg30 != null ? `€${avg30.toFixed(2)}` : null].filter(Boolean).join('/')}
          </p>
        )}
      </div>
      <span className="text-[10px] text-zinc-600 font-medium uppercase flex-shrink-0">
        {card.supertype[0]}
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
