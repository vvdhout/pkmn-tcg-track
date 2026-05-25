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

  function getDeckLabel(card: TrackedCard) {
    return findEntry(card.tcgId)?.deckName;
  }

  function getDeckCount(card: TrackedCard) {
    return deckCountMap.get(card.tcgId);
  }

  const existingIds = flatCards.map((c) => c.tcgId);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h1 className="text-lg font-bold text-zinc-100">All Cards</h1>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold active:bg-green-700 touch-manipulation"
        >
          <span className="text-sm leading-none">+</span>
          Add Card
        </button>
      </div>

      <CardListView
        cards={flatCards}
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
        <CardSearch onSelect={handleSelectCard} excludeIds={existingIds} />
      </Modal>
    </>
  );
}
