import type { TrackedCard } from '@/types';

interface StatsBarProps {
  cards: TrackedCard[];
}

export function StatsBar({ cards }: StatsBarProps) {
  const totalNeeded = cards.reduce((s, c) => s + c.needed, 0);
  const totalCollected = cards.reduce((s, c) => s + c.collected, 0);
  const cardsComplete = cards.filter((c) => c.collected >= c.needed).length;
  const progress = totalNeeded === 0 ? 0 : Math.round((totalCollected / totalNeeded) * 100);

  return (
    <div className="grid grid-cols-3 gap-2 px-3 pt-3 pb-2">
      <StatBox label="Collected" value={`${totalCollected} / ${totalNeeded}`} />
      <StatBox label="Cards complete" value={`${cardsComplete} / ${cards.length}`} />
      <StatBox label="Progress" value={`${progress}%`} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app-elevated px-3 py-2.5">
      <p className="text-[10px] text-zinc-500 font-medium leading-none mb-1">{label}</p>
      <p className="text-sm font-bold text-zinc-100 leading-none">{value}</p>
    </div>
  );
}
