'use client';

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getFormat } from '@/services/formats';
import { FormatPicker } from '@/components/formats/FormatPicker';

interface CreateDeckModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, format?: string) => void;
}

export function CreateDeckModal({ open, onClose, onCreate }: CreateDeckModalProps) {
  const { state } = useAppContext();
  const [name, setName] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(
    state.settings.defaultDeckFormat,
  );
  const [showFormatPicker, setShowFormatPicker] = useState(false);

  if (!open) return null;

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, selectedFormat ?? undefined);
    setName('');
    setSelectedFormat(state.settings.defaultDeckFormat);
    onClose();
  }

  const formatName = selectedFormat ? (getFormat(selectedFormat)?.name ?? selectedFormat) : 'None';

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative bg-app-surface border-t border-app-border p-4 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-base font-semibold text-zinc-100 mb-4">New List</h2>

          <input
            autoFocus
            type="text"
            placeholder="List name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full px-4 py-3 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600 mb-3"
          />

          {/* Format selector */}
          <button
            onClick={() => setShowFormatPicker(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded bg-app-elevated border border-app-border text-sm mb-3 active:bg-app-muted touch-manipulation"
          >
            <span className="text-zinc-500">Format</span>
            <div className="flex items-center gap-2">
              <span className={selectedFormat ? 'text-zinc-100' : 'text-zinc-600'}>{formatName}</span>
              <ChevronIcon />
            </div>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded bg-app-elevated border border-app-border text-zinc-400 text-sm font-medium active:bg-zinc-800 touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!name.trim()}
              className="flex-1 py-3 rounded bg-white text-zinc-900 text-sm font-semibold active:bg-zinc-200 disabled:opacity-40 touch-manipulation"
            >
              Create
            </button>
          </div>
        </div>
      </div>

      {showFormatPicker && (
        <FormatPicker
          currentFormatId={selectedFormat}
          onSelect={setSelectedFormat}
          onClose={() => setShowFormatPicker(false)}
        />
      )}
    </>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-600 flex-shrink-0">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
