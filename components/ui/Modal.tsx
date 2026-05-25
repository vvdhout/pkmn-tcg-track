'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  fullScreen?: boolean;
}

export function Modal({ open, onClose, children, title, fullScreen }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={`relative z-10 mx-auto w-full max-w-lg ${
          fullScreen
            ? 'flex flex-col flex-1 h-full overflow-hidden'
            : 'mt-auto rounded-t-2xl bg-app-surface'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {fullScreen ? (
          <div className="flex flex-col h-full bg-app-surface overflow-hidden">
            {title && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
                <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 active:bg-zinc-700"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        ) : (
          <div className="rounded-t-2xl bg-app-surface">
            <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
              {title && <h2 className="text-base font-semibold text-zinc-100">{title}</h2>}
              <button
                onClick={onClose}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 active:bg-zinc-700"
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
            <div className="p-4">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
