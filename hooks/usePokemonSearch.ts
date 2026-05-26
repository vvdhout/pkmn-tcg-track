'use client';

import { useState, useEffect, useRef } from 'react';
import type { TcgCard } from '@/types';
import { searchCards } from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

interface SearchOverrides {
  formatIds?: string[];
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

    // Short debounce to batch rapid keystrokes without feeling sluggish.
    // Each fire aborts any still-running request so a slow earlier response
    // can never overwrite results from a more recent query.
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const cards = await searchCards(query, 1, { sortOrder, formatIds }, controller.signal);
        setResults(cards);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setError('Search failed. Check your connection and try again.');
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);

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
