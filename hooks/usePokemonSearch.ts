'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TcgCard } from '@/types';
import {
  searchCardsBegin,
  searchCardsLoadMore,
  type SearchSession,
} from '@/services/pokemonTcg';
import { useAppContext } from '@/context/AppContext';

interface SearchOverrides {
  formatIds?: string[];
  initialQuery?: string;
}

export function usePokemonSearch(overrides?: SearchOverrides) {
  const { state } = useAppContext();
  const sortOrder = state.settings.searchSortOrder;
  const [query, setQuery] = useState(overrides?.initialQuery ?? '');
  const [results, setResults] = useState<TcgCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<SearchSession | null>(null);

  const formatIds = overrides?.formatIds;
  const formatKey = formatIds?.join(',') ?? '';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      setHasMore(false);
      sessionRef.current = null;
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setHasMore(false);
      sessionRef.current = null;
      try {
        const result = await searchCardsBegin(query, { sortOrder, formatIds });
        sessionRef.current = result.session;
        setResults(result.cards);
        setHasMore(result.hasMore);
      } catch (err) {
        setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortOrder, formatKey]);

  const loadMore = useCallback(async () => {
    if (!sessionRef.current || !hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const result = await searchCardsLoadMore(sessionRef.current);
      sessionRef.current = result.session;
      setResults((prev) => [...prev, ...result.cards]);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading]);

  function clear() {
    setQuery('');
    setResults([]);
    setError(null);
    setHasMore(false);
    sessionRef.current = null;
  }

  return {
    query,
    setQuery,
    results,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    clear,
  };
}
