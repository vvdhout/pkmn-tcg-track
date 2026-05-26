'use client';

import { useState, useEffect } from 'react';
import type { TrackedCard } from '@/types';

interface EditQuantityModalProps {
  card: TrackedCard | null;
  deckId: string | null;
  decks?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSetNeeded: (value: number) => void;
  onRemove: () => void;
  onMoveToStandalone?: () => void;
  onAddToDeck?: (targetDeckId: string) => void;
}

export function EditQuantityModal({
  card,
  deckId,
  decks = [],
  onClose,
  onSetNeeded,
  onRemove,
  onMoveToStandalone,
  onAddToDeck,
}: EditQuantityModalProps) {
  const [showDeckPicker, setShowDeckPicker] = useState(false);

  // Reset deck picker whenever a different card is opened
  useEffect(() => {
    setShowDeckPicker(false);
  }, [card?.tcgId]);

  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-app-surface border-t border-app-border p-4 pb-safe space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{card.name}</p>
            <p className="text-xs text-zinc-500">{card.setId.toUpperCase()}-{card.number.padStart(3, '0')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 active:bg-zinc-700"
          >
            ✕
          </button>
        </div>

        {/* Quantity adjuster */}
        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium">TARGET QUANTITY</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetNeeded(card.needed - 1)}
              disabled={card.needed <= 1}
              className="w-10 h-10 rounded bg-zinc-800 text-zinc-200 text-xl flex items-center justify-center active:bg-zinc-700 disabled:opacity-30 touch-manipulation"
            >
              −
            </button>
            <span className="flex-1 text-center text-2xl font-bold text-zinc-100 tabular-nums">
              {card.needed}
            </span>
            <button
              onClick={() => onSetNeeded(card.needed + 1)}
              className="w-10 h-10 rounded bg-zinc-800 text-zinc-200 text-xl flex items-center justify-center active:bg-zinc-700 touch-manipulation"
            >
              +
            </button>
          </div>
        </div>

        {/* Deck picker — expands when "Add to deck" is toggled */}
        {showDeckPicker && decks.length > 0 && (
          <div className="border border-app-border rounded overflow-hidden -mb-2">
            {decks.map((deck, i) => (
              <button
                key={deck.id}
                onClick={() => { onAddToDeck?.(deck.id); onClose(); }}
                className={`w-full px-3 py-2.5 text-left text-sm text-zinc-100 active:bg-app-elevated touch-manipulation ${i < decks.length - 1 ? 'border-b border-app-border' : ''}`}
              >
                {deck.name}
              </button>
            ))}
          </div>
        )}

        {/* "Remove from deck" — only in deck context */}
        {deckId !== null && onMoveToStandalone && (
          <button
            onClick={() => { onMoveToStandalone(); onClose(); }}
            className="w-full py-3 rounded bg-app-elevated text-zinc-300 text-sm font-medium border border-app-border active:bg-app-muted touch-manipulation"
          >
            Remove from list
          </button>
        )}

        {/* "Add to deck" toggle — only in standalone context */}
        {deckId === null && decks.length > 0 && onAddToDeck && (
          <button
            onClick={() => setShowDeckPicker((v) => !v)}
            className="w-full py-3 rounded bg-app-elevated text-zinc-300 text-sm font-medium border border-app-border active:bg-app-muted touch-manipulation"
          >
            {showDeckPicker ? 'Cancel' : 'Add to list'}
          </button>
        )}

        {/* "Remove card" — always */}
        <button
          onClick={() => { onRemove(); onClose(); }}
          className="w-full py-3 rounded bg-red-900/30 text-red-400 text-sm font-medium border border-red-900/40 active:bg-red-900/50 touch-manipulation"
        >
          Remove card
        </button>
      </div>
    </div>
  );
}
