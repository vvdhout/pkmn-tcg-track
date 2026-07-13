export interface Format {
  id: string;
  name: string;
  category: 'official' | 'retro';
  fromDate?: string; // YYYY/MM/DD — undefined = no lower bound
  toDate?: string;   // YYYY/MM/DD — undefined = no upper bound (present)
}

// Ordered newest → oldest within each category
export const FORMATS: Format[] = [
  // ── Official ──────────────────────────────────────────────────────────────
  {
    id: 'standard',
    name: 'Standard (2025–26)',
    category: 'official',
    fromDate: '2024/03/22', // Temporal Forces — first H-mark set
  },
  {
    id: 'expanded',
    name: 'Expanded',
    category: 'official',
    fromDate: '2011/04/25', // Black & White base set
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    category: 'official',
    // no fromDate / toDate — all sets legal
  },
  // ── Retro ─────────────────────────────────────────────────────────────────
  {
    id: 'swsh',
    name: 'Sword & Shield Era',
    category: 'retro',
    fromDate: '2020/02/07', // Sword & Shield base
    toDate: '2023/01/20',   // Crown Zenith
  },
  {
    id: 'sm',
    name: 'Sun & Moon Era',
    category: 'retro',
    fromDate: '2017/02/03', // Sun & Moon base
    toDate: '2019/12/06',   // Cosmic Eclipse
  },
  {
    id: 'xy',
    name: 'XY Era',
    category: 'retro',
    fromDate: '2014/02/05', // XY base
    toDate: '2016/11/02',   // XY Evolutions
  },
  {
    id: 'bw',
    name: 'Black & White Era',
    category: 'retro',
    fromDate: '2011/04/25', // Black & White base
    toDate: '2013/11/08',   // Legendary Treasures
  },
  {
    id: 'hgss',
    name: 'HGSS Era',
    category: 'retro',
    fromDate: '2010/02/10', // HeartGold & SoulSilver base
    toDate: '2011/02/09',   // Call of Legends
  },
  {
    id: 'dp',
    name: 'Diamond & Pearl Era',
    category: 'retro',
    fromDate: '2007/05/23', // Diamond & Pearl base
    toDate: '2009/11/04',   // Arceus
  },
  {
    id: 'ex',
    name: 'EX Era',
    category: 'retro',
    fromDate: '2003/07/18', // EX Ruby & Sapphire
    toDate: '2007/02/14',   // EX Power Keepers
  },
  {
    id: 'ecard',
    name: 'E-Card Era',
    category: 'retro',
    fromDate: '2002/09/15', // Expedition Base Set
    toDate: '2003/05/12',   // Skyridge
  },
  {
    id: 'base-neo',
    name: 'Base–Neo',
    category: 'retro',
    fromDate: '1998/12/01', // Base Set
    toDate: '2002/02/28',   // Neo Destiny
  },
  {
    id: 'base-neo-points',
    name: 'Base–Neo (Point-Buy)',
    category: 'retro',
    fromDate: '1998/12/01', // Base Set
    toDate: '2002/02/28',   // Neo Destiny
  },
  {
    id: 'neo-on',
    name: 'Neo-On',
    category: 'retro',
    fromDate: '2000/12/16', // Neo Genesis
    toDate: '2002/02/28',   // Neo Destiny
  },
  {
    id: 'base-gym',
    name: 'Base–Gym',
    category: 'retro',
    fromDate: '1998/12/01', // Base Set
    toDate: '2000/10/16',   // Gym Challenge
  },
  {
    id: 'base-rocket',
    name: 'Base–Rocket',
    category: 'retro',
    fromDate: '1998/12/01', // Base Set
    toDate: '2000/04/24',   // Team Rocket
  },
  {
    id: 'base-fossil',
    name: 'Base–Fossil',
    category: 'retro',
    fromDate: '1998/12/01', // Base Set
    toDate: '1999/10/10',   // Fossil
  },
];

export function getFormat(id: string): Format | undefined {
  return FORMATS.find((f) => f.id === id);
}

export function formatFilterLabel(formatIds: string[] | undefined): string {
  if (!formatIds || formatIds.length === 0) return 'All sets';
  if (formatIds.length < 4) {
    return formatIds.map((id) => getFormat(id)?.name ?? id).join(' · ');
  }
  return `${formatIds.length} formats`;
}
