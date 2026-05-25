'use client';

import { useState } from 'react';
import { useDecks } from '@/context/AppContext';
import { DeckListItem } from '@/components/decks/DeckListItem';
import { CreateDeckModal } from '@/components/decks/CreateDeckModal';

export default function DecksPage() {
  const { decks, createDeck } = useDecks();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-zinc-100">My Decks</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded border border-zinc-700 text-zinc-300 text-xs font-semibold active:bg-app-elevated touch-manipulation"
        >
          <span className="text-sm leading-none">+</span>
          New Deck
        </button>
      </div>

      <div className="px-3 space-y-2 pb-24">
        {decks.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-sm">No decks yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Tap &ldquo;New Deck&rdquo; to get started.</p>
          </div>
        )}
        {decks.map((deck) => (
          <DeckListItem
            key={deck.id}
            deck={deck}
          />
        ))}
      </div>

      <CreateDeckModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(name, format) => { createDeck(name, format); setShowCreate(false); }}
      />
    </div>
  );
}
