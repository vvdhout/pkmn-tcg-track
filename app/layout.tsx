import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export const metadata: Metadata = {
  title: 'Pokémon TCG Tracker',
  description: 'Track your Pokémon Trading Card Game collection',
  appleWebApp: {
    capable: true,
    title: 'TCG Tracker',
    statusBarStyle: 'black-translucent',
  },
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
          <div className="relative mx-auto max-w-lg h-full md:border-x md:border-app-border md:bg-app-bg md:shadow-[0_0_80px_rgba(0,0,0,0.85)]">
            <main className="h-full overflow-hidden">{children}</main>
            <InstallPrompt />
            <BottomNav />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
