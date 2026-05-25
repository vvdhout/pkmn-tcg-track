'use client';

import { useState } from 'react';
import { FORMATS, type Format } from '@/services/formats';
import { useAppContext } from '@/context/AppContext';

interface SingleSelectProps {
  multiSelect?: false;
  currentFormatId: string | null;
  onSelect: (formatId: string | null) => void;
  onClose: () => void;
}

interface MultiSelectProps {
  multiSelect: true;
  selectedFormatIds: string[];
  onApply: (formatIds: string[]) => void;
  onClose: () => void;
}

type FormatPickerProps = SingleSelectProps | MultiSelectProps;

export function FormatPicker(props: FormatPickerProps) {
  const { state } = useAppContext();
  const { favoriteFormats } = state.settings;

  const [localSelected, setLocalSelected] = useState<string[]>(
    props.multiSelect ? props.selectedFormatIds : [],
  );

  const favorites = FORMATS.filter((f) => favoriteFormats.includes(f.id));
  const nonFavoriteOfficial = FORMATS.filter(
    (f) => f.category === 'official' && !favoriteFormats.includes(f.id),
  );
  const nonFavoriteRetro = FORMATS.filter(
    (f) => f.category === 'retro' && !favoriteFormats.includes(f.id),
  );

  function isSelected(id: string) {
    return props.multiSelect ? localSelected.includes(id) : props.currentFormatId === id;
  }

  function isAllSets() {
    return props.multiSelect ? localSelected.length === 0 : props.currentFormatId === null;
  }

  function handleSelect(id: string | null) {
    if (props.multiSelect) {
      if (id === null) {
        setLocalSelected([]);
      } else {
        setLocalSelected((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
      }
    } else {
      props.onSelect(id);
      props.onClose();
    }
  }

  function handleApply() {
    if (props.multiSelect) {
      props.onApply(localSelected);
      props.onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onClose} />
      <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col h-full bg-app-surface">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h2 className="text-sm font-semibold text-zinc-100">
            {props.multiSelect ? 'Filter by Format' : 'Select Format'}
          </h2>
          <button
            onClick={props.onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* All sets / None */}
          <FormatRow
            label={props.multiSelect ? 'All sets' : 'None'}
            sublabel={props.multiSelect ? 'No format filter' : 'No format restriction'}
            selected={isAllSets()}
            multiSelect={!!props.multiSelect}
            onSelect={() => handleSelect(null)}
          />

          {favorites.length > 0 && (
            <>
              <SectionHeader label="Favorites" />
              {favorites.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={isSelected(f.id)}
                  multiSelect={!!props.multiSelect}
                  onSelect={() => handleSelect(f.id)}
                />
              ))}
            </>
          )}

          {nonFavoriteOfficial.length > 0 && (
            <>
              <SectionHeader label="Official" />
              {nonFavoriteOfficial.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={isSelected(f.id)}
                  multiSelect={!!props.multiSelect}
                  onSelect={() => handleSelect(f.id)}
                />
              ))}
            </>
          )}

          {nonFavoriteRetro.length > 0 && (
            <>
              <SectionHeader label="Retro" />
              {nonFavoriteRetro.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={isSelected(f.id)}
                  multiSelect={!!props.multiSelect}
                  onSelect={() => handleSelect(f.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Done button — multi-select only */}
        {props.multiSelect && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-app-border">
            <button
              onClick={handleApply}
              className="w-full py-2.5 text-sm font-semibold bg-white text-zinc-900 active:bg-zinc-200 touch-manipulation"
            >
              {localSelected.length === 0
                ? 'Show all sets'
                : `Apply ${localSelected.length} format${localSelected.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSublabel(f: Format): string {
  if (!f.fromDate && !f.toDate) return 'All sets';
  const from = f.fromDate ? f.fromDate.slice(0, 4) : 'All';
  const to   = f.toDate   ? f.toDate.slice(0, 4)   : 'Present';
  return `${from} – ${to}`;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-4 pt-4 pb-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
      {label}
    </p>
  );
}

function FormatRow({
  label,
  sublabel,
  selected,
  multiSelect,
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  multiSelect: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left ${selected && !multiSelect ? 'bg-app-elevated' : ''}`}
    >
      {multiSelect && (
        <div className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center ${selected ? 'bg-white border-white' : 'border-zinc-600'}`}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 5.5l3 3 5-5" stroke="#09090b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100">{label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{sublabel}</p>
      </div>
      {!multiSelect && selected && <CheckIcon />}
    </button>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-300 flex-shrink-0">
      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
