'use client';

import { useState, useEffect, useRef } from 'react';
import type { TcgCard } from '@/types';
import { searchCards } from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

export function usePokemonSearch() {
  const { state } = useAppContext();
  const { settings } = state;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull individual settings values so the effect only re-runs when they actually change
  const sortOrder = settings.searchSortOrder;
  const setDateFrom = settings.setRangeFrom?.releaseDate;
  const setDateTo = settings.setRangeTo?.releaseDate;

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
