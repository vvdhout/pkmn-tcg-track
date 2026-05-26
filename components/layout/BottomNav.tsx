'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

const NAV_H    = 64;   // px — nav bar height
const BTN_D    = 56;   // px — FAB diameter
const BTN_RISE = 16;   // px — how far FAB protrudes above nav border
const BTN_BTM  = NAV_H + BTN_RISE - BTN_D; // = 24 px

const RING_R   = 23;   // px — progress ring radius
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2); // ≈ 144.51

const TRIGGER  = 55;   // px of upward drag to arm the camera
const MAX_DRAG = 90;   // px max visual travel
const TAP_MS   = 200;  // ms max for a quick tap

async function compressImage(file: File, maxDim = 1024): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], mediaType: 'image/jpeg' });
        URL.revokeObjectURL(url);
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function BottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [dragY, setDragY]       = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY     = useRef(0);
  const pressStart = useRef(0);
  const fileRef    = useRef<HTMLInputElement>(null);

  const drag         = Math.min(Math.max(dragY, 0), MAX_DRAG);
  const triggered    = drag >= TRIGGER;
  const ringProgress = Math.min(drag / TRIGGER, 1);
  const dashOffset   = RING_C * (1 - ringProgress);

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current    = e.clientY;
    pressStart.current = Date.now();
    setDragging(true);
    setDragY(0);
  }
  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    setDragY(Math.max(0, startY.current - e.clientY));
  }
  function onUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    const dy      = Math.max(0, startY.current - e.clientY);
    const elapsed = Date.now() - pressStart.current;
    setDragging(false);
    setDragY(0);
    if (dy >= TRIGGER) {
      // Still inside the pointer-up user-gesture — browser allows camera open
      fileRef.current?.click();
    } else if (dy < 10 && elapsed < TAP_MS) {
      router.push('/search');
    }
    // Partial drag that didn't reach TRIGGER: cancel, no navigation
  }
  function onCancel() { setDragging(false); setDragY(0); }

  async function onFileCaptured(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { base64, mediaType } = await compressImage(file);
      sessionStorage.setItem('nav-scan-image', JSON.stringify({ base64, mediaType }));
    } catch { /* navigate anyway */ }
    router.push('/search');
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

      {/* FAB — swipe up to open camera, tap to search */}
      <button
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        aria-label="Search or scan cards"
        className="absolute left-1/2 rounded-full flex items-center justify-center touch-manipulation select-none"
        style={{
          width: BTN_D,
          height: BTN_D,
          bottom: `calc(${BTN_BTM}px + env(safe-area-inset-bottom))`,
          zIndex: 10,
          WebkitUserSelect: 'none',
          backgroundColor: triggered ? '#e4e4e7' : '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          transform: `translateX(-50%) translateY(${-drag}px)`,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background-color 0.15s',
        }}
      >
        {/* Progress ring — fills as drag approaches TRIGGER */}
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
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={dashOffset}
          />
        </svg>

        {triggered
          ? <NavCameraIcon />
          : <NavSearchIcon active={pathname.startsWith('/search')} />}
      </button>

      {/* Hidden camera input — triggered by swipe-up gesture */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileCaptured}
      />
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
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className={active ? 'text-white' : 'text-zinc-300'}>
      <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NavCameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
      <path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
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
