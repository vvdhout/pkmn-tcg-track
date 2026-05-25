'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { TcgCard } from '@/types';
import { findCards, searchCards } from '@/services/pokemonTcg';

interface ScannedRaw {
  name: string;
  quantity: number;
  setCode: string | null;
  number: string | null;
}

type ResultStatus = 'loading' | 'resolved' | 'ambiguous' | 'not_found';

interface ScanResult {
  id: string;
  raw: ScannedRaw;
  status: ResultStatus;
  candidates: TcgCard[];
  selected: TcgCard | null;
}

interface CardScannerProps {
  onAdd: (cards: { card: TcgCard; needed: number }[]) => void;
  onBack: () => void;
}

type Phase = 'idle' | 'processing' | 'confirming';

export function CardScanner({ onAdd, onBack }: CardScannerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [searchingForId, setSearchingForId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

    // Show loading placeholders immediately
    const loading: ScanResult[] = scanned.map((raw, i) => ({
      id: String(i),
      raw,
      status: 'loading',
      candidates: [],
      selected: null,
    }));
    setResults(loading);
    setPhase('confirming');

    // Resolve each card against the TCG API in parallel
    const resolved = await Promise.all(
      scanned.map(async (raw, i): Promise<ScanResult> => {
        try {
          const candidates = await findCards(raw.name, raw.setCode, raw.number);
          if (candidates.length === 0) {
            return { id: String(i), raw, status: 'not_found', candidates: [], selected: null };
          }
          if (candidates.length === 1) {
            return { id: String(i), raw, status: 'resolved', candidates, selected: candidates[0] };
          }
          // Multiple results — try to find an exact match if we have set+number
          if (raw.setCode && raw.number) {
            const cleanNum = raw.number.replace(/\/.*$/, '').replace(/^0+(\d)/, '$1');
            const exact = candidates.find(
              (c) =>
                c.set.id.toLowerCase() === raw.setCode!.toLowerCase() &&
                c.number === cleanNum,
            );
            if (exact) {
              return { id: String(i), raw, status: 'resolved', candidates: [exact], selected: exact };
            }
          }
          return { id: String(i), raw, status: 'ambiguous', candidates, selected: null };
        } catch {
          return { id: String(i), raw, status: 'not_found', candidates: [], selected: null };
        }
      }),
    );

    setResults(resolved);
  }

  function toggleCandidate(resultId: string, card: TcgCard) {
    setResults((prev) =>
      prev.map((r) =>
        r.id === resultId
          ? { ...r, selected: r.selected?.id === card.id ? null : card }
          : r,
      ),
    );
  }

  function resolveFromSearch(resultId: string, card: TcgCard) {
    setResults((prev) =>
      prev.map((r) =>
        r.id === resultId
          ? { ...r, status: 'resolved', candidates: [card], selected: card }
          : r,
      ),
    );
    setSearchingForId(null);
  }

  function handleAdd() {
    const toAdd = results
      .filter((r) => r.selected != null)
      .map((r) => ({ card: r.selected!, needed: Math.max(1, r.raw.quantity) }));
    onAdd(toAdd);
    setPhase('idle');
    setResults([]);
    setTextInput('');
  }

  const addableCount = results.filter((r) => r.selected != null).length;

  /* ── Processing ── */
  if (phase === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Analyzing cards…</p>
      </div>
    );
  }

  /* ── Confirming — inline search sub-view ── */
  if (phase === 'confirming' && searchingForId !== null) {
    const target = results.find((r) => r.id === searchingForId);
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-app-border">
          <button
            onClick={() => setSearchingForId(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation flex-shrink-0"
            aria-label="Back to results"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-zinc-100 truncate">
            Search for &ldquo;{target?.raw.name}&rdquo;
          </p>
        </div>
        <InlineSearch
          initialQuery={target?.raw.name ?? ''}
          onSelect={(card) => resolveFromSearch(searchingForId, card)}
        />
      </div>
    );
  }

  /* ── Confirming — main results view ── */
  if (phase === 'confirming') {
    const resolvedCount = results.filter((r) => r.status !== 'loading').length;
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-app-border">
          <span className="text-sm font-semibold text-zinc-100">
            {resolvedCount < results.length ? 'Looking up cards…' : `${results.length} card${results.length !== 1 ? 's' : ''} found`}
          </span>
          <button
            onClick={() => { setPhase('idle'); setResults([]); }}
            className="text-xs text-zinc-500 touch-manipulation active:text-zinc-300"
          >
            Scan again
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.map((result) => (
            <ScanResultRow
              key={result.id}
              result={result}
              onToggle={toggleCandidate}
              onSearch={(id) => setSearchingForId(id)}
            />
          ))}
        </div>

        <div className="flex-shrink-0 flex gap-3 px-4 py-4 border-t border-app-border">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 text-sm text-zinc-400 border border-app-border active:bg-app-elevated touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={addableCount === 0}
            className={`flex-1 py-2.5 text-sm font-semibold touch-manipulation ${
              addableCount > 0
                ? 'bg-white text-zinc-900 active:bg-zinc-200'
                : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            {addableCount > 0
              ? `Add ${addableCount} card${addableCount !== 1 ? 's' : ''}`
              : 'Add cards'}
          </button>
        </div>
      </div>
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

/* ── Inline search (for not-found cards) ── */

function InlineSearch({
  initialQuery,
  onSelect,
}: {
  initialQuery: string;
  onSelect: (card: TcgCard) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setCards([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchCards(q);
        setCards(results);
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Kick off a search immediately with the pre-filled name
  useEffect(() => {
    if (!initialQuery.trim()) return;
    setLoading(true);
    searchCards(initialQuery.trim())
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 px-4 py-3 border-b border-app-border">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
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
            className="w-full pl-8 pr-3 py-2 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-center text-sm text-zinc-600 py-8">Searching…</p>
        )}
        {!loading && query.trim() && cards.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-8">No results</p>
        )}
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-app-border active:bg-app-elevated text-left touch-manipulation"
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
              <p className="text-sm text-zinc-100 truncate">{card.name}</p>
              <p className="text-[11px] text-zinc-500">
                {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')} · {card.set.name}
              </p>
              {(card.cardmarket?.prices?.lowPriceExPlus || card.cardmarket?.prices?.lowPrice) && (
                <p className="text-[11px] text-zinc-600">
                  from €{(card.cardmarket.prices.lowPriceExPlus || card.cardmarket.prices.lowPrice)!.toFixed(2)}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Per-result row ── */

function ScanResultRow({
  result,
  onToggle,
  onSearch,
}: {
  result: ScanResult;
  onToggle: (id: string, card: TcgCard) => void;
  onSearch: (id: string) => void;
}) {
  if (result.status === 'loading') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border animate-pulse">
        <div className="w-9 h-[50px] rounded bg-zinc-800 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-32 bg-zinc-800 rounded" />
          <div className="h-2.5 w-20 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (result.status === 'not_found') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border">
        <div className="w-9 h-[50px] flex items-center justify-center flex-shrink-0 text-zinc-700">
          <XIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-500 truncate">{result.raw.name}</p>
          <p className="text-[11px] text-zinc-600">Not found in TCG database</p>
        </div>
        <button
          onClick={() => onSearch(result.id)}
          className="flex-shrink-0 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-700 rounded active:bg-app-elevated touch-manipulation"
        >
          Search
        </button>
      </div>
    );
  }

  if (result.status === 'resolved' && result.selected) {
    const card = result.selected;
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
          <p className="text-[11px] text-zinc-500">
            {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')} · {card.set.name}
          </p>
        </div>
        {result.raw.quantity > 1 && (
          <span className="text-xs font-semibold text-zinc-400 flex-shrink-0">
            ×{result.raw.quantity}
          </span>
        )}
        <CheckIcon />
      </div>
    );
  }

  if (result.status === 'ambiguous') {
    return (
      <div className="border-b border-app-border px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-medium text-zinc-300">{result.raw.name}</p>
          {result.raw.quantity > 1 && (
            <span className="text-xs text-zinc-500">×{result.raw.quantity}</span>
          )}
        </div>
        <p className="text-[11px] text-amber-600 mb-2">
          {result.selected ? '1 version selected' : 'Multiple versions — tap to select one:'}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {result.candidates.map((card) => {
            const isSelected = result.selected?.id === card.id;
            return (
              <button
                key={card.id}
                onClick={() => onToggle(result.id, card)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 rounded touch-manipulation transition-opacity ${
                  isSelected ? 'ring-2 ring-white' : 'opacity-50 active:opacity-100'
                }`}
              >
                <Image
                  src={card.images.small}
                  alt={card.name}
                  width={52}
                  height={72}
                  className="w-[52px] h-[72px] rounded object-cover"
                  unoptimized
                />
                <span className="text-[9px] text-zinc-500 w-[52px] text-center leading-tight">
                  {card.set.id.toUpperCase()}-{card.number.padStart(3, '0')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-400 flex-shrink-0">
      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
