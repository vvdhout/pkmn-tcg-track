'use client';

import { FORMATS, type Format } from '@/services/formats';
import { useAppContext } from '@/context/AppContext';

interface FormatPickerProps {
  currentFormatId: string | null;
  onSelect: (formatId: string | null) => void;
  onClose: () => void;
}

export function FormatPicker({ currentFormatId, onSelect, onClose }: FormatPickerProps) {
  const { state } = useAppContext();
  const { favoriteFormats } = state.settings;

  const favorites = FORMATS.filter((f) => favoriteFormats.includes(f.id));
  const nonFavoriteOfficial = FORMATS.filter((f) => f.category === 'official' && !favoriteFormats.includes(f.id));
  const nonFavoriteRetro    = FORMATS.filter((f) => f.category === 'retro'    && !favoriteFormats.includes(f.id));

  function pick(id: string | null) {
    onSelect(id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col h-full bg-app-surface">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h2 className="text-sm font-semibold text-zinc-100">Select Format</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* None */}
          <FormatRow
            label="None"
            sublabel="No format restriction"
            selected={currentFormatId === null}
            onSelect={() => pick(null)}
          />

          {/* Favorites / Popular */}
          {favorites.length > 0 && (
            <>
              <SectionHeader label="Popular" />
              {favorites.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={currentFormatId === f.id}
                  onSelect={() => pick(f.id)}
                />
              ))}
            </>
          )}

          {/* Other official */}
          {nonFavoriteOfficial.length > 0 && (
            <>
              <SectionHeader label="Official" />
              {nonFavoriteOfficial.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={currentFormatId === f.id}
                  onSelect={() => pick(f.id)}
                />
              ))}
            </>
          )}

          {/* Retro */}
          {nonFavoriteRetro.length > 0 && (
            <>
              <SectionHeader label="Retro" />
              {nonFavoriteRetro.map((f) => (
                <FormatRow
                  key={f.id}
                  label={f.name}
                  sublabel={formatSublabel(f)}
                  selected={currentFormatId === f.id}
                  onSelect={() => pick(f.id)}
                />
              ))}
            </>
          )}
        </div>
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
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left ${selected ? 'bg-app-elevated' : ''}`}
    >
      <div>
        <p className="text-sm text-zinc-100">{label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">{sublabel}</p>
      </div>
      {selected && <CheckIcon />}
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
