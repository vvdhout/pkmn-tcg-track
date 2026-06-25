'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa-install-dismissed-v1';

// Bottom offset clears the fixed BottomNav (64px) plus the iOS safe-area inset.
const BOTTOM = 'calc(72px + env(safe-area-inset-bottom))';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as desktop Safari but has a touch screen.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag when launched from Home Screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  // null = not yet decided (avoids SSR/first-paint flash)
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Only iOS Safari needs this — other platforms don't purge storage and
    // standalone (already installed) users don't need a prompt at all.
    if (!isIosDevice() || isStandalone()) return;

    const wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    setDismissed(wasDismissed);
    setExpanded(!wasDismissed); // first run opens the full banner
    setEligible(true);
  }, []);

  if (!eligible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setExpanded(false);
  }

  // Passive marker — shown after the user has dismissed the full banner once.
  if (dismissed && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label="Your data is stored only in this browser — tap to learn how to keep it permanently"
        className="fixed left-3 z-30 flex items-center gap-1.5 rounded-full bg-app-elevated/90 px-2.5 py-1 text-[11px] text-amber-300/90 backdrop-blur border border-amber-500/20 touch-manipulation"
        style={{ bottom: BOTTOM }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Not saved
      </button>
    );
  }

  // Full banner — instructions to add to Home Screen.
  return (
    <div
      className="fixed left-3 right-3 z-30 rounded bg-app-elevated border border-app-border shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
      style={{ bottom: BOTTOM }}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="mt-0.5 flex-shrink-0 text-amber-400">
          <WarnIcon />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white">Keep your collection safe</p>
          <p className="mt-1 text-[12px] leading-snug text-zinc-400">
            Safari deletes this app&apos;s data after about a week of not opening it. Add it
            to your Home Screen and your decks stay saved on this device.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-300">
            <span>Tap</span>
            <ShareIcon />
            <span>then</span>
            <span className="font-medium text-white">Add to Home Screen</span>
            <PlusSquareIcon />
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 -m-1 p-1 text-zinc-500 touch-manipulation"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l9 16H3l9-16z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

// The iOS Safari share glyph: a box with an up arrow.
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-sky-400">
      <path
        d="M12 3v11M12 3l-3.5 3.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10H5.5A1.5 1.5 0 004 11.5v7A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0018.5 10H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
