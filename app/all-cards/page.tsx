'use client';

import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { CardListView } from '@/components/cards/CardListView';
import { CardSearch } from '@/components/cards/CardSearch';
import { Modal } from '@/components/ui/Modal';
import { mapToTracked } from '@/services/pokemonTcg';
import type { TcgCard, TrackedCard } from '@/types';

export default function AllCardsPage() {
  const { state, dispatch } = useAppContext();
  const [showSearch, setShowSearch] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Flat list: each (deckId|null, card) pair — preserves per-deck independence
  const allEntries = useMemo(() => {
    const entries: Array<{ card: TrackedCard; deckId: string | null; deckName: string }> = [];
    for (const deck of state.decks) {
      for (const card of deck.cards) {
        entries.push({ card, deckId: deck.id, deckName: deck.name });
      }
    }
    for (const card of state.standaloneCards) {
      entries.push({ card, deckId: null, deckName: 'Standalone' });
    }
    return entries;
  }, [state]);

  // Count how many decks each tcgId appears in
  const deckCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const deck of state.decks) {
      for (const card of deck.cards) {
        map.set(card.tcgId, (map.get(card.tcgId) ?? 0) + 1);
      }
    }
    return map;
  }, [state.decks]);

  const flatCards = useMemo(() => allEntries.map((e) => e.card), [allEntries]);

  function findEntry(tcgId: string) {
    return allEntries.find((e) => e.card.tcgId === tcgId);
  }

  function handleSetCollected(tcgId: string, value: number) {
    const entry = findEntry(tcgId);
    if (!entry) return;
    dispatch({ type: 'SET_COLLECTED', deckId: entry.deckId, tcgId, value });
  }

  function handleSetNeeded(tcgId: string, value: number) {
    const entry = findEntry(tcgId);
    if (!entry) return;
    dispatch({ type: 'SET_NEEDED', deckId: entry.deckId, tcgId, value });
  }

  function handleRemove(tcgId: string) {
    const entry = findEntry(tcgId);
    if (!entry) return;
    dispatch({ type: 'REMOVE_CARD', deckId: entry.deckId, tcgId });
  }

  function handleReset() {
    dispatch({ type: 'RESET_COLLECTED', deckId: null });
    for (const deck of state.decks) {
      dispatch({ type: 'RESET_COLLECTED', deckId: deck.id });
    }
  }

  function handleSelectCard(tcgCard: TcgCard) {
    dispatch({ type: 'ADD_CARD', deckId: null, card: mapToTracked(tcgCard) });
    setShowSearch(false);
  }

  function handleSelectMultiple(cards: { card: TcgCard; needed: number }[]) {
    cards.forEach(({ card, needed }) =>
      dispatch({ type: 'ADD_CARD', deckId: null, card: mapToTracked(card, needed) })
    );
    setShowSearch(false);
  }

  function getDeckLabel(card: TrackedCard) {
    return findEntry(card.tcgId)?.deckName;
  }

  function getDeckCount(card: TrackedCard) {
    return deckCountMap.get(card.tcgId);
  }

  const visibleCards = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return flatCards;
    return flatCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.setName.toLowerCase().includes(q) ||
        c.setId.toLowerCase().includes(q)
    );
  }, [flatCards, filterQuery]);

  const existingIds = flatCards.map((c) => c.tcgId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-4 pt-5 pb-2">
          <h1 className="text-lg font-bold text-zinc-100">All Cards</h1>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-white text-zinc-900 text-xs font-semibold active:bg-zinc-200 touch-manipulation"
          >
            <span className="text-sm leading-none">+</span>
            Add Card
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Filter cards…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full pl-8 pr-8 py-2 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 touch-manipulation"
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <CardListView
        cards={visibleCards}
        deckId={null}
        getDeckLabel={getDeckLabel}
        getDeckCount={getDeckCount}
        onSetCollected={handleSetCollected}
        onSetNeeded={handleSetNeeded}
        onRemove={handleRemove}
        onReset={handleReset}
      />

      <Modal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        title="Add Standalone Card"
        fullScreen
      >
        <CardSearch onSelect={handleSelectCard} onSelectMultiple={handleSelectMultiple} excludeIds={existingIds} />
      </Modal>
    </div>
  );
}
