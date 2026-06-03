'use client';

import { useState, useRef, useEffect } from 'react';
import { TcgAssetImage } from '@/components/cards/TcgAssetImage';
import { cardmarketLinkHref } from '@/services/tcgAssets';
import type { TcgCard } from '@/types';
import { findCards, type SearchOptions } from '@/services/pokemonTcg';
import { usePokemonSearch } from '@/hooks/usePokemonSearch';
import { useAppContext } from '@/context/AppContext';
import { FormatPicker } from '@/components/formats/FormatPicker';
import { formatFilterLabel } from '@/services/formats';

interface ScannedRaw {
  name: string;
  quantity: number;
  setCode: string | null;
  number: string | null;
}

type NavImage = { base64: string; mediaType: string };

interface CardScannerProps {
  onSelect: (card: TcgCard) => void;
  onSelectMultiple?: (cards: { card: TcgCard; needed: number }[]) => void;
  onBack: () => void;
  formatIds?: string[];
  pendingImage?: NavImage | null;
}

type Phase = 'idle' | 'processing' | 'hub' | 'results';

export function CardScanner({ onSelect, onSelectMultiple, onBack, formatIds, pendingImage }: CardScannerProps) {
  const { state } = useAppContext();
  const searchOptions: SearchOptions = {
    sortOrder: state.settings.searchSortOrder,
    formatIds,
  };

  const [phase, setPhase] = useState<Phase>('idle');
  const [scannedCards, setScannedCards] = useState<ScannedRaw[]>([]);
  const [selectedCards, setSelectedCards] = useState<(TcgCard | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-process an image captured by the nav swipe-up gesture
  useEffect(() => {
    if (!pendingImage) return;
    setPhase('processing');
    runScan({ imageBase64: pendingImage.base64, mediaType: pendingImage.mediaType });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setPhase('idle');
    setScannedCards([]);
    setSelectedCards([]);
    setActiveIndex(0);
    setError(null);
  }

  async function handleFile(file: File) {
    setError(null);
    setPhase('processing');
    try {
      const { base64, mediaType } = await compressImage(file);
      await runScan({ imageBase64: base64, mediaType });
    } catch {
      setError('Failed to process image. Please try again.');
      setPhase('idle');
    }
  }

  async function handleTextScan() {
    if (!textInput.trim()) return;
    setError(null);
    setPhase('processing');
    try {
      await runScan({ text: textInput });
    } catch {
      setError('Failed to analyze list. Please try again.');
      setPhase('idle');
    }
  }

  async function runScan(payload: { imageBase64?: string; mediaType?: string; text?: string }) {
    const res = await fetch('/api/scan-cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      setError((err as { error?: string }).error ?? 'Scan failed. Please try again.');
      setPhase('idle');
      return;
    }

    const data = await res.json() as { cards?: ScannedRaw[] };
    const scanned = data.cards ?? [];

    if (scanned.length === 0) {
      setError('No cards identified. Try a clearer photo or a different list format.');
      setPhase('idle');
      return;
    }

    setScannedCards(scanned);

    if (scanned.length === 1) {
      setSelectedCards([null]);
      setActiveIndex(0);
      setPhase('results');
      return;
    }

    // Auto-resolve cards that have exactly one version across the entire TCG.
    // Search by name only so AI-hallucinated set codes / numbers don't falsely
    // narrow results to a single wrong card.
    const autoSelected = await Promise.all(
      scanned.map(async (raw) => {
        try {
          const results = await findCards(raw.name, null, null, searchOptions);
          return results.length === 1 ? results[0] : null;
        } catch {
          return null;
        }
      })
    );

    setSelectedCards(autoSelected);
    setPhase('hub');
  }

  // Called from hub to navigate into a card's results
  function openResults(index: number) {
    setActiveIndex(index);
    setPhase('results');
  }

  // Called from results view when user picks a version (multi-card mode)
  function handleMultiSelect(card: TcgCard) {
    setSelectedCards((prev) => {
      const next = [...prev];
      next[activeIndex] = card;
      return next;
    });
    setPhase('hub');
  }

  // Called from hub to add all selected cards
  function handleAddAll() {
    const toAdd = selectedCards
      .map((c, i) => c !== null ? { card: c, needed: scannedCards[i].quantity } : null)
      .filter((x): x is { card: TcgCard; needed: number } => x !== null);
    if (onSelectMultiple) {
      onSelectMultiple(toAdd);
    } else {
      toAdd.forEach(({ card }) => onSelect(card));
    }
  }

  const addableCount = selectedCards.filter((c) => c !== null).length;

  /* ── Processing ── */
  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Analyzing cards…</p>
      </div>
    );
  }

  /* ── Hub — multiple cards, each with optional selection ── */
  if (phase === 'hub') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-app-border">
          <button
            onClick={reset}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation flex-shrink-0"
            aria-label="Scan again"
          >
            <BackArrowIcon />
          </button>
          <p className="text-sm font-semibold text-zinc-100">
            {scannedCards.length} cards identified
          </p>
        </div>

        {/* Card rows */}
        <div className="flex-1 overflow-y-auto">
          {scannedCards.map((raw, i) => {
            const selected = selectedCards[i];
            return (
              <button
                key={i}
                onClick={() => openResults(i)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
              >
                {selected ? (
                  /* Selected — show thumbnail + set info */
                  <>
                    <TcgAssetImage
                      src={selected.images.small}
                      kind="card-small"
                      alt={selected.name}
                      width={32}
                      height={44}
                      className="w-8 h-11 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <p className="text-sm text-zinc-100 truncate">{selected.name}</p>
                        {raw.quantity > 1 && (
                          <span className="text-[11px] text-zinc-500 flex-shrink-0">×{raw.quantity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                        {selected.set.images?.symbol && (
                          <TcgAssetImage
                            src={selected.set.images.symbol}
                            kind="set-symbol"
                            alt=""
                            width={11}
                            height={11}
                            className="w-[11px] h-[11px] object-contain opacity-60 flex-shrink-0"
                          />
                        )}
                        <span className="truncate">
                          {selected.set.id.toUpperCase()}-{selected.number.padStart(3, '0')} · {selected.set.name}
                        </span>
                      </div>
                    </div>
                    <CheckIcon />
                  </>
                ) : (
                  /* Not yet selected */
                  <>
                    <div className="w-8 h-11 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">{raw.name}</p>
                      {raw.quantity > 1 && (
                        <p className="text-[11px] text-zinc-600">×{raw.quantity}</p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 flex-shrink-0">Choose</span>
                    <ChevronRightIcon />
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Add button — appears once at least one card is selected */}
        {addableCount > 0 && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-app-border">
            <button
              onClick={handleAddAll}
              className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900 active:bg-zinc-200 touch-manipulation"
            >
              Add {addableCount} card{addableCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── Results — search results for the identified card ── */
  if (phase === 'results') {
    const raw = scannedCards[activeIndex];
    const isMultiCard = scannedCards.length > 1;
    return (
      <ScanResultsSearch
        initialQuery={raw?.name ?? ''}
        options={searchOptions}
        isMultiCard={isMultiCard}
        onSelect={isMultiCard ? handleMultiSelect : onSelect}
        onBack={isMultiCard ? () => setPhase('hub') : onBack}
      />
    );
  }

  /* ── Idle ── */
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-4">
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-2.5 rounded">
          {error}
        </p>
      )}

      {/* Photo / image upload */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-app-border rounded active:bg-app-elevated touch-manipulation"
      >
        <CameraIcon />
        <span className="text-sm font-medium text-zinc-300">Take photo or upload image</span>
        <span className="text-xs text-zinc-600 text-center px-4">
          Photo of cards, binder page, screenshot — Claude will read what&apos;s there
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-app-border" />
        <span className="text-xs text-zinc-600">or paste a card list</span>
        <div className="flex-1 h-px bg-app-border" />
      </div>

      {/* Text / list input */}
      <div className="flex flex-col gap-2">
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={"4x Charizard ex sv1\n2x Pikachu 045/198\nRaikou V swsh12"}
          rows={5}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full px-3 py-2.5 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600 resize-none"
        />
        <button
          onClick={handleTextScan}
          disabled={!textInput.trim()}
          className={`w-full py-2.5 text-sm font-semibold touch-manipulation ${
            textInput.trim()
              ? 'bg-white text-zinc-900 active:bg-zinc-200'
              : 'bg-zinc-800 text-zinc-600'
          }`}
        >
          Analyze list
        </button>
      </div>
    </div>
  );
}

/* ── Search results view ── */

function ScanResultsSearch({
  initialQuery,
  options,
  isMultiCard,
  onSelect,
  onBack,
}: {
  initialQuery: string;
  options: SearchOptions;
  isMultiCard: boolean;
  onSelect: (card: TcgCard) => void;
  onBack: () => void;
}) {
  const [formatIds, setFormatIds] = useState<string[]>(options.formatIds ?? []);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const {
    query,
    setQuery,
    results,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  } = usePokemonSearch({
    formatIds: formatIds.length > 0 ? formatIds : undefined,
    initialQuery,
  });
  const [popupCard, setPopupCard] = useState<TcgCard | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'pokemon' | 'trainer' | 'energy'>('all');

  const cards = results.filter((c) => {
    if (typeFilter === 'pokemon') return c.supertype === 'Pokémon';
    if (typeFilter === 'trainer') return c.supertype === 'Trainer';
    if (typeFilter === 'energy') return c.supertype === 'Energy';
    return true;
  });

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header: back + search input */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-b border-app-border">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation flex-shrink-0"
            aria-label="Back"
          >
            <BackArrowIcon />
          </button>
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Card name…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full pl-9 pr-8 py-2.5 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 touch-manipulation"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Format filter — same design as CardSearch */}
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">
            Format filter
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormatPicker(true)}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-app-border bg-app-elevated active:bg-app-muted touch-manipulation"
              aria-label="Change format filter"
            >
              <span className={`text-xs truncate ${formatIds.length > 0 ? 'text-zinc-200' : 'text-zinc-500'}`}>
                {formatFilterLabel(formatIds.length > 0 ? formatIds : undefined)}
              </span>
              <ChevronDownIcon />
            </button>
            {formatIds.length > 0 && (
              <button
                type="button"
                onClick={() => setFormatIds([])}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded border border-app-border text-zinc-500 active:bg-app-muted touch-manipulation"
                aria-label="Clear format filter"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Type filter pills */}
        {query && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-app-border overflow-x-auto scrollbar-none">
            {(['all', 'pokemon', 'trainer', 'energy'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border touch-manipulation transition-colors ${
                  typeFilter === t
                    ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                    : 'bg-transparent border-zinc-700 text-zinc-400'
                }`}
              >
                {t === 'all' ? 'All' : t === 'pokemon' ? 'Pokémon' : t === 'trainer' ? 'Trainers' : 'Energy'}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!loading && query.trim() && cards.length === 0 && (
            <p className="text-center text-sm text-zinc-500 px-4 py-8">No cards found</p>
          )}
          {!loading && !query.trim() && (
            <p className="text-center text-sm text-zinc-600 px-4 py-8">Type to search cards</p>
          )}
          {cards.map((card) => (
            <ScanSearchResult
              key={card.id}
              card={card}
              isMultiCard={isMultiCard}
              onSelect={onSelect}
              onImageClick={setPopupCard}
            />
          ))}
          {!loading && hasMore && cards.length > 0 && (
            <div className="px-4 py-4 border-t border-app-border">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-2.5 text-sm font-medium border border-zinc-700 text-zinc-300 active:bg-app-elevated touch-manipulation disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {popupCard && (
        <ScanImagePopup
          card={popupCard}
          isMultiCard={isMultiCard}
          onClose={() => setPopupCard(null)}
          onAdd={(card) => { onSelect(card); setPopupCard(null); }}
        />
      )}

      {showFormatPicker && (
        <FormatPicker
          multiSelect
          selectedFormatIds={formatIds}
          onApply={(ids) => { setFormatIds(ids); setShowFormatPicker(false); }}
          onClose={() => setShowFormatPicker(false)}
        />
      )}
    </>
  );
}

/* ── Result row ── */

function ScanSearchResult({
  card,
  isMultiCard,
  onSelect,
  onImageClick,
}: {
  card: TcgCard;
  isMultiCard: boolean;
  onSelect: (card: TcgCard) => void;
  onImageClick: (card: TcgCard) => void;
}) {
  const prices = card.cardmarket?.prices;
  const lowPrice =
    prices?.lowPriceExPlus != null && prices.lowPriceExPlus > 0
      ? prices.lowPriceExPlus
      : prices?.lowPrice;
  const avg30 = prices?.avg30;
  const cmHref = cardmarketLinkHref(card.cardmarket?.url);
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
      <TcgAssetImage
        src={card.images.small}
        kind="card-small"
        alt={card.name}
        width={36}
        height={50}
        className="w-9 h-[50px] rounded object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-sm font-medium text-zinc-100 truncate">{card.name}</p>
        <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
          {card.set.images?.symbol && (
            <TcgAssetImage
              src={card.set.images.symbol}
              kind="set-symbol"
              alt=""
              width={13}
              height={13}
              className="w-[13px] h-[13px] object-contain opacity-60 flex-shrink-0"
            />
          )}
          <span className="truncate">
            {card.set.name} · {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')}
          </span>
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

      {isMultiCard ? (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(card); }}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-white text-zinc-900 active:bg-zinc-200 touch-manipulation rounded-sm"
        >
          Select
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(card); }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white text-zinc-900 text-lg leading-none active:bg-zinc-200 touch-manipulation"
          aria-label="Add card"
        >
          +
        </button>
      )}
    </div>
  );
}

/* ── Image popup ── */

function ScanImagePopup({
  card,
  isMultiCard,
  onClose,
  onAdd,
}: {
  card: TcgCard;
  isMultiCard: boolean;
  onClose: () => void;
  onAdd: (card: TcgCard) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const prices = card.cardmarket?.prices;
  const lowPrice =
    prices?.lowPriceExPlus != null && prices.lowPriceExPlus > 0
      ? prices.lowPriceExPlus
      : prices?.lowPrice;
  const avg30 = prices?.avg30;
  const cmHref = cardmarketLinkHref(card.cardmarket?.url);
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
        <TcgAssetImage
          src={card.images.large}
          kind="card-large"
          alt={card.name}
          width={420}
          height={588}
          className="w-full h-auto rounded-lg shadow-2xl"
          priority
        />
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-zinc-100">{card.name}</p>
          <div className="flex items-center justify-center gap-1 text-xs text-zinc-500">
            {card.set.images?.symbol && (
              <TcgAssetImage
                src={card.set.images.symbol}
                kind="set-symbol"
                alt=""
                width={13}
                height={13}
                className="w-[13px] h-[13px] object-contain opacity-60"
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
          {isMultiCard ? 'Select version' : 'Add card'}
        </button>
      </div>
    </div>
  );
}

/* ── Helpers ── */

async function compressImage(
  file: File,
  maxDim = 1024,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        URL.revokeObjectURL(url);
        resolve({ base64, mediaType: 'image/jpeg' });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
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

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-400 flex-shrink-0">
      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
