'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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

  // One entry per (deckId|null, card) pair — the underlying source instances
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

  // Merge entries that share a tcgId into one tracked card with summed
  // collected/needed, keeping the list of source instances for dispatching.
  const merged = useMemo(() => {
    const map = new Map<
      string,
      { card: TrackedCard; sources: typeof allEntries; deckNames: string[] }
    >();
    for (const entry of allEntries) {
      const id = entry.card.tcgId;
      const existing = map.get(id);
      if (existing) {
        existing.sources.push(entry);
        existing.deckNames.push(entry.deckName);
        existing.card = {
          ...existing.card,
          collected: existing.card.collected + entry.card.collected,
          needed: existing.card.needed + entry.card.needed,
        };
      } else {
        map.set(id, {
          card: { ...entry.card },
          sources: [entry],
          deckNames: [entry.deckName],
        });
      }
    }
    return map;
  }, [allEntries]);

  const flatCards = useMemo(() => [...merged.values()].map((m) => m.card), [merged]);

  function handleAdjustCollected(tcgId: string, delta: 1 | -1) {
    const m = merged.get(tcgId);
    if (!m) return;
    if (delta === 1) {
      // Fill the first source that still needs cards
      const target = m.sources.find((s) => s.card.collected < s.card.needed) ?? m.sources[0];
      dispatch({ type: 'ADJUST_COLLECTED', deckId: target.deckId, tcgId, delta: 1 });
    } else {
      // Take from the last source that has any collected
      const target = [...m.sources].reverse().find((s) => s.card.collected > 0) ?? m.sources[0];
      dispatch({ type: 'ADJUST_COLLECTED', deckId: target.deckId, tcgId, delta: -1 });
    }
  }

  function handleSetNeeded(tcgId: string, value: number) {
    const m = merged.get(tcgId);
    if (!m) return;
    // value is the new merged total; apply the difference across sources
    let delta = value - m.card.needed;
    if (delta > 0) {
      for (const s of m.sources) {
        if (delta <= 0) break;
        dispatch({ type: 'SET_NEEDED', deckId: s.deckId, tcgId, value: s.card.needed + delta });
        delta = 0;
      }
    } else if (delta < 0) {
      for (const s of [...m.sources].reverse()) {
        if (delta >= 0) break;
        const reducible = Math.min(s.card.needed - 1, -delta);
        if (reducible <= 0) continue;
        dispatch({ type: 'SET_NEEDED', deckId: s.deckId, tcgId, value: s.card.needed - reducible });
        delta += reducible;
      }
    }
  }

  function handleRemove(tcgId: string) {
    const m = merged.get(tcgId);
    if (!m) return;
    for (const s of m.sources) {
      dispatch({ type: 'REMOVE_CARD', deckId: s.deckId, tcgId });
    }
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
    const m = merged.get(card.tcgId);
    if (!m) return undefined;
    return m.deckNames.length === 1 ? m.deckNames[0] : `${m.deckNames.length} lists`;
  }

  function getDeckCount(card: TrackedCard) {
    return merged.get(card.tcgId)?.sources.length;
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
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
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
        onAdjustCollected={handleAdjustCollected}
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
        <CardSearch
          onSelect={handleSelectCard}
          onSelectMultiple={handleSelectMultiple}
          excludeIds={existingIds}
          formatIds={selectedFormats.length > 0 ? selectedFormats : undefined}
          onChangeFormatIds={setSelectedFormats}
        />
      </Modal>
    </div>
  );
}
