'use client';

import { TcgAssetImage } from '@/components/cards/TcgAssetImage';
import type { TrackedCard } from '@/types';

interface CardListItemProps {
  card: TrackedCard;
  deckLabel?: string;
  deckCount?: number;
  onImageClick: (card: TrackedCard) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}

export function CardListItem({
  card,
  deckLabel,
  deckCount,
  onImageClick,
  onDecrement,
  onIncrement,
}: CardListItemProps) {
  const isComplete = card.collected >= card.needed;
  const cmHref = card.cardmarketUrl
    ? `${card.cardmarketUrl}?language=1&minCondition=4`
    : undefined;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-colors ${
        isComplete
          ? 'bg-green-950/20 border-green-900/40'
          : 'bg-app-elevated border-app-border'
      }`}
    >
      {/* Thumbnail */}
      <button
        className="flex-shrink-0 w-10 h-14 overflow-hidden bg-app-surface touch-manipulation active:opacity-70"
        onClick={() => onImageClick(card)}
        aria-label={`View ${card.name}`}
      >
        <TcgAssetImage
          src={card.imageSmall}
          kind="card-small"
          alt={card.name}
          width={40}
          height={56}
          className="w-full h-full object-cover"
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <button
          className="text-sm font-semibold text-zinc-100 truncate touch-manipulation active:opacity-70 text-left w-full"
          onClick={() => onImageClick(card)}
        >
          {card.name}
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              {card.setSymbol && (
                <TcgAssetImage
                  src={card.setSymbol}
                  kind="set-symbol"
                  alt=""
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 object-contain opacity-60"
                />
              )}
              <span className="text-[11px] text-zinc-500 font-mono">
                {card.setId.toUpperCase()}-{card.number.padStart(3, '0')}
              </span>
            </span>
            {deckLabel && (
              <span className="text-[10px] text-zinc-600 italic truncate">{deckLabel}</span>
            )}
          </div>
          {(card.cardmarketLowPrice != null || card.cardmarketAvg30 != null) && (
            <PriceChip
              href={cmHref}
              low={card.cardmarketLowPrice}
              avg30={card.cardmarketAvg30}
            />
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

      {/* Counter — horizontally stacked */}
      <div className="flex items-center flex-shrink-0 gap-1">
        <CountButton onClick={onDecrement} aria="Decrease">−</CountButton>
        <span className={`text-[11px] font-semibold tabular-nums text-center leading-none w-8 ${isComplete ? 'text-green-400' : 'text-zinc-200'}`}>
          {card.collected}/{card.needed}
        </span>
        <CountButton onClick={onIncrement} aria="Increase">+</CountButton>
      </div>
    </div>
  );
}

function PriceChip({ href, low, avg30 }: { href?: string; low?: number; avg30?: number }) {
  const parts = [low != null ? `€${low.toFixed(2)}` : null, avg30 != null ? `€${avg30.toFixed(2)}` : null]
    .filter(Boolean)
    .join('/');
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[11px] text-zinc-400 underline underline-offset-2 decoration-zinc-600 touch-manipulation"
      >
        {parts}
      </a>
    );
  }
  return <span className="text-[11px] text-zinc-500">{parts}</span>;
}

function CountButton({ onClick, aria, children }: { onClick: () => void; aria: string; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="w-7 h-6 flex items-center justify-center bg-zinc-800 text-zinc-300 text-base leading-none active:bg-zinc-700 touch-manipulation select-none"
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
