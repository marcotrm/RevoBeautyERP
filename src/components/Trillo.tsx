'use client';

/**
 * L'orecchio del trillo: sta acceso su ogni schermo del gestionale.
 *
 * Ogni pochi secondi guarda se e' arrivato un trillo. Se c'e' — e non l'ha
 * mandato questo schermo — suona e mostra una striscia in alto per qualche
 * secondo. La cliente in cabina sente un suono del gestionale come tutti gli
 * altri; l'operatrice, che quel suono lo conosce, capisce.
 *
 * Il suono e' fatto qui con l'oscillatore del browser, come i bip di fine
 * trattamento: nessun file da caricare, nessun permesso, funziona anche col
 * telefono in tasca purche' lo schermo sia acceso.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { leggiTrillo, type Trillo as DatiTrillo } from '@/app/actions/trillo';

/** L'identita' di QUESTO schermo: cambia a ogni ricarica, e va benissimo. */
export function idSchermo(): string {
  try {
    const c = sessionStorage.getItem('revo_schermo');
    if (c) return c;
    const nuovo = `s-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('revo_schermo', nuovo);
    return nuovo;
  } catch {
    return 's-anonimo';
  }
}

/**
 * Il trillo di MSN, rifatto con due oscillatori.
 *
 * Due note vicine che scendono in fretta, ripetute due volte: e' quello che
 * fa sembrare un "trillo" e non un allarme. Basso di volume di proposito —
 * deve sentirlo chi lavora, non riempire la stanza.
 */
function suonaTrillo(colpi = 1) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const inizio = ctx.currentTime;
    // Al terzo trillo di fila si alza un po': non e' piu' un promemoria.
    const volume = colpi >= 3 ? 0.34 : colpi === 2 ? 0.26 : 0.2;

    [0, 0.14, 0.42, 0.56].forEach((quando, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      // Sale e scende: si-la, si-la. Un intervallo corto suona come un
      // richiamo; uno lungo suona come un errore.
      osc.frequency.setValueAtTime(i % 2 === 0 ? 988 : 784, inizio + quando);
      gain.gain.setValueAtTime(0.0001, inizio + quando);
      gain.gain.exponentialRampToValueAtTime(volume, inizio + quando + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, inizio + quando + 0.13);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(inizio + quando);
      osc.stop(inizio + quando + 0.15);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* audio non disponibile: resta la striscia a schermo */ }
}

export default function Trillo() {
  const [arrivato, setArrivato] = useState<DatiTrillo | null>(null);
  const ultimoVisto = useRef(0);
  const primoGiro = useRef(true);

  useEffect(() => {
    let vivo = true;
    const io = idSchermo();

    const guarda = async () => {
      try {
        const t = await leggiTrillo();
        if (!vivo || !t) return;
        /*
          Al primo giro non si suona.

          Chi apre il gestionale mentre c'e' un trillo di trenta secondi fa non
          deve sentirselo arrivare in faccia: quel trillo era per chi c'era.
        */
        if (primoGiro.current) { ultimoVisto.current = t.quando; return; }
        if (t.quando <= ultimoVisto.current) return;
        ultimoVisto.current = t.quando;
        if (t.da === io) return; // l'ha mandato questo schermo: qui non suona
        suonaTrillo(t.colpi);
        setArrivato(t);
        setTimeout(() => { if (vivo) setArrivato(null); }, 9000);
      } finally {
        primoGiro.current = false;
      }
    };

    guarda();
    const timer = setInterval(guarda, 4000);
    return () => { vivo = false; clearInterval(timer); };
  }, []);

  if (!arrivato) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-warning/95 text-white shadow-2xl animate-pulse">
        <AlarmClock className="w-5 h-5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-bold">
            {arrivato.operatrice ? `${arrivato.operatrice}, stai andando lunga` : 'Stiamo andando lunghi'}
            {arrivato.colpi > 1 ? ` (${arrivato.colpi}° avviso)` : ''}
          </p>
          <p className="text-[11px] opacity-90">
            {arrivato.minutiRitardo ? `${arrivato.minutiRitardo} minuti oltre l’orario` : 'La seduta ha superato l’orario'}
            {arrivato.prossima ? ` · dopo c’è ${arrivato.prossima}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
