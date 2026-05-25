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
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
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
  const cmHref = card.cardmarket?.url
    ? `${card.cardmarket.url}?language=1&minCondition=4`
    : undefined;
  const priceText = [
    lowPrice != null ? `€${lowPrice.toFixed(2)}` : null,
    avg30 != null ? `€${avg30.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join('/');

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border">
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
        {priceText && (
          cmHref ? (
            <a
              href={cmHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-zinc-400 underline underline-offset-2 decoration-zinc-600 touch-manipulation"
            >
              {priceText}
            </a>
          ) : (
            <span className="text-[11px] text-zinc-500">{priceText}</span>
          )
        )}
      </div>
      <button
        onClick={() => onSelect(card)}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-white text-zinc-900 active:bg-zinc-200 touch-manipulation"
      >
        Add
      </button>
    </div>
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
