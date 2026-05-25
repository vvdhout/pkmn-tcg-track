'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { TcgSet, SetRef, AppSettings } from '@/types';
import { fetchSets } from '@/services/pokemonTcg';
import { FORMATS, getFormat } from '@/services/formats';
import { useAppContext } from '@/context/AppContext';
import { FormatPicker } from '@/components/formats/FormatPicker';

type View = 'main' | 'pick-from' | 'pick-to' | 'pick-favorites';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppContext();
  const { settings } = state;

  const [view, setView] = useState<View>('main');
  const [sets, setSets] = useState<TcgSet[] | null>(null);
  const [setsLoading, setSetsLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showDefaultFormatPicker, setShowDefaultFormatPicker] = useState(false);

  async function openPicker(v: 'pick-from' | 'pick-to') {
    setFilterText('');
    setView(v);
    if (!sets) {
      setSetsLoading(true);
      try {
        const data = await fetchSets();
        setSets(data);
      } catch {
        // keep null — error shown in list area
      } finally {
        setSetsLoading(false);
      }
    }
  }

  function updateSettings(patch: Partial<AppSettings>) {
    dispatch({ type: 'UPDATE_SETTINGS', settings: patch });
  }

  function handlePickSet(set: TcgSet) {
    const ref: SetRef = { id: set.id, name: set.name, releaseDate: set.releaseDate };
    dispatch({
      type: 'UPDATE_SETTINGS',
      settings: view === 'pick-from' ? { setRangeFrom: ref } : { setRangeTo: ref },
    });
    setView('main');
  }

  function clearSingle(field: 'setRangeFrom' | 'setRangeTo') {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [field]: null } });
    setView('main');
  }

  function clearRange() {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { setRangeFrom: null, setRangeTo: null } });
  }

  const filteredSets = (sets ?? []).filter(
    (s) =>
      !filterText ||
      s.name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.series.toLowerCase().includes(filterText.toLowerCase()),
  );

  const hasFilter = settings.setRangeFrom || settings.setRangeTo;

  /* ── Set picker view ── */
  if (view === 'pick-from' || view === 'pick-to') {
    const isFrom = view === 'pick-from';
    const currentId = isFrom ? settings.setRangeFrom?.id : settings.setRangeTo?.id;

    return (
      <div className="fixed inset-0 z-[60] flex flex-col">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col h-full bg-app-surface">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-app-border">
            <button
              onClick={() => setView('main')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
              aria-label="Back"
            >
              <BackIcon />
            </button>
            <h2 className="flex-1 text-sm font-semibold text-zinc-100">
              {isFrom ? 'From set (oldest to include)' : 'To set (newest to include)'}
            </h2>
          </div>

          {/* Filter input */}
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-app-border">
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter sets…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full px-3 py-2 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            />
          </div>

          {/* Set list */}
          <div className="flex-1 overflow-y-auto">
            {/* "No limit" option */}
            <button
              onClick={() => clearSingle(isFrom ? 'setRangeFrom' : 'setRangeTo')}
              className={`w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left ${!currentId ? 'bg-app-elevated' : ''}`}
            >
              <span className="text-sm text-zinc-400 italic">
                {isFrom ? 'No lower limit (all sets)' : 'No upper limit (present)'}
              </span>
              {!currentId && <CheckIcon />}
            </button>

            {setsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {!setsLoading && sets === null && (
              <p className="text-center text-sm text-zinc-600 py-8">Failed to load sets</p>
            )}

            {filteredSets.map((set) => {
              const isSelected = set.id === currentId;
              return (
                <button
                  key={set.id}
                  onClick={() => handlePickSet(set)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-app-border active:bg-app-elevated touch-manipulation text-left ${isSelected ? 'bg-app-elevated' : ''}`}
                >
                  {set.images?.symbol ? (
                    <Image
                      src={set.images.symbol}
                      alt=""
                      width={24}
                      height={24}
                      className="flex-shrink-0 object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="w-6 h-6 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{set.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {set.series} · {set.releaseDate.slice(0, 4)} · {set.printedTotal} cards
                    </p>
                  </div>
                  {isSelected && <CheckIcon />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Favorites picker view ── */
  if (view === 'pick-favorites') {
    const { favoriteFormats } = settings;
    function toggleFavorite(id: string) {
      const next = favoriteFormats.includes(id)
        ? favoriteFormats.filter((f) => f !== id)
        : [...favoriteFormats, id];
      dispatch({ type: 'UPDATE_SETTINGS', settings: { favoriteFormats: next } });
    }
    return (
      <div className="fixed inset-0 z-[60] flex flex-col">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col h-full bg-app-surface">
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-app-border">
            <button
              onClick={() => setView('main')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-app-elevated text-zinc-400 active:bg-app-muted touch-manipulation"
              aria-label="Back"
            >
              <BackIcon />
            </button>
            <h2 className="flex-1 text-sm font-semibold text-zinc-100">Popular Formats</h2>
          </div>
          <p className="px-4 py-3 text-[11px] text-zinc-500 border-b border-app-border">
            Checked formats appear at the top of format pickers.
          </p>
          <div className="flex-1 overflow-y-auto">
            {FORMATS.map((f) => {
              const checked = favoriteFormats.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggleFavorite(f.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
                >
                  <div className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center ${checked ? 'bg-white border-white' : 'border-zinc-600'}`}>
                    {checked && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1.5 5.5l3 3 5-5" stroke="#09090b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100">{f.name}</p>
                    <p className="text-[11px] text-zinc-500">{f.category === 'official' ? 'Official' : 'Retro'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main settings view ── */
  return (
    <>
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col h-full bg-app-surface">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-app-border">
          <h2 className="text-base font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 active:bg-zinc-700 touch-manipulation"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Default card filter */}
        <div className="px-4 py-5 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Default Card Filter
          </p>
          <div className="flex gap-2">
            {(['all', 'missing'] as const).map((f) => (
              <button
                key={f}
                onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { defaultCardFilter: f } })}
                className={`flex-1 py-2.5 text-sm font-medium rounded border touch-manipulation transition-colors ${
                  settings.defaultCardFilter === f
                    ? 'bg-white text-zinc-900 border-white'
                    : 'border-zinc-700 text-zinc-400 active:bg-app-elevated'
                }`}
              >
                {f === 'all' ? 'All' : 'Missing only'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2.5 leading-relaxed">
            Which cards are shown by default when opening a deck or the All Cards view.
          </p>
        </div>

        {/* Default deck format */}
        <div className="px-4 py-5 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Default Deck Format
          </p>
          <button
            onClick={() => setShowDefaultFormatPicker(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded border border-app-border bg-app-elevated active:bg-app-muted touch-manipulation"
          >
            <span className="text-sm text-zinc-100">
              {settings.defaultDeckFormat
                ? (getFormat(settings.defaultDeckFormat)?.name ?? settings.defaultDeckFormat)
                : 'None'}
            </span>
            <ChevronIcon />
          </button>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-zinc-600 leading-relaxed flex-1">
              Pre-selected format when creating a new deck.
            </p>
            <button
              onClick={() => setView('pick-favorites')}
              className="ml-4 text-xs text-zinc-500 active:text-zinc-300 touch-manipulation flex-shrink-0"
            >
              Edit popular
            </button>
          </div>
        </div>

        {/* Sort order */}
        <div className="px-4 py-5 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Sort Order
          </p>
          <div className="flex gap-2">
            {(['asc', 'desc'] as const).map((order) => (
              <button
                key={order}
                onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { searchSortOrder: order } })}
                className={`flex-1 py-2.5 text-sm font-medium rounded border touch-manipulation transition-colors ${
                  settings.searchSortOrder === order
                    ? 'bg-white text-zinc-900 border-white'
                    : 'border-zinc-700 text-zinc-400 active:bg-app-elevated'
                }`}
              >
                {order === 'asc' ? 'Old → New' : 'New → Old'}
              </button>
            ))}
          </div>
        </div>

        {/* Set filter */}
        <div className="px-4 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Set Filter
            </p>
            {hasFilter && (
              <button
                onClick={clearRange}
                className="text-xs text-zinc-500 active:text-zinc-300 touch-manipulation"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="border border-app-border rounded overflow-hidden">
            {/* From */}
            <button
              onClick={() => openPicker('pick-from')}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-app-border active:bg-app-elevated touch-manipulation text-left"
            >
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">From</p>
                {settings.setRangeFrom ? (
                  <p className="text-sm text-zinc-100">{settings.setRangeFrom.name}</p>
                ) : (
                  <p className="text-sm text-zinc-500 italic">All sets</p>
                )}
              </div>
              <ChevronIcon />
            </button>

            {/* To */}
            <button
              onClick={() => openPicker('pick-to')}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-app-elevated touch-manipulation text-left"
            >
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">To</p>
                {settings.setRangeTo ? (
                  <p className="text-sm text-zinc-100">{settings.setRangeTo.name}</p>
                ) : (
                  <p className="text-sm text-zinc-500 italic">Present</p>
                )}
              </div>
              <ChevronIcon />
            </button>
          </div>

          <p className="text-[11px] text-zinc-600 mt-2.5 leading-relaxed">
            {hasFilter
              ? 'Applies to all card searches, the scanner, and ambiguous match candidates.'
              : 'Restrict results to cards from a specific set range. Applies everywhere.'}
          </p>
        </div>
      </div>
    </div>

    {showDefaultFormatPicker && (
      <FormatPicker
        currentFormatId={settings.defaultDeckFormat}
        onSelect={(id) => dispatch({ type: 'UPDATE_SETTINGS', settings: { defaultDeckFormat: id } })}
        onClose={() => setShowDefaultFormatPicker(false)}
      />
    )}
    </>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
