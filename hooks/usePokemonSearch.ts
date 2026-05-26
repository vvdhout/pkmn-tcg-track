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

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let timedOut = false;
      const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);

      try {
        const cards = await searchCards(query, 1, { sortOrder, formatIds }, controller.signal);
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
        // Only clear the spinner if this is still the active request.
        // A superseded request was aborted by the next debounce callback —
        // clearing loading here would hide the spinner for the real request.
        if (abortRef.current === controller) setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Do NOT abort here — the next debounce callback aborts the stale
      // request at its start. Aborting in cleanup kills in-flight fetches
      // on every keystroke, causing "No cards found" flashes.
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
