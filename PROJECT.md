# Pokémon TCG Tracker — Project Reference

Mobile-first web app for tracking a Pokémon TCG card collection across multiple decks.
Deployed on Vercel, repo at github.com/vvdhout/pkmn-tcg-track.

---

## What it does

- **Decks view** — create and delete decks; each deck shows a progress bar (collected/needed)
- **Deck detail** — add cards via search, track collected vs needed per card with −/count/+, filter by type/status, delete deck at bottom
- **All Cards view** — flat list of every card across all decks plus standalone cards, each labelled with its source deck; add standalone cards here
- Cards show: thumbnail (tappable for full-image popup), name, set code, prices, −/count/+ counter, edit button
- Complete cards (collected ≥ needed) get a green tint and sink to the bottom of their section
- Prices show as `from €X.XX/avg30 €X.XX` (tappable link to Cardmarket page)
- Data is persisted in **localStorage** — device-local, no accounts

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS **v4** (CSS-based config — no `tailwind.config.ts`) |
| State | React Context + `useReducer` (no Zustand) |
| Persistence | `localStorage` via `services/storage.ts` |
| Card data | [Pokémon TCG API](https://api.pokemontcg.io/v2) (free, optional key) |

**Tailwind v4 note:** Custom colours are declared with `@theme` in `app/globals.css`, not in a config file. Available custom tokens: `bg-app-bg`, `bg-app-surface`, `bg-app-elevated`, `bg-app-border`, `bg-app-muted`.

---

## File structure

```
app/
  layout.tsx          Root layout: AppProvider + BottomNav. main is h-full overflow-hidden.
  page.tsx            Redirects → /decks
  decks/
    page.tsx          Deck list. Has its own overflow-y-auto wrapper.
    [id]/page.tsx     Deck detail. flex-col h-full; header locked, CardListView scrolls.
  all-cards/page.tsx  All Cards view. Same flex-col pattern as deck detail.

components/
  layout/
    BottomNav.tsx     Fixed bottom nav. Active tab = white, inactive = zinc-500.
  cards/
    CardListView.tsx  Shared list view used by both deck detail and all-cards.
                      flex-col: locked StatsBar+FilterTabs on top, scrollable list below.
                      Accepts optional `footer` prop rendered at bottom of scroll area.
    CardListItem.tsx  Single card row: thumbnail, name, set/price, −/count/+, edit button.
    StatsBar.tsx      Progress bar with found/total count and % label.
    FilterTabs.tsx    Pill filter tabs: All, Trainers, Pokémon, Missing, Complete + Reset.
    CardSearch.tsx    Full-screen search modal with debounced API autocomplete.
    ImagePopup.tsx    Full-image overlay with X close button and price/Cardmarket link.
    EditQuantityModal.tsx  Bottom sheet to change needed qty or remove a card.
  decks/
    DeckListItem.tsx  Deck row with progress bar. No delete button (delete is in deck detail).
    CreateDeckModal.tsx  Bottom sheet with name input to create a deck.
  ui/
    Modal.tsx         Reusable modal — bottom-sheet or full-screen mode.

context/
  AppContext.tsx      AppProvider (loads/saves state), useAppContext, useDecks, useCardActions.

hooks/
  usePokemonSearch.ts Debounced search hook (350 ms) wrapping the TCG API service.

services/
  pokemonTcg.ts       searchCards(), getCard(), mapToTracked(). Reads optional
                      NEXT_PUBLIC_POKEMON_TCG_API_KEY env var.
  storage.ts          loadState() / saveState() / clearState() over localStorage key
                      "pkmn-tcg-track-v1".

types/
  index.ts            TcgCard, TrackedCard, Deck, AppState, AppAction, CardFilter.
```

---

## Data model

```ts
// What comes from the Pokémon TCG API
TcgCard { id, name, supertype, number, set{id,name,releaseDate,...}, images{small,large},
          cardmarket{url, prices{lowPrice, lowPriceExPlus, avg30, averageSellPrice, ...}} }

// What gets stored in localStorage
TrackedCard { tcgId, name, supertype, number, setId, setName,
              imageSmall, imageLarge,
              cardmarketUrl, cardmarketLowPrice, cardmarketAvg30,
              collected, needed }

AppState { decks: Deck[], standaloneCards: TrackedCard[] }
Deck     { id, name, cards: TrackedCard[], createdAt }
```

`mapToTracked(card)` in `services/pokemonTcg.ts` converts a `TcgCard` → `TrackedCard`.
`cardmarketLowPrice` uses `lowPriceExPlus` (Excellent+ condition) with fallback to `lowPrice`.

---

## State management

All mutations go through `AppAction` dispatched via `useAppContext().dispatch`:

```
CREATE_DECK / DELETE_DECK / RENAME_DECK
ADD_CARD    / REMOVE_CARD                  (deckId: string | null — null = standalone)
SET_COLLECTED / SET_NEEDED / RESET_COLLECTED
```

Convenience hooks exported from `context/AppContext.tsx`:
- `useDecks()` — `{ decks, createDeck, deleteDeck, renameDeck }`
- `useCardActions(deckId)` — `{ addCard, removeCard, setCollected, setNeeded, resetCollected }`

State is loaded from localStorage on mount and saved on every change (both in `AppProvider`).

---

## Design conventions

- **Dark theme:** near-black backgrounds (`#0c0c0c` bg, `#191919` surface, `#222222` elevated)
- **Accent colour:** white (buttons, active nav tab, progress bar fill)
- **Complete cards:** subtle green tint (`bg-green-950/20 border-green-900/40`), count in `text-green-400`
- **Rounded corners:** minimal — `rounded` (2 px) on cards/inputs, none on modals/buttons; `rounded-full` kept only for filter pills, progress bar, back/close icon buttons
- **Layout pattern for card pages:** `flex flex-col h-full overflow-hidden` on the page, `flex-shrink-0` header, then `CardListView` (which is itself a flex column with an internal `overflow-y-auto` list)
- All buttons use `touch-manipulation` to suppress 300 ms tap delay

---

## Environment variables

```
NEXT_PUBLIC_POKEMON_TCG_API_KEY=   # Optional. Higher rate limits at dev.pokemontcg.io
```

---

## Key commands

```bash
npm run dev    # local dev server
npm run build  # production build (run before every push to catch type errors)
git push       # Vercel auto-deploys main on every push
```
