'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { TcgCard } from '@/types';
import { searchCards, type SearchOptions } from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

interface ScannedRaw {
  name: string;
  quantity: number;
  setCode: string | null;
  number: string | null;
}

interface CardScannerProps {
  onSelect: (card: TcgCard) => void;
  onBack: () => void;
}

type Phase = 'idle' | 'processing' | 'hub' | 'results';

export function CardScanner({ onSelect, onBack }: CardScannerProps) {
  const { state } = useAppContext();
  const searchOptions: SearchOptions = {
    sortOrder: state.settings.searchSortOrder,
    setDateFrom: state.settings.setRangeFrom?.releaseDate,
    setDateTo: state.settings.setRangeTo?.releaseDate,
  };

  const [phase, setPhase] = useState<Phase>('idle');
  const [scannedCards, setScannedCards] = useState<ScannedRaw[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase('idle');
    setScannedCards([]);
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
      setActiveIndex(0);
      setPhase('results');
    } else {
      setPhase('hub');
    }
  }

  /* ── Processing ── */
  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Analyzing cards…</p>
      </div>
    );
  }

  /* ── Hub — multiple cards identified ── */
  if (phase === 'hub') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
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
        <div className="flex-1 overflow-y-auto">
          {scannedCards.map((raw, i) => (
            <button
              key={i}
              onClick={() => { setActiveIndex(i); setPhase('results'); }}
              className="w-full flex items-center justify-between px-4 py-4 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
            >
              <div className="min-w-0">
                <p className="text-sm text-zinc-100 truncate">{raw.name}</p>
                {raw.quantity > 1 && (
                  <p className="text-[11px] text-zinc-500">×{raw.quantity}</p>
                )}
              </div>
              <ChevronRightIcon />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Results — search results for the identified card ── */
  if (phase === 'results') {
    const raw = scannedCards[activeIndex];
    return (
      <ScanResultsSearch
        initialQuery={raw?.name ?? ''}
        options={searchOptions}
        onSelect={onSelect}
        onBack={scannedCards.length > 1 ? () => setPhase('hub') : onBack}
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

/* ── Search results view (same look as CardSearch results) ── */

function ScanResultsSearch({
  initialQuery,
  options,
  onSelect,
  onBack,
}: {
  initialQuery: string;
  options: SearchOptions;
  onSelect: (card: TcgCard) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [popupCard, setPopupCard] = useState<TcgCard | null>(null);

  // Debounced search on query change
  useEffect(() => {
    const q = query.trim();
    if (!q) { setCards([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchCards(q, 1, options);
        setCards(results);
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  // options is stable per render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Kick off immediately with the scanned name
  useEffect(() => {
    if (!initialQuery.trim()) return;
    setLoading(true);
    searchCards(initialQuery.trim(), 1, options)
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              autoFocus
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
              onSelect={onSelect}
              onImageClick={setPopupCard}
            />
          ))}
        </div>
      </div>

      {/* Full-image popup */}
      {popupCard && (
        <ScanImagePopup
          card={popupCard}
          onClose={() => setPopupCard(null)}
          onAdd={(card) => { onSelect(card); setPopupCard(null); }}
        />
      )}
    </>
  );
}

/* ── Search result row (identical layout to CardSearch's SearchResult) ── */

function ScanSearchResult({
  card,
  onSelect,
  onImageClick,
}: {
  card: TcgCard;
  onSelect: (card: TcgCard) => void;
  onImageClick: (card: TcgCard) => void;
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

/* ── Image popup (same as CardSearch's SearchImagePopup) ── */

function ScanImagePopup({
  card,
  onClose,
  onAdd,
}: {
  card: TcgCard;
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
