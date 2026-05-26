'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';

const NAV_H    = 64;
const BTN_D    = 56;
const BTN_RISE = 16;
const BTN_BTM  = NAV_H + BTN_RISE - BTN_D; // = 24

const RING_R   = 23;
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2);

// Center indicator circle
const IND_SIZE = 120; // px — diameter of the HUD circle
const IND_R    = 50;  // ring radius inside IND_SIZE viewbox
const IND_C    = +(2 * Math.PI * IND_R).toFixed(2);

const LONG_MS       = 1000;
const TAP_MS        = 200;
const HOLD_DELAY_MS = 150; // don't show any visual feedback before this

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

  const [holdProgress, setHoldProgress] = useState(0); // 0-1
  const [armed,        setArmed]        = useState(false);
  const [snapped,      setSnapped]      = useState(false); // brief flash at completion

  const pressing    = useRef(false);
  const pressStart  = useRef(0);
  const animFrameId = useRef<number | null>(null);
  const buttonRef   = useRef<HTMLButtonElement | null>(null);
  const capturedPtr = useRef<number | null>(null);
  // Hidden input kept in the DOM so we can focus it synchronously during
  // the tap gesture, opening the keyboard before navigation. iOS won't
  // allow focusing inputs created after a gesture, but moving focus between
  // two inputs (trap → real search input) keeps the keyboard open.
  const trapInputRef = useRef<HTMLInputElement | null>(null);

  // When armed clears (camera closed or photo taken) → reset hold state.
  // Also detects camera dismissal instantly via visibilitychange / focus so
  // the UI doesn't stay stuck in the "armed" state when the user cancels.
  useEffect(() => {
    if (!armed) {
      setHoldProgress(0);
      return;
    }

    function clear() { setArmed(false); }
    function onVisibility() { if (!document.hidden) clear(); }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', clear);
    const timeout = setTimeout(clear, 3000); // short fallback

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', clear);
      clearTimeout(timeout);
    };
  }, [armed]);

  function stopAnimation() {
    if (animFrameId.current !== null) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
  }

  function startAnimation() {
    const start = Date.now();
    const VISUAL_MS = LONG_MS - HOLD_DELAY_MS; // 850 ms of actual animation

    function frame() {
      const elapsed = Date.now() - start;

      if (elapsed >= LONG_MS) {
        // Hold complete
        animFrameId.current = null;
        pressing.current    = false;
        navigator.vibrate?.(60);
        setSnapped(true);
        setTimeout(() => setSnapped(false), 300);
        flushSync(() => {
          setArmed(true);
          setHoldProgress(1);
        });
        if (buttonRef.current && capturedPtr.current !== null) {
          buttonRef.current.releasePointerCapture(capturedPtr.current);
          capturedPtr.current = null;
        }
        return;
      }

      // Only start showing visual feedback after the delay so quick taps
      // never trigger any animation at all.
      if (elapsed >= HOLD_DELAY_MS) {
        setHoldProgress((elapsed - HOLD_DELAY_MS) / VISUAL_MS);
      }

      animFrameId.current = requestAnimationFrame(frame);
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
    setSnapped(false);
    startAnimation();
  }

  function onUp() {
    if (!pressing.current) return;
    const elapsed = Date.now() - pressStart.current;
    pressing.current = false;
    stopAnimation();
    setHoldProgress(0);
    if (elapsed < TAP_MS) {
      if (pathname.startsWith('/search')) {
        // Already on search — dispatchEvent is synchronous so the listener
        // runs inside the touch handler call stack; iOS treats it as a valid
        // gesture and allows the focus. No trap needed (avoids flicker).
        window.dispatchEvent(new CustomEvent('search-focus-request'));
      } else {
        // Focus the trap input first so iOS opens the keyboard during this
        // gesture. CardSearch's useEffect then steals focus on mount; moving
        // focus between two inputs keeps the keyboard open.
        trapInputRef.current?.focus();
        router.push('/search');
      }
    }
    // Partial hold: cancel, no action
  }

  function onCancel() {
    if (armed) return;
    pressing.current = false;
    stopAnimation();
    setHoldProgress(0);
  }

  async function onFileCaptured(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setArmed(false); // triggers useEffect → setHoldProgress(0) → icon resets to search
    if (!file) return;
    try {
      const { base64, mediaType } = await compressImage(file);
      sessionStorage.setItem('nav-scan-image', JSON.stringify({ base64, mediaType }));
      window.dispatchEvent(new CustomEvent('nav-scan-ready'));
    } catch { /* navigate anyway */ }
    router.push('/search');
  }

  const fabDashOffset = RING_C * (1 - holdProgress);
  const indDashOffset = IND_C  * (1 - holdProgress);
  const showHUD       = holdProgress > 0; // visible during hold AND while armed

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
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Search or hold to scan cards"
          className="absolute left-1/2 rounded-full flex items-center justify-center touch-manipulation select-none"
          style={{
            width: BTN_D,
            height: BTN_D,
            bottom: `calc(${BTN_BTM}px + env(safe-area-inset-bottom))`,
            zIndex: 10,
            WebkitUserSelect: 'none',
            backgroundColor: '#1c1c1e',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: snapped
              ? '0 0 0 8px rgba(255,255,255,0.18), 0 4px 24px rgba(0,0,0,0.6)'
              : '0 4px 24px rgba(0,0,0,0.6)',
            transform: `translateX(-50%) scale(${snapped ? 1.15 : 1 + holdProgress * 0.08})`,
            transition: pressing.current
              ? 'box-shadow 0.15s, transform 0.15s'
              : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
          }}
        >
          {/* Progress ring on the button border */}
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
              strokeDashoffset={fabDashOffset}
            />
          </svg>

          {/* Icon cross-fade: search → camera */}
          <div className="relative flex items-center justify-center" style={{ width: 22, height: 22 }}>
            <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 1 - holdProgress }}>
              <NavSearchIcon active={pathname.startsWith('/search')} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: holdProgress }}>
              <NavCameraIcon small />
            </div>
          </div>
        </button>
      </div>

      {/* ── Centre HUD ─────────────────────────────────────────────────────
          Shown during hold so the user can see the progress above their finger. */}
      {showHUD && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ zIndex: 49 }}
        >
          <div
            style={{
              opacity: Math.min(holdProgress * 4, 1), // fades in fast at start of hold
              transform: `scale(${0.75 + holdProgress * 0.25})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {/* Circle with progress ring + camera icon */}
            <div style={{ position: 'relative', width: IND_SIZE, height: IND_SIZE }}>
              <svg
                width={IND_SIZE}
                height={IND_SIZE}
                viewBox={`0 0 ${IND_SIZE} ${IND_SIZE}`}
                style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
              >
                {/* Background fill */}
                <circle
                  cx={IND_SIZE / 2}
                  cy={IND_SIZE / 2}
                  r={IND_SIZE / 2 - 2}
                  fill="rgba(20,20,22,0.88)"
                />
                {/* Subtle border */}
                <circle
                  cx={IND_SIZE / 2}
                  cy={IND_SIZE / 2}
                  r={IND_SIZE / 2 - 2}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1.5"
                />
                {/* Progress ring */}
                <circle
                  cx={IND_SIZE / 2}
                  cy={IND_SIZE / 2}
                  r={IND_R}
                  fill="none"
                  stroke={snapped ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.9)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={IND_C}
                  strokeDashoffset={indDashOffset}
                />
              </svg>
              {/* Camera icon centred inside the circle */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <NavCameraIcon />
              </div>
            </div>

            {/* Label */}
            <p
              style={{
                fontSize: 12,
                color: holdProgress >= 1 ? 'rgba(212,212,216,1)' : 'rgba(113,113,122,1)',
                letterSpacing: '0.04em',
                fontWeight: 500,
                transition: 'color 0.2s',
              }}
            >
              {holdProgress >= 1 ? 'Release to open camera' : 'Keep holding…'}
            </p>
          </div>
        </div>
      )}

      {/* Full-screen file input ─────────────────────────────────────────
          Raised to z-index 200 when armed so the user's lifted finger
          fires a native touchend on it, bypassing iOS Safari's restriction
          on programmatic input.click() calls. */}
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

      {/* Keyboard focus trap — always in DOM so FAB tap can focus it
          synchronously within the iOS gesture context, keeping the keyboard
          open until CardSearch's input steals focus on mount.
          Must not be readOnly or iOS won't show the keyboard. */}
      <input
        ref={trapInputRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'fixed', top: 0, left: -9999, width: 1, height: 1, opacity: 0.001, border: 'none', padding: 0 }}
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

function NavCameraIcon({ small }: { small?: boolean }) {
  const size = small ? 22 : 36;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-zinc-200">
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
