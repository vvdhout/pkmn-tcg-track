'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { CardSearch } from '@/components/cards/CardSearch';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { FormatPicker } from '@/components/formats/FormatPicker';
import { getFormat } from '@/services/formats';
import { mapToTracked } from '@/services/pokemonTcg';
import type { TcgCard } from '@/types';

type Pending = { card: TcgCard; needed: number }[];

export default function SearchPage() {
  const { state, dispatch } = useAppContext();
  const [pending, setPending] = useState<Pending | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const initDoneRef = useRef(false);

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
    pending.forEach(({ card, needed }) =>
      dispatch({ type: 'ADD_CARD', deckId, card: mapToTracked(card, needed) })
    );
    setPending(null);
  }

  const isBatch = (pending?.length ?? 0) > 1;
  const label = isBatch
    ? `Add ${pending!.length} cards`
    : pending
    ? `Add "${pending[0].card.name}"`
    : '';

  const formatLabel =
    selectedFormats.length === 0
      ? 'All sets'
      : selectedFormats.length === 1
      ? (getFormat(selectedFormats[0])?.name ?? selectedFormats[0])
      : `${selectedFormats.length} formats`;

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

      {/* Format filter row */}
      <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-2">
        <button
          onClick={() => setShowFormatPicker(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs touch-manipulation ${
            selectedFormats.length > 0
              ? 'bg-white text-zinc-900 border-white'
              : 'bg-app-elevated border-app-border text-zinc-400 active:bg-app-muted'
          }`}
        >
          <FilterIcon active={selectedFormats.length > 0} />
          {formatLabel}
        </button>
        {selectedFormats.length > 0 && (
          <button
            onClick={() => setSelectedFormats([])}
            className="text-xs text-zinc-600 active:text-zinc-400 touch-manipulation"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}>
        <CardSearch
          onSelect={handleSelect}
          onSelectMultiple={handleSelectMultiple}
          formatIds={selectedFormats.length > 0 ? selectedFormats : undefined}
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
                <span className="text-sm text-zinc-500 italic">Standalone (no deck)</span>
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

      {showFormatPicker && (
        <FormatPicker
          multiSelect
          selectedFormatIds={selectedFormats}
          onApply={(ids) => setSelectedFormats(ids)}
          onClose={() => setShowFormatPicker(false)}
        />
      )}

      {/* Settings panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
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

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={active ? 'text-zinc-900' : 'text-zinc-500'}>
      <path
        d="M1 2h10M3 6h6M5 10h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
