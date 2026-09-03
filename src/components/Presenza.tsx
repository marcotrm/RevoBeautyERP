'use client';

/**
 * Il battito che dice quanto tempo si sta dentro al gestionale.
 *
 * Nessuno fa il logout: si chiude la finestra e basta. Quindi la fine di una
 * sessione non si sa mai, e l'unico modo per misurarla e' il contrario —
 * farsi vivi ogni due minuti finche' la pagina e' aperta e qualcuno la sta
 * usando. Quando i battiti smettono, quello era l'ultimo momento in cui c'era.
 *
 * Non batte se la scheda e' in secondo piano o se nessuno tocca niente da un
 * quarto d'ora: un gestionale lasciato aperto sul bancone non e' lavoro.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { segnalaPresenza } from '@/app/actions/accounts';

const OGNI_MS = 2 * 60 * 1000;
const FERMO_MS = 15 * 60 * 1000;

export default function Presenza() {
  const userId = useAuthStore(s => s.user?.id);
  const ultimoTocco = useRef(0);

  useEffect(() => {
    if (!userId) return;
    ultimoTocco.current = Date.now();

    const sveglia = () => { ultimoTocco.current = Date.now(); };
    const eventi: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'];
    eventi.forEach(e => window.addEventListener(e, sveglia, { passive: true }));
    document.addEventListener('visibilitychange', sveglia);

    const battito = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultimoTocco.current > FERMO_MS) return;
      segnalaPresenza(userId).catch(() => {});
    };
    battito();
    const timer = setInterval(battito, OGNI_MS);

    return () => {
      clearInterval(timer);
      eventi.forEach(e => window.removeEventListener(e, sveglia));
      document.removeEventListener('visibilitychange', sveglia);
    };
  }, [userId]);

  return null;
}
