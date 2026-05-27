'use client';

import { useState } from 'react';
import { FORMATS, getFormat } from '@/services/formats';
import { useAppContext } from '@/context/AppContext';
import { FormatPicker } from '@/components/formats/FormatPicker';
import { clearState, loadState } from '@/services/storage';

type View = 'main' | 'pick-favorites';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppContext();
  const { settings } = state;

  const [view, setView] = useState<View>('main');
  const [showDefaultFormatPicker, setShowDefaultFormatPicker] = useState(false);

  function handleResetLocalData() {
    const ok = window.confirm(
      'Delete all lists, cards, and settings on this device? This cannot be undone.',
    );
    if (!ok) return;
    clearState();
    dispatch({ type: 'LOAD', payload: loadState() });
    onClose();
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
            <h2 className="flex-1 text-sm font-semibold text-zinc-100">Favorite Formats</h2>
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

        <div className="flex-1 overflow-y-auto">
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
            Which cards are shown by default when opening a list or the All Cards view.
          </p>
        </div>

        {/* Default deck format */}
        <div className="px-4 py-5 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Default List Format
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
              Pre-selected format when creating a new list.
            </p>
            <button
              onClick={() => setView('pick-favorites')}
              className="ml-4 text-xs text-zinc-500 active:text-zinc-300 touch-manipulation flex-shrink-0"
            >
              Edit favorites
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

        {/* Data on this device */}
        <div className="px-4 py-5">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">
            Your data
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Lists, cards, and settings are saved on this device only (browser local storage).
            We do not use cookies for that. There is no account and nothing is stored on our servers.
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-2.5">
            If you use Analyze (photo or pasted list), that content is sent to our server and
            Anthropic only for that request so we can read card names.
          </p>
          <button
            type="button"
            onClick={handleResetLocalData}
            className="mt-4 w-full py-2.5 text-sm font-medium rounded border border-red-900/60 text-red-400 active:bg-red-950/40 touch-manipulation"
          >
            Delete all local data
          </button>
        </div>
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

