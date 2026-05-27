'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { CardSearch } from '@/components/cards/CardSearch';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { mapToTracked } from '@/services/pokemonTcg';
import type { TcgCard } from '@/types';

type Pending = { card: TcgCard; needed: number }[];
type NavImage = { base64: string; mediaType: string };

export default function SearchPage() {
  const { state, dispatch } = useAppContext();
  const [pending, setPending] = useState<Pending | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<NavImage | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initDoneRef = useRef(false);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Pick up any camera image captured by the nav long-press gesture.
  // Uses both mount-check AND a custom event so this works whether the
  // search page is freshly navigated-to OR was already mounted.
  useEffect(() => {
    function checkNavScan() {
      const raw = sessionStorage.getItem('nav-scan-image');
      if (!raw) return;
      sessionStorage.removeItem('nav-scan-image');
      try { setPendingImage(JSON.parse(raw)); } catch { /* ignore malformed */ }
    }
    checkNavScan(); // check on mount
    window.addEventListener('nav-scan-ready', checkNavScan);
    return () => window.removeEventListener('nav-scan-ready', checkNavScan);
  }, []);

  // Initialize format filter from defaultDeckFormat once state loads
  useEffect(() => {
    if (!initDoneRef.current && state.settings.defaultDeckFormat) {
      initDoneRef.current = true;
      setSelectedFormats([state.settings.defaultDeckFormat]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.defaultDeckFormat]);

  function handleSelect(card: TcgCard) {
    setPending([{ card, needed: 1 }]);
  }

  function handleSelectMultiple(cards: { card: TcgCard; needed: number }[]) {
    if (cards.length > 0) setPending(cards);
  }

  function handleAddTo(deckId: string | null) {
    if (!pending) return;
    const count = pending.length;
    const dest = deckId ? (state.decks.find((d) => d.id === deckId)?.name ?? 'deck') : 'All Cards';
    pending.forEach(({ card, needed }) =>
      dispatch({ type: 'ADD_CARD', deckId, card: mapToTracked(card, needed) })
    );
    setPending(null);
    showToast(count === 1 ? `Card added to ${dest}` : `${count} cards added to ${dest}`);
  }

  const isBatch = (pending?.length ?? 0) > 1;
  const label = isBatch
    ? `Add ${pending!.length} cards`
    : pending
    ? `Add "${pending[0].card.name}"`
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-zinc-100">Search</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center text-zinc-500 active:text-zinc-300 touch-manipulation"
          aria-label="Search settings"
        >
          <GearIcon />
        </button>
      </div>

      <div className="flex-1 min-h-0" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
        <CardSearch
          onSelect={handleSelect}
          onSelectMultiple={handleSelectMultiple}
          formatIds={selectedFormats.length > 0 ? selectedFormats : undefined}
          onChangeFormatIds={setSelectedFormats}
          pendingImage={pendingImage}
        />
      </div>

      {/* Deck picker — slides up when card(s) are pending */}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full bg-app-surface border-t border-app-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-app-border">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Add to</p>
              <p className="text-sm font-semibold text-zinc-100 truncate">{label}</p>
            </div>

            {/* Deck list */}
            <div className="overflow-y-auto max-h-64">
              {state.decks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => handleAddTo(deck.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
                >
                  <span className="text-sm text-zinc-100">{deck.name}</span>
                  <span className="text-xs text-zinc-500">{deck.cards.length} cards</span>
                </button>
              ))}
              <button
                onClick={() => handleAddTo(null)}
                className="w-full flex items-center px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
              >
                <span className="text-sm text-zinc-500 italic">Standalone (no list)</span>
              </button>
            </div>

            {/* Cancel */}
            <button
              onClick={() => setPending(null)}
              className="w-full py-3.5 text-sm text-zinc-400 active:bg-app-elevated touch-manipulation"
              style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          className="fixed left-1/2 px-4 py-2.5 rounded-full bg-zinc-800 border border-app-border text-zinc-100 text-sm shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            bottom: 'calc(4rem + env(safe-area-inset-bottom) + 10px)',
            zIndex: 60,
            animation: 'toast-in 0.2s ease-out',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-zinc-500">
      <path
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

