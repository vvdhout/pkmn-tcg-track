'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePokemonSearch } from '@/hooks/usePokemonSearch';
import type { TcgCard } from '@/types';

interface CardSearchProps {
  onSelect: (card: TcgCard) => void;
  excludeIds?: string[];
}

export function CardSearch({ onSelect, excludeIds = [] }: CardSearchProps) {
  const { query, setQuery, results, loading, error, clear } = usePokemonSearch();
  const [popupCard, setPopupCard] = useState<TcgCard | null>(null);
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
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
          <SearchResult
            key={card.id}
            card={card}
            onSelect={onSelect}
            onImageClick={setPopupCard}
          />
        ))}
      </div>

      <SearchImagePopup
        card={popupCard}
        onClose={() => setPopupCard(null)}
        onAdd={(card) => { onSelect(card); setPopupCard(null); }}
      />
    </div>
  );
}

function SearchResult({
  card,
  onSelect,
  onImageClick,
}: {
  card: TcgCard;
  onSelect: (c: TcgCard) => void;
  onImageClick: (c: TcgCard) => void;
}) {
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
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-app-border active:bg-app-elevated touch-manipulation"
      onClick={() => onImageClick(card)}
    >
      <Image
        src={card.images.small}
        alt={card.name}
        width={36}
        height={50}
        className="w-9 h-[50px] rounded object-cover flex-shrink-0"
        unoptimized
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-sm font-medium text-zinc-100 truncate">{card.name}</p>
        <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
          {card.set.images?.symbol && (
            <Image
              src={card.set.images.symbol}
              alt=""
              width={13}
              height={13}
              className="w-[13px] h-[13px] object-contain opacity-60 flex-shrink-0"
              unoptimized
            />
          )}
          <span className="truncate">{card.set.name} · {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')}</span>
        </div>
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
        onClick={(e) => { e.stopPropagation(); onSelect(card); }}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white text-zinc-900 text-lg leading-none active:bg-zinc-200 touch-manipulation"
        aria-label="Add card"
      >
        +
      </button>
    </div>
  );
}

function SearchImagePopup({
  card,
  onClose,
  onAdd,
}: {
  card: TcgCard | null;
  onClose: () => void;
  onAdd: (card: TcgCard) => void;
}) {
  useEffect(() => {
    if (!card) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [card, onClose]);

  if (!card) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg active:bg-zinc-700 touch-manipulation"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <Image
          src={card.images.large}
          alt={card.name}
          width={420}
          height={588}
          className="w-full h-auto rounded-lg shadow-2xl"
          unoptimized
          priority
        />
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-zinc-100">{card.name}</p>
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-500">
            {card.set.images?.symbol && (
              <Image
                src={card.set.images.symbol}
                alt=""
                width={13}
                height={13}
                className="w-[13px] h-[13px] object-contain opacity-60"
                unoptimized
              />
            )}
            <span>{card.set.id.toUpperCase()}-{card.number.padStart(3, '0')} · {card.set.name}</span>
          </div>
          {priceText && (
            cmHref ? (
              <a
                href={cmHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 underline underline-offset-2 decoration-zinc-600 mt-1 inline-block"
              >
                {priceText}
              </a>
            ) : (
              <span className="text-xs text-zinc-500 mt-1 inline-block">{priceText}</span>
            )
          )}
        </div>
        <button
          onClick={() => onAdd(card)}
          className="mt-3 w-full py-2.5 text-sm font-medium bg-white text-zinc-900 active:bg-zinc-200 touch-manipulation"
        >
          Add card
        </button>
      </div>
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
