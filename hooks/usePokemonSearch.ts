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

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
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
  const abortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);

  const formatIds = overrides?.formatIds;
  const formatKey = formatIds?.join(',') ?? '';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (!query.trim()) {
      searchGenRef.current += 1;
      setResults([]);
      setError(null);
      setLoading(false);
      setHasMore(false);
      sessionRef.current = null;
      return;
    }

    debounceRef.current = setTimeout(() => {
      const generation = ++searchGenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setHasMore(false);
      sessionRef.current = null;

      searchCardsBegin(query, { sortOrder, formatIds }, controller.signal)
        .then((result) => {
          if (generation !== searchGenRef.current) return;
          sessionRef.current = result.session;
          setResults(result.cards);
          setHasMore(result.hasMore);
        })
        .catch((err) => {
          if (generation !== searchGenRef.current) return;
          if (isAbortError(err)) return;
          setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
          setResults([]);
        })
        .finally(() => {
          if (generation !== searchGenRef.current) return;
          setLoading(false);
        });
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
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
      if (isAbortError(err)) return;
      setError(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading]);

  function clear() {
    searchGenRef.current += 1;
    abortRef.current?.abort();
    setQuery('');
    setResults([]);
    setError(null);
    setHasMore(false);
    setLoading(false);
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
