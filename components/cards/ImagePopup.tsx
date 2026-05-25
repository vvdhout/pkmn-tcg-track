'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import type { TrackedCard } from '@/types';

interface ImagePopupProps {
  card: TrackedCard | null;
  onClose: () => void;
}

export function ImagePopup({ card, onClose }: ImagePopupProps) {
  useEffect(() => {
    if (!card) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [card, onClose]);

  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
        <Image
          src={card.imageLarge}
          alt={card.name}
          width={420}
          height={588}
          className="w-full h-auto rounded-2xl shadow-2xl"
          unoptimized
          priority
        />
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-zinc-100">{card.name}</p>
          <p className="text-xs text-zinc-500">
            {card.setId.toUpperCase()}-{card.number.padStart(3, '0')} · {card.setName}
          </p>
          {card.cardmarketPrice != null && (
            <p className="text-xs text-zinc-400 mt-0.5">avg. €{card.cardmarketPrice.toFixed(2)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
