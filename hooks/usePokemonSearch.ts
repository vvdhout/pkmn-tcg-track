'use client';

import { useState, useEffect, useRef } from 'react';
import type { TcgCard } from '@/types';
import { searchCards } from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

interface SearchOverrides {
  formatIds?: string[];
}

// Module-level cache — survives navigation within the same browser session,
// cleared on page refresh. Key = "query|sortOrder|formatKey" (exact match only).
const searchCache = new Map<string, TcgCard[]>();
const MAX_CACHE = 50;

function cacheGet(key: string) { return searchCache.has(key) ? searchCache.get(key)! : null; }
function cacheSet(key: string, cards: TcgCard[]) {
  searchCache.set(key, cards);
  if (searchCache.size > MAX_CACHE) searchCache.delete(searchCache.keys().next().value!);
}

export function usePokemonSearch(overrides?: SearchOverrides) {
  const { state } = useAppContext();
  const sortOrder = state.settings.searchSortOrder;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  // Stable reference for formatIds to avoid unnecessary effect re-runs
  const formatIds = overrides?.formatIds;
  const formatKey = formatIds?.join(',') ?? '';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      abortRef.current?.abort();
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cacheKey = `${query.trim()}|${sortOrder}|${formatKey}`;
    const cached = cacheGet(cacheKey);
    if (cached !== null) {
      // Instant results — no debounce, no network call
      abortRef.current?.abort();
      setResults(cached);
      setError(null);
      setLoading(false);
      return;
    }

    // Cache miss: show spinner immediately (eliminates "No cards found" flash
    // during the debounce window), then fire the fetch after 350 ms of quiet.
    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Kill the request after 12 s so a hung API call never leaves an
      // infinite spinner. timedOut distinguishes this from user-triggered aborts.
      let timedOut = false;
      const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);

      try {
        const cards = await searchCards(query, 1, { sortOrder, formatIds }, controller.signal);
        cacheSet(cacheKey, cards);
        setResults(cards);
      } catch (e) {
        const isAbort = (e as Error)?.name === 'AbortError' || (e as DOMException)?.code === 20;
        if (isAbort) {
          if (timedOut) setError('Search timed out. Please try again.');
          return;
        }
        const status = (e as Error)?.message?.match(/\d{3}/)?.[0];
        setError(status ? `Search failed (${status}). Check your connection and try again.` : 'Search failed. Check your connection and try again.');
        setResults([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false); // always clear spinner, even on abort
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortOrder, formatKey]);

  function clear() {
    setQuery('');
    setResults([]);
    setError(null);
  }

  return { query, setQuery, results, loading, error, clear };
}
