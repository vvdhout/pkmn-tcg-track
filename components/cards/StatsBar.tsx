import type { TrackedCard } from '@/types';
import { getDeckPoints, MAX_DECK_POINTS } from '@/services/pointList';

function cardRefPrice(card: TrackedCard): number {
  const low = card.cardmarketLowPrice;
  const avg30 = card.cardmarketAvg30;
  if (low != null && avg30 != null) return (low + avg30) / 2;
  return low ?? avg30 ?? 0;
}

interface StatsBarProps {
  cards: TrackedCard[];
  pointFormat?: boolean;
}

export function StatsBar({ cards, pointFormat }: StatsBarProps) {
  const totalNeeded = cards.reduce((s, c) => s + c.needed, 0);
  const totalCollected = cards.reduce((s, c) => s + c.collected, 0);
  const progress = totalNeeded === 0 ? 0 : Math.round((totalCollected / totalNeeded) * 100);

  const hasPrices = cards.some((c) => c.cardmarketLowPrice != null || c.cardmarketAvg30 != null);
  const totalPrice = hasPrices
    ? cards.reduce((s, c) => s + cardRefPrice(c) * c.needed, 0)
    : null;
  const missingPrice = hasPrices
    ? cards.reduce((s, c) => s + cardRefPrice(c) * Math.max(0, c.needed - c.collected), 0)
    : null;

  const deckPoints = pointFormat ? getDeckPoints(cards) : null;
  const overLimit = deckPoints !== null && deckPoints > MAX_DECK_POINTS;

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-zinc-100 tabular-nums">
            {totalCollected} / {totalNeeded}
          </span>
          {deckPoints !== null && (
            <span
              className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                overLimit
                  ? 'bg-red-900/50 text-red-300 border border-red-700/60'
                  : 'bg-app-elevated text-zinc-300 border border-app-border'
              }`}
            >
              {deckPoints}/{MAX_DECK_POINTS} pts{overLimit ? ' — over limit' : ''}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          {totalPrice != null && (
            <span className="text-[11px] text-zinc-500 tabular-nums">
              €{totalPrice.toFixed(2)}
              {missingPrice != null && missingPrice > 0 && (
                <span className="text-zinc-600"> · €{missingPrice.toFixed(2)} missing</span>
              )}
            </span>
          )}
          <span className="text-xs text-zinc-500 tabular-nums">{progress}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-app-border rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
