'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext, useCardActions, useDecks } from '@/context/AppContext';
import { CardListView } from '@/components/cards/CardListView';
import { CardSearch } from '@/components/cards/CardSearch';
import { Modal } from '@/components/ui/Modal';
import { FormatPicker } from '@/components/formats/FormatPicker';
import { mapToTracked } from '@/services/pokemonTcg';
import { getFormat } from '@/services/formats';
import type { TcgCard } from '@/types';

interface Props {
  params: Promise<{ id: string }>;
}

type ConflictItem = { tcgCard: TcgCard; needed: number };

export default function DeckDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { state, dispatch } = useAppContext();
  const deck = state.decks.find((d) => d.id === id);
  const { addCard, removeCard, setCollected, adjustCollected, setNeeded, resetCollected } = useCardActions(id);
  const { deleteDeck } = useDecks();
  const [showSearch, setShowSearch] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [standaloneConflict, setStandaloneConflict] = useState<ConflictItem[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deckFormat = deck?.format ? getFormat(deck.format) : undefined;
  const deckFormatIds = deck?.format ? [deck.format] : undefined;

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-zinc-500 text-sm">List not found.</p>
      </div>
    );
  }

  function handleSelectCard(tcgCard: TcgCard) {
    const isStandalone = state.standaloneCards.some((c) => c.tcgId === tcgCard.id);
    if (isStandalone) {
      setStandaloneConflict([{ tcgCard, needed: 1 }]);
      setShowSearch(false);
      return;
    }
    addCard(mapToTracked(tcgCard));
    setShowSearch(false);
  }

  function handleSelectMultiple(cards: { card: TcgCard; needed: number }[]) {
    const conflicts: ConflictItem[] = [];
    const nonConflicts: { card: TcgCard; needed: number }[] = [];

    cards.forEach(({ card, needed }) => {
      if (state.standaloneCards.some((c) => c.tcgId === card.id)) {
        conflicts.push({ tcgCard: card, needed });
      } else {
        nonConflicts.push({ card, needed });
      }
    });

    nonConflicts.forEach(({ card, needed }) => addCard(mapToTracked(card, needed)));

    if (conflicts.length > 0) {
      setStandaloneConflict(conflicts);
    }

    setShowSearch(false);
  }

  function handleConflictMove() {
    if (!standaloneConflict) return;
    standaloneConflict.forEach(({ tcgCard, needed }) => {
      dispatch({ type: 'REMOVE_CARD', deckId: null, tcgId: tcgCard.id });
      addCard(mapToTracked(tcgCard, needed));
    });
    setStandaloneConflict(null);
  }

  function handleConflictCopy() {
    if (!standaloneConflict) return;
    standaloneConflict.forEach(({ tcgCard, needed }) => {
      addCard(mapToTracked(tcgCard, needed));
    });
    setStandaloneConflict(null);
  }

  const existingIds = deck.cards.map((c) => c.tcgId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 pt-5 pb-2">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-zinc-100 truncate">{deck.name}</h1>
          <button
            onClick={() => setShowFormatPicker(true)}
            className="text-[11px] text-zinc-500 active:text-zinc-300 touch-manipulation"
          >
            {deckFormat ? deckFormat.name : 'No format'}
          </button>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-white text-zinc-900 text-xs font-semibold active:bg-zinc-200 touch-manipulation"
        >
          <span className="text-sm leading-none">+</span>
          Add Card
        </button>
      </div>

      <CardListView
        cards={deck.cards}
        deckId={id}
        onAdjustCollected={adjustCollected}
        onSetNeeded={setNeeded}
        onRemove={removeCard}
        onReset={resetCollected}
        footer={
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 text-sm font-medium text-zinc-300 border border-app-border bg-app-elevated active:bg-app-muted touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => { deleteDeck(id); router.replace('/decks'); }}
                className="flex-1 py-3 text-sm font-semibold text-red-300 border border-red-700/60 bg-red-900/40 active:bg-red-900/60 touch-manipulation"
              >
                Confirm delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-3 text-sm font-medium text-red-500 border border-red-900/40 bg-red-900/10 active:bg-red-900/20 touch-manipulation"
            >
              Delete List
            </button>
          )}
        }
      />

      <Modal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        title="Add Card"
        fullScreen
      >
        <CardSearch onSelect={handleSelectCard} onSelectMultiple={handleSelectMultiple} excludeIds={existingIds} formatIds={deckFormatIds} />
      </Modal>

      {showFormatPicker && (
        <FormatPicker
          currentFormatId={deck.format ?? null}
          onSelect={(formatId) => dispatch({ type: 'SET_DECK_FORMAT', deckId: id, format: formatId })}
          onClose={() => setShowFormatPicker(false)}
        />
      )}

      {/* Standalone conflict overlay — appears above Modal (z-[60]) */}
      {standaloneConflict && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/60"
          onClick={() => setStandaloneConflict(null)}
        >
          <div
            className="w-full bg-app-surface border-t border-app-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-app-border">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-0.5">
                Already in Standalone
              </p>
              <p className="text-sm font-semibold text-zinc-100">
                {standaloneConflict.length === 1
                  ? `"${standaloneConflict[0].tcgCard.name}" is already a standalone card.`
                  : `${standaloneConflict.length} cards are already standalone cards.`}
              </p>
            </div>

            {/* Move option */}
            <button
              onClick={handleConflictMove}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
            >
              <span className="text-sm text-zinc-100">Move to this deck</span>
              <span className="text-xs text-zinc-500">Removes from standalone</span>
            </button>

            {/* Copy option */}
            <button
              onClick={handleConflictCopy}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
            >
              <span className="text-sm text-zinc-100">Add a copy to deck</span>
              <span className="text-xs text-zinc-500">Keeps standalone too</span>
            </button>

            {/* Cancel */}
            <button
              onClick={() => setStandaloneConflict(null)}
              className="w-full py-3.5 text-sm text-zinc-400 active:bg-app-elevated touch-manipulation"
              style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
