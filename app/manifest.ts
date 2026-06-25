import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pokémon TCG Tracker',
    short_name: 'TCG Tracker',
    description: 'Track your Pokémon Trading Card Game collection across decks',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0c0c',
    theme_color: '#0c0c0c',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
