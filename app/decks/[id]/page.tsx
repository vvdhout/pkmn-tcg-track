'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext, useCardActions } from '@/context/AppContext';
import { CardListView } from '@/components/cards/CardListView';
import { CardSearch } from '@/components/cards/CardSearch';
import { Modal } from '@/components/ui/Modal';
import { mapToTracked } from '@/services/pokemonTcg';
import type { TcgCard } from '@/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function DeckDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { state } = useAppContext();
  const deck = state.decks.find((d) => d.id === id);
  const { addCard, removeCard, setCollected, setNeeded, resetCollected } = useCardActions(id);
  const [showSearch, setShowSearch] = useState(false);

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-zinc-500 text-sm">Deck not found.</p>
      </div>
    );
  }

  function handleSelectCard(tcgCard: TcgCard) {
    addCard(mapToTracked(tcgCard));
    setShowSearch(false);
  }

  const existingIds = deck.cards.map((c) => c.tcgId);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 pt-12 pb-2">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1 className="flex-1 text-base font-bold text-zinc-100 truncate">{deck.name}</h1>
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold active:bg-green-700 touch-manipulation"
        >
          <span className="text-sm leading-none">+</span>
          Add Card
        </button>
      </div>

      <CardListView
        cards={deck.cards}
        deckId={id}
        onSetCollected={setCollected}
        onSetNeeded={setNeeded}
        onRemove={removeCard}
        onReset={resetCollected}
      />

      <Modal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        title="Add Card"
        fullScreen
      >
        <CardSearch onSelect={handleSelectCard} excludeIds={existingIds} />
      </Modal>
    </>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
