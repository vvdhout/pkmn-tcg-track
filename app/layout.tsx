import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'Pokémon TCG Tracker',
  description: 'Track your Pokémon Trading Card Game collection',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0c0c0c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-app-bg">
        <AppProvider>
          <div className="relative mx-auto max-w-lg min-h-full">
            <main className="min-h-full overflow-y-auto">{children}</main>
            <BottomNav />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
