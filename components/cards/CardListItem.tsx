'use client';

import Image from 'next/image';
import type { TrackedCard } from '@/types';

interface CardListItemProps {
  card: TrackedCard;
  deckLabel?: string;
  deckCount?: number;
  onImageClick: (card: TrackedCard) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onEdit: () => void;
}

const SUPERTYPE_BADGE: Record<string, { label: string; className: string }> = {
  Pokémon: { label: 'P', className: 'bg-blue-900/70 text-blue-300' },
  Trainer: { label: 'T', className: 'bg-yellow-900/60 text-yellow-400' },
  Energy: { label: 'E', className: 'bg-green-900/60 text-green-400' },
};

export function CardListItem({
  card,
  deckLabel,
  deckCount,
  onImageClick,
  onDecrement,
  onIncrement,
  onEdit,
}: CardListItemProps) {
  const isComplete = card.collected >= card.needed;
  const badge = SUPERTYPE_BADGE[card.supertype] ?? { label: '?', className: 'bg-zinc-700 text-zinc-400' };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
        isComplete
          ? 'bg-green-950/20 border-green-900/40'
          : 'bg-app-elevated border-app-border'
      }`}
    >
      {/* Thumbnail */}
      <button
        className="flex-shrink-0 w-10 h-14 rounded-md overflow-hidden bg-app-surface touch-manipulation active:opacity-70"
        onClick={() => onImageClick(card)}
        aria-label={`View ${card.name}`}
      >
        <Image
          src={card.imageSmall}
          alt={card.name}
          width={40}
          height={56}
          className="w-full h-full object-cover"
          unoptimized
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-bold ${badge.className}`}
          >
            {badge.label}
          </span>
          <button
            className="text-sm font-semibold text-zinc-100 truncate touch-manipulation active:opacity-70 text-left"
            onClick={() => onImageClick(card)}
          >
            {card.name}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 font-mono">
            {card.setId.toUpperCase()}-{card.number.padStart(3, '0')}
          </span>
          {card.cardmarketPrice != null && (
            <span className="text-[11px] text-zinc-500">
              €{card.cardmarketPrice.toFixed(2)}
            </span>
          )}
          {deckLabel && (
            <span className="text-[10px] text-zinc-600 italic truncate">{deckLabel}</span>
          )}
        </div>
        {deckCount !== undefined && deckCount >= 3 && (
          <div className="mt-0.5">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-500">
              <StarIcon />
              {deckCount}+ decks
            </span>
          </div>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <CountButton onClick={onDecrement} aria="Decrease">−</CountButton>
        <span className={`w-10 text-center text-sm font-semibold tabular-nums ${isComplete ? 'text-green-400' : 'text-zinc-200'}`}>
          {card.collected}&nbsp;/&nbsp;{card.needed}
        </span>
        <CountButton onClick={onIncrement} aria="Increase">+</CountButton>
      </div>

      {/* Edit */}
      <button
        onClick={onEdit}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 active:bg-zinc-700 touch-manipulation"
        aria-label="Edit card"
      >
        <EditIcon />
      </button>
    </div>
  );
}

function CountButton({ onClick, aria, children }: { onClick: () => void; aria: string; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 text-lg leading-none active:bg-zinc-700 touch-manipulation select-none"
    >
      {children}
    </button>
  );
}

function StarIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
      <path d="M4.5 0l1.09 2.21 2.44.36-1.77 1.72.42 2.43L4.5 5.59 2.32 6.72l.42-2.43L1 2.57l2.44-.36z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M9 2l2 2-7 7H2V9l7-7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
