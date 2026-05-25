'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import type { TrackedCard } from '@/types';

interface ImagePopupProps {
  card: TrackedCard | null;
  onClose: () => void;
}

function PriceLink({ href, label, value }: { href?: string; label: string; value: number }) {
  const text = `${label} €${value.toFixed(2)}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 underline underline-offset-2 decoration-zinc-600">
        {text}
      </a>
    );
  }
  return <span className="text-xs text-zinc-500">{text}</span>;
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
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg active:bg-zinc-700 touch-manipulation"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
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
          {(card.cardmarketLowPrice != null || card.cardmarketAvg30 != null) && (
            <div className="flex items-center justify-center gap-3 mt-1">
              {card.cardmarketLowPrice != null && (
                <PriceLink href={card.cardmarketUrl} label="from" value={card.cardmarketLowPrice} />
              )}
              {card.cardmarketAvg30 != null && (
                <PriceLink href={card.cardmarketUrl} label="avg30" value={card.cardmarketAvg30} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
