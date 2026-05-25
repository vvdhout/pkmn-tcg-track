'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/decks',
    label: 'Decks',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 6V5a2 2 0 012-2h6a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 11h8M7 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around items-end bg-app-surface border-t border-app-border pb-safe">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-6 py-3 text-xs font-medium transition-colors touch-manipulation ${
              active ? 'text-green-400' : 'text-zinc-500'
            }`}
          >
            <span className={active ? 'text-green-400' : 'text-zinc-500'}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
