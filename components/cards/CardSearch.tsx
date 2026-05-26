'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePokemonSearch } from '@/hooks/usePokemonSearch';
import { getFormat } from '@/services/formats';
import { FormatPicker } from '@/components/formats/FormatPicker';
import type { TcgCard } from '@/types';
import { CardScanner } from './CardScanner';

type NavImage = { base64: string; mediaType: string };

interface CardSearchProps {
  onSelect: (card: TcgCard) => void;
  onSelectMultiple?: (cards: { card: TcgCard; needed: number }[]) => void;
  excludeIds?: string[];
  formatIds?: string[];
  onChangeFormatIds?: (ids: string[]) => void;
  pendingImage?: NavImage | null;
}

export function CardSearch({ onSelect, onSelectMultiple, excludeIds = [], formatIds, onChangeFormatIds, pendingImage }: CardSearchProps) {
  const { query, setQuery, results, loading, error, clear } = usePokemonSearch(formatIds ? { formatIds } : undefined);
  const [popupCard, setPopupCard] = useState<TcgCard | null>(null);
  const [mode, setMode] = useState<'search' | 'scan'>('search');
  const inputRef = useRef<HTMLInputElement>(null);

  // On mount: BottomNav already opened the keyboard by focusing a trap input,
  // so transferring focus here (keyboard already open) works on iOS.
  // Also listens for re-taps when the search page is already active.
  useEffect(() => {
    inputRef.current?.focus();
    function onFocusRequest() { inputRef.current?.focus(); }
    window.addEventListener('search-focus-request', onFocusRequest);
    return () => window.removeEventListener('search-focus-request', onFocusRequest);
  }, []);

  // Switch to scan mode as soon as a nav-captured image arrives
  useEffect(() => {
    if (pendingImage) setMode('scan');
  }, [pendingImage]);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const filtered = results.filter((c) => !excludeIds.includes(c.id));

  const hasFormatRow = onChangeFormatIds !== undefined || (!!formatIds && formatIds.length > 0);
  const formatLabel =
    formatIds && formatIds.length > 0
      ? formatIds.length < 4
        ? formatIds.map((id) => getFormat(id)?.name ?? id).join(' · ')
        : `${formatIds.length} formats`
      : 'All sets';

  if (mode === 'scan') {
    return (
      <div className="flex flex-col h-full">
        <CardScanner
          onSelect={onSelect}
          onSelectMultiple={onSelectMultiple}
          onBack={() => setMode('search')}
          formatIds={formatIds}
          pendingImage={pendingImage}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search input row */}
      <div className="px-3 py-3 border-b border-app-border flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
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
        {/* Scan button */}
        <button
          onClick={() => setMode('scan')}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded bg-app-elevated border border-app-border text-zinc-400 active:bg-app-muted touch-manipulation"
          aria-label="Scan cards"
        >
          <CameraIcon />
        </button>
      </div>

      {/* Format indicator row */}
      {hasFormatRow && (
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-b border-app-border">
          {onChangeFormatIds ? (
            <>
              <button
                onClick={() => setShowFormatPicker(true)}
                className="flex items-center gap-1 touch-manipulation"
              >
                <span className={`text-[11px] ${formatIds && formatIds.length > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {formatLabel}
                </span>
                <ChevronDownIcon />
              </button>
              {formatIds && formatIds.length > 0 && (
                <button
                  onClick={() => onChangeFormatIds([])}
                  className="text-zinc-600 active:text-zinc-400 touch-manipulation leading-none text-base"
                  aria-label="Clear format filter"
                >
                  ×
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-zinc-500">{formatLabel}</span>
          )}
        </div>
      )}

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

      {showFormatPicker && onChangeFormatIds && (
        <FormatPicker
          multiSelect
          selectedFormatIds={formatIds ?? []}
          onApply={(ids) => { onChangeFormatIds(ids); setShowFormatPicker(false); }}
          onClose={() => setShowFormatPicker(false)}
        />
      )}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
