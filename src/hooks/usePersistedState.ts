'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Like useState but persists to localStorage.
 * On first render loads from localStorage; on every change writes back.
 * SSR-safe: returns defaultValue during server render.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage full or unavailable
    }
  }, [key, state]);

  return [state, setState];
}
