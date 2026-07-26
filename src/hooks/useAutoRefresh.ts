'use client';

import { useEffect, useRef } from 'react';

/**
 * Tiene i dati sempre freschi senza ricaricare la pagina a mano:
 * - ricarica a intervalli regolari mentre la scheda è visibile
 * - ricarica appena si torna sulla scheda (focus o cambio tab)
 *
 * Quando la scheda è in secondo piano non fa nulla, per non sprecare richieste.
 */
export function useAutoRefresh(refresh: () => void, intervalMs = 30000) {
  const ref = useRef(refresh);
  ref.current = refresh;

  useEffect(() => {
    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        ref.current();
      }
    };

    const timer = setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [intervalMs]);
}
