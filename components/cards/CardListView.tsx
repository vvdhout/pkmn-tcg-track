'use client';

import { useState } from 'react';
import type { TrackedCard, CardFilter } from '@/types';
import { StatsBar } from './StatsBar';
import { FilterTabs } from './FilterTabs';
import { CardListItem } from './CardListItem';
import { ImagePopup } from './ImagePopup';
import { EditQuantityModal } from './EditQuantityModal';

interface CardListViewProps {
  cards: TrackedCard[];
  deckId: string | null;
  getDeckLabel?: (card: TrackedCard) => string | undefined;
  getDeckCount?: (card: TrackedCard) => number | undefined;
  onSetCollected: (tcgId: string, value: number) => void;
  onSetNeeded: (tcgId: string, value: number) => void;
  onRemove: (tcgId: string) => void;
  onReset: () => void;
  footer?: React.ReactNode;
}

function applyFilter(cards: TrackedCard[], filter: CardFilter): TrackedCard[] {
  switch (filter) {
    case 'pokemon':
      return cards.filter((c) => c.supertype === 'Pokémon');
    case 'trainer':
      return cards.filter((c) => c.supertype === 'Trainer');
    case 'energy':
      return cards.filter((c) => c.supertype === 'Energy');
    case 'missing':
      return cards.filter((c) => c.collected < c.needed);
    case 'complete':
      return cards.filter((c) => c.collected >= c.needed);
    default:
      return cards;
  }
}

function sortCards(cards: TrackedCard[]): TrackedCard[] {
  const incomplete = cards.filter((c) => c.collected < c.needed);
  const complete = cards.filter((c) => c.collected >= c.needed);
  return [...incomplete, ...complete];
}

type Section = { label: string; cards: TrackedCard[] };

function groupByType(cards: TrackedCard[]): Section[] {
  const order = ['Trainer', 'Pokémon', 'Energy'];
  const groups = new Map<string, TrackedCard[]>();
  for (const card of cards) {
    const key = card.supertype;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  const sections: Section[] = [];
  for (const type of order) {
    const group = groups.get(type);
    if (group?.length) sections.push({ label: `${type} Cards`, cards: group });
  }
  const others = [...groups.entries()].filter(([k]) => !order.includes(k));
  for (const [type, cs] of others) {
    if (cs.length) sections.push({ label: `${type} Cards`, cards: cs });
  }
  return sections;
}

export function CardListView({
  cards,
  getDeckLabel,
  getDeckCount,
  onSetCollected,
  onSetNeeded,
  onRemove,
  onReset,
  footer,
}: CardListViewProps) {
  const [filter, setFilter] = useState<CardFilter>('all');
  const [popupCard, setPopupCard] = useState<TrackedCard | null>(null);
  const [editCard, setEditCard] = useState<TrackedCard | null>(null);

  const filtered = applyFilter(cards, filter);
  const sorted = sortCards(filtered);
  const sections = ['all', 'missing', 'complete'].includes(filter)
    ? groupByType(sorted)
    : [{ label: '', cards: sorted }];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Locked top section */}
      <div className="flex-shrink-0">
        <StatsBar cards={cards} />
        <FilterTabs
          active={filter}
          onChange={setFilter}
          onReset={() => { onReset(); setFilter('all'); }}
        />
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-4 pt-1">
        {cards.length === 0 && (
          <p className="text-center text-sm text-zinc-600 py-12">No cards yet</p>
        )}
        {sections.map((section) => (
          <div key={section.label}>
            {section.label && (
              <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2 mt-1">
                {section.label}
              </p>
            )}
            <div className="space-y-1.5">
              {section.cards.map((card) => (
                <CardListItem
                  key={card.tcgId}
                  card={card}
                  deckLabel={getDeckLabel?.(card)}
                  deckCount={getDeckCount?.(card)}
                  onImageClick={setPopupCard}
                  onDecrement={() => onSetCollected(card.tcgId, card.collected - 1)}
                  onIncrement={() => onSetCollected(card.tcgId, card.collected + 1)}
                  onEdit={() => setEditCard(card)}
                />
              ))}
            </div>
          </div>
        ))}
        {footer && <div className="pt-2">{footer}</div>}
      </div>

      <ImagePopup card={popupCard} onClose={() => setPopupCard(null)} />

      <EditQuantityModal
        card={editCard}
        onClose={() => setEditCard(null)}
        onSetNeeded={(v) => {
          if (editCard) onSetNeeded(editCard.tcgId, v);
        }}
        onRemove={() => {
          if (editCard) onRemove(editCard.tcgId);
          setEditCard(null);
        }}
      />
    </div>
  );
}
