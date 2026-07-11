'use client';

import Link from 'next/link';
import type { Deck } from '@/types';
import { getFormat } from '@/services/formats';

interface DeckListItemProps {
  deck: Deck;
}

export function DeckListItem({ deck }: DeckListItemProps) {
  const total = deck.cards.reduce((s, c) => s + c.needed, 0);
  const collected = deck.cards.reduce((s, c) => s + c.collected, 0);
  const progress = total === 0 ? 0 : Math.round((collected / total) * 100);
  const formatName = deck.format ? getFormat(deck.format)?.name : undefined;

  return (
    <div className="rounded bg-app-elevated border border-app-border overflow-hidden">
      <Link href={`/decks/${deck.id}`} className="flex items-center gap-3 px-4 py-4 active:opacity-70 touch-manipulation">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{deck.name}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {collected}/{total} cards · {progress}%
            {formatName && <span className="text-zinc-600"> · {formatName}</span>}
          </p>
          {total > 0 && (
            <div className="mt-2 h-1 bg-app-border rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <ChevronIcon />
      </Link>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
