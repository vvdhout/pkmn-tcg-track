'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/decks',
    label: 'Lists',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="4" cy="6" r="1.5" fill="currentColor" />
        <path d="M8 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="4" cy="11" r="1.5" fill="currentColor" />
        <path d="M8 11h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="4" cy="16" r="1.5" fill="currentColor" />
        <path d="M8 16h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/all-cards',
    label: 'All Cards',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="12" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="2" y="12" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="12" y="12" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Search',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 14l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 flex justify-around items-center bg-app-surface border-t border-app-border md:border-x md:border-app-border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`flex items-center justify-center px-8 py-3 transition-colors touch-manipulation ${
              active ? 'text-white' : 'text-zinc-500'
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </nav>
  );
}
