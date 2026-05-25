'use client';

import { useState } from 'react';

interface CreateDeckModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateDeckModal({ open, onClose, onCreate }: CreateDeckModalProps) {
  const [name, setName] = useState('');

  if (!open) return null;

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-app-surface border-t border-app-border p-4 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-100 mb-4">New Deck</h2>
        <input
          autoFocus
          type="text"
          placeholder="Deck name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-4 py-3 rounded bg-app-elevated border border-app-border text-zinc-100 text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600 mb-3"
        />
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
            className="flex-1 py-3 rounded bg-green-600 text-white text-sm font-semibold active:bg-green-700 disabled:opacity-40 touch-manipulation"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
