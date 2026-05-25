import type { TrackedCard } from '@/types';

interface StatsBarProps {
  cards: TrackedCard[];
}

export function StatsBar({ cards }: StatsBarProps) {
  const totalNeeded = cards.reduce((s, c) => s + c.needed, 0);
  const totalCollected = cards.reduce((s, c) => s + c.collected, 0);
  const progress = totalNeeded === 0 ? 0 : Math.round((totalCollected / totalNeeded) * 100);

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-zinc-100 tabular-nums">
          {totalCollected} / {totalNeeded}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">{progress}%</span>
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
