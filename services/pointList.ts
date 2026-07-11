// Point list for the Base–Neo point-based format (PKMN 1999 Discord).
// Cards are worth 0–8 points; a deck may contain at most 8 points total.
// Any card not listed is worth 0 points.
//
// Lookup is by card name; where the same name exists with different point
// values across printings, entries carry a collector number to disambiguate
// (an entry without a number acts as the fallback for that name).

export const POINT_FORMAT_ID = 'base-neo-points';
export const MAX_DECK_POINTS = 8;

export function isPointFormat(formatId: string | undefined | null): boolean {
  return formatId === POINT_FORMAT_ID;
}

interface PointEntry {
  points: number;
  number?: string; // normalized collector number — omit to match any printing
}

// Keyed by normalized card name (see normalizeName below).
const POINT_LIST: Record<string, PointEntry[]> = {
  // ── 8 points ──────────────────────────────────────────────────────────────
  "erika's jigglypuff": [{ points: 8 }],
  'dark vileplume': [{ points: 8 }],

  // ── 7 points ──────────────────────────────────────────────────────────────
  muk: [{ points: 7 }],
  aerodactyl: [{ points: 7 }],

  // ── 6 / 3 points — Unown letters disambiguated by collector number ────────
  unown: [
    { points: 6, number: '51' }, // Unown U
    { points: 3, number: '59' }, // Unown Q
  ],

  // ── 5 points ──────────────────────────────────────────────────────────────
  'super energy removal': [{ points: 5 }],
  'chaos gym': [{ points: 5 }],

  // ── 4 points ──────────────────────────────────────────────────────────────
  feraligatr: [{ points: 4, number: '5' }], // Neo Genesis #5 only
  chansey: [{ points: 4 }],
  clefable: [{ points: 4 }],
  snorlax: [{ points: 4 }],
  lass: [{ points: 4 }],
  'imposter professor oak': [{ points: 4 }],
  "the rocket's trap": [{ points: 4 }],

  // ── 3 points ──────────────────────────────────────────────────────────────
  elekid: [{ points: 3 }],
  'mr. mime': [{ points: 3 }],
  'item finder': [{ points: 3 }],
  wigglytuff: [{ points: 3 }],

  // ── 2 points ──────────────────────────────────────────────────────────────
  blastoise: [{ points: 2 }],
  psyduck: [{ points: 2, number: '53' }],
  "misty's staryu": [{ points: 2, number: '92' }],
  electrode: [{ points: 2 }],
  'shining raichu': [{ points: 2 }],
  alakazam: [{ points: 2 }],
  sneasel: [{ points: 2 }],
  'focus band': [{ points: 2 }],
  'computer search': [{ points: 2 }],
  'gust of wind': [{ points: 2 }],
  'double gust': [{ points: 2 }],
  'energy removal': [{ points: 2 }],
  "rocket's sneak attack": [{ points: 2 }],
  'tickling machine': [{ points: 2 }],
  pichu: [
    { points: 2, number: '13' }, // Neo Genesis #13
    { points: 1 },               // any other printing
  ],
  cleffa: [
    { points: 2, number: '20' }, // Neo Genesis #20 (Eeeeeeek)
    { points: 1 },               // any other printing (e.g. #31)
  ],

  // ── 1 point ───────────────────────────────────────────────────────────────
  typhlosion: [{ points: 1 }],
  'dark crobat': [{ points: 1 }],
  'dark golbat': [{ points: 1 }],
  magby: [{ points: 1 }],
  magcargo: [{ points: 1 }],
  mew: [{ points: 1 }],
  tyrogue: [{ points: 1 }],
  murkrow: [{ points: 1 }],
  steelix: [{ points: 1 }],
  'ho-oh': [{ points: 1 }],
  blissey: [{ points: 1 }],
  ditto: [{ points: 1 }],
  igglybuff: [{ points: 1 }],
  noctowl: [{ points: 1 }],
  smoochum: [{ points: 1 }],
  arcanine: [{ points: 1 }],
  'scoop up': [{ points: 1 }],
  misty: [{ points: 1 }],
  "misty's wrath": [{ points: 1 }],
  'gold berry': [{ points: 1 }],
  'pokemon center': [{ points: 1 }],
  'trash exchange': [{ points: 1 }],
  "the rocket's training gym": [{ points: 1 }],
  'metal energy': [{ points: 1 }],
  'recycle energy': [{ points: 1 }],
};

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (Pokémon → pokemon)
    .replace(/[''`]/g, "'")          // unify apostrophes
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumber(n: string): string {
  const stripped = n.replace(/\/.*$/, '').trim();
  return stripped.replace(/^0+(?=\d)/, '');
}

/** Point value of a card in the Base–Neo point format. 0 if unlisted. */
export function getCardPoints(name: string, number: string): number {
  const key = normalizeName(name);
  // Unown cards may carry the letter in the name ("Unown [U]", "Unown U");
  // they are disambiguated by collector number instead.
  const entries = POINT_LIST[key] ?? (key.startsWith('unown') ? POINT_LIST.unown : undefined);
  if (!entries) return 0;

  const num = normalizeNumber(number);
  const byNumber = entries.find((e) => e.number !== undefined && e.number === num);
  if (byNumber) return byNumber.points;
  const fallback = entries.find((e) => e.number === undefined);
  return fallback?.points ?? 0;
}

/** Total points in a list, counting each copy (needed) of a card. */
export function getDeckPoints(cards: { name: string; number: string; needed: number }[]): number {
  return cards.reduce((sum, c) => sum + getCardPoints(c.name, c.number) * c.needed, 0);
}
