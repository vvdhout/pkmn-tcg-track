'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';

const NAV_H    = 64;   // px — nav bar height
const BTN_D    = 56;   // px — FAB diameter
const BTN_RISE = 16;   // px — protrusion above nav border
const BTN_BTM  = NAV_H + BTN_RISE - BTN_D; // = 24

const RING_R   = 23;   // px — progress ring radius
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2); // ≈ 144.51

const LONG_MS  = 1000; // ms — hold duration to trigger camera
const TAP_MS   = 200;  // ms — max duration for a quick tap

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
  const pathname = usePathname();
  const router   = useRouter();

  // 0-1 driven by RAF during hold; controls ring fill + icon cross-fade
  const [holdProgress, setHoldProgress] = useState(0);
  // True when the full-screen file input overlay is active
  const [armed, setArmed] = useState(false);

  const pressing    = useRef(false);
  const pressStart  = useRef(0);
  const animFrameId = useRef<number | null>(null);
  const buttonRef   = useRef<HTMLButtonElement | null>(null);
  const capturedPtr = useRef<number | null>(null);

  // Safety: clear armed if camera was dismissed without a photo
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(id);
  }, [armed]);

  function stopAnimation() {
    if (animFrameId.current !== null) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
  }

  function startAnimation() {
    const start = Date.now();
    function frame() {
      const progress = Math.min((Date.now() - start) / LONG_MS, 1);
      setHoldProgress(progress);

      if (progress < 1) {
        animFrameId.current = requestAnimationFrame(frame);
        return;
      }

      // Hold complete ─────────────────────────────────────────────────────
      animFrameId.current = null;
      pressing.current    = false;
      navigator.vibrate?.(50); // haptic on Android; silently ignored on iOS

      // flushSync puts the full-screen file input into the DOM *before* we
      // release pointer capture, so the user's lifted finger natively
      // activates the input — the only method that works on iOS Safari.
      flushSync(() => {
        setArmed(true);
        setHoldProgress(1);
      });
      if (buttonRef.current && capturedPtr.current !== null) {
        buttonRef.current.releasePointerCapture(capturedPtr.current);
        capturedPtr.current = null;
      }
    }
    animFrameId.current = requestAnimationFrame(frame);
  }

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    buttonRef.current  = e.currentTarget;
    capturedPtr.current = e.pointerId;
    pressStart.current = Date.now();
    pressing.current   = true;
    setHoldProgress(0);
    startAnimation();
  }

  function onUp() {
    if (!pressing.current) return;
    const elapsed = Date.now() - pressStart.current;
    pressing.current = false;
    stopAnimation();
    setHoldProgress(0);
    if (elapsed < TAP_MS) router.push('/search');
    // Partial hold (TAP_MS < elapsed < LONG_MS): cancel, no action
  }

  function onCancel() {
    if (armed) return; // let the armed overlay handle cleanup
    pressing.current = false;
    stopAnimation();
    setHoldProgress(0);
  }

  async function onFileCaptured(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setArmed(false);
    setHoldProgress(0);
    if (!file) return;
    try {
      const { base64, mediaType } = await compressImage(file);
      sessionStorage.setItem('nav-scan-image', JSON.stringify({ base64, mediaType }));
      // Notify the search page even if it is already mounted
      window.dispatchEvent(new CustomEvent('nav-scan-ready'));
    } catch { /* navigate anyway */ }
    router.push('/search');
  }

  const dashOffset = RING_C * (1 - holdProgress);
  const isHolding  = holdProgress > 0;

  return (
    <>
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

        {/* FAB ─ tap for search, hold 1 s for camera scan */}
        <button
          ref={buttonRef}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          aria-label="Search or hold to scan cards"
          className="absolute left-1/2 rounded-full flex items-center justify-center touch-manipulation select-none overflow-hidden"
          style={{
            width: BTN_D,
            height: BTN_D,
            bottom: `calc(${BTN_BTM}px + env(safe-area-inset-bottom))`,
            zIndex: 10,
            WebkitUserSelect: 'none',
            backgroundColor: '#1c1c1e',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            // Subtle scale-up during hold, spring back on release
            transform: `translateX(-50%) scale(${1 + holdProgress * 0.1})`,
            transition: pressing.current ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Progress ring */}
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

          {/* Icon cross-fade: search → camera as holdProgress rises */}
          <div className="relative flex items-center justify-center" style={{ width: 22, height: 22 }}>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: 1 - holdProgress, transition: isHolding ? 'none' : 'opacity 0.2s' }}
            >
              <NavSearchIcon active={pathname.startsWith('/search')} />
            </div>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: holdProgress, transition: isHolding ? 'none' : 'opacity 0.2s' }}
            >
              <NavCameraIcon />
            </div>
          </div>
        </button>
      </div>

      {/* Full-screen file input overlay ─────────────────────────────────
          Only raised to z-index 200 when armed. After releasePointerCapture
          the user's ongoing touch is over this invisible input, so lifting
          the finger fires a native touchend directly on the input element —
          the only way to reliably open the camera on iOS Safari. */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileCaptured}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          zIndex: armed ? 200 : -1,
          pointerEvents: armed ? 'auto' : 'none',
        }}
      />
    </>
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-200">
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
