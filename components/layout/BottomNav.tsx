'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const NAV_H    = 64;   // px — nav bar height
const BTN_D    = 56;   // px — FAB diameter
const BTN_RISE = 16;   // px — how far FAB protrudes above nav top border
// px from container bottom edge to FAB bottom edge
const BTN_BTM  = NAV_H + BTN_RISE - BTN_D; // = 24

const RING_R   = 23;   // px — progress ring radius
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2); // ≈ 144.51

const LONG_MS  = 1000; // ms — hold duration to trigger scan
const TAP_MS   = 200;  // ms — max duration for a quick tap

export function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [pressing,  setPressing]  = useState(false);
  const [ringFill,  setRingFill]  = useState(false);
  const pressStart  = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delay filling the ring by one frame so the CSS transition actually fires
  useEffect(() => {
    if (!pressing) { setRingFill(false); return; }
    const id = setTimeout(() => setRingFill(true), 16);
    return () => clearTimeout(id);
  }, [pressing]);

  function cancelPress() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPressing(false);
  }

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pressStart.current = Date.now();
    setPressing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPressing(false);
      router.push('/search?scan=1');
    }, LONG_MS);
  }

  function onUp() {
    const elapsed = Date.now() - pressStart.current;
    cancelPress();
    if (elapsed < TAP_MS) router.push('/search');
    // Between TAP_MS and LONG_MS: released too early → no-op
  }

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Nav background */}
      <div className="absolute inset-0 bg-app-surface border-t border-app-border md:border-x" />

      {/* Nav items row */}
      <div className="relative flex items-center" style={{ height: NAV_H }}>
        <Link
          href="/decks"
          aria-label="Lists"
          className={`flex-1 flex items-center justify-center h-full touch-manipulation ${
            pathname.startsWith('/decks') ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <NavListIcon />
        </Link>

        {/* Space reserved for the FAB */}
        <div style={{ width: BTN_D + 24 }} />

        <Link
          href="/all-cards"
          aria-label="All Cards"
          className={`flex-1 flex items-center justify-center h-full touch-manipulation ${
            pathname.startsWith('/all-cards') ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <NavGridIcon />
        </Link>
      </div>

      {/* FAB — centered search button protruding above nav */}
      <button
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={cancelPress}
        aria-label="Search"
        className="absolute left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center touch-manipulation select-none"
        style={{
          width: BTN_D,
          height: BTN_D,
          bottom: `calc(${BTN_BTM}px + env(safe-area-inset-bottom))`,
          zIndex: 10,
          WebkitUserSelect: 'none',
          backgroundColor: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}
      >
        {/* Progress ring — fills over LONG_MS when holding */}
        <svg
          width={BTN_D}
          height={BTN_D}
          viewBox={`0 0 ${BTN_D} ${BTN_D}`}
          className="absolute inset-0 pointer-events-none"
          style={{ transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          <circle
            cx={BTN_D / 2}
            cy={BTN_D / 2}
            r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={ringFill ? 0 : RING_C}
            style={{
              transition: pressing
                ? `stroke-dashoffset ${LONG_MS}ms linear`
                : 'none',
            }}
          />
        </svg>

        <NavSearchIcon active={pathname.startsWith('/search')} />
      </button>
    </div>
  );
}

function NavListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="4" cy="6"  r="1.5" fill="currentColor" />
      <path d="M8 6h10"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="11" r="1.5" fill="currentColor" />
      <path d="M8 11h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="16" r="1.5" fill="currentColor" />
      <path d="M8 16h7"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NavSearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      className={active ? 'text-white' : 'text-zinc-300'}
    >
      <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NavGridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2"  y="2"  width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="12" y="2"  width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="2"  y="12" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="12" y="12" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
