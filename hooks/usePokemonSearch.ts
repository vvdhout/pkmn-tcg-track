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

    // Cache miss: debounce then fetch. Each new fire aborts the previous
    // in-flight request so a slow earlier response can never overwrite a later one.
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const cards = await searchCards(query, 1, { sortOrder, formatIds }, controller.signal);
        cacheSet(cacheKey, cards);
        setResults(cards);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setError('Search failed. Check your connection and try again.');
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
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
