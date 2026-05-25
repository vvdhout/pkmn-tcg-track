'use client';

import type { TrackedCard } from '@/types';

interface EditQuantityModalProps {
  card: TrackedCard | null;
  onClose: () => void;
  onSetNeeded: (value: number) => void;
  onRemove: () => void;
}

export function EditQuantityModal({ card, onClose, onSetNeeded, onRemove }: EditQuantityModalProps) {
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-app-surface rounded-t-2xl border-t border-app-border p-4 pb-safe space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium">TARGET QUANTITY</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetNeeded(card.needed - 1)}
              disabled={card.needed <= 1}
              className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-200 text-xl flex items-center justify-center active:bg-zinc-700 disabled:opacity-30 touch-manipulation"
            >
              −
            </button>
            <span className="flex-1 text-center text-2xl font-bold text-zinc-100 tabular-nums">
              {card.needed}
            </span>
            <button
              onClick={() => onSetNeeded(card.needed + 1)}
              className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-200 text-xl flex items-center justify-center active:bg-zinc-700 touch-manipulation"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={() => { onRemove(); onClose(); }}
          className="w-full py-3 rounded-xl bg-red-900/30 text-red-400 text-sm font-medium border border-red-900/40 active:bg-red-900/50 touch-manipulation"
        >
          Remove card
        </button>
      </div>
    </div>
  );
}
