'use client';

import { useState, useEffect, useRef } from 'react';
import type { TcgCard } from '@/types';
import { searchCards } from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

interface SearchOverrides {
  setDateFrom?: string;
  setDateTo?: string;
}

export function usePokemonSearch(overrides?: SearchOverrides) {
  const { state } = useAppContext();
  const { settings } = state;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortOrder = settings.searchSortOrder;
  // If overrides object is provided (even with undefined values), use it; otherwise fall back to global settings.
  // This lets an "Unlimited" format override (overrides={}) clear the global date filter.
  const setDateFrom = overrides !== undefined ? overrides.setDateFrom : settings.setRangeFrom?.releaseDate;
  const setDateTo   = overrides !== undefined ? overrides.setDateTo   : settings.setRangeTo?.releaseDate;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const cards = await searchCards(query, 1, { sortOrder, setDateFrom, setDateTo });
        setResults(cards);
      } catch {
        setError('Search failed. Check your connection and try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sortOrder, setDateFrom, setDateTo]);

  function clear() {
    setQuery('');
    setResults([]);
    setError(null);
  }

  return { query, setQuery, results, loading, error, clear };
}
