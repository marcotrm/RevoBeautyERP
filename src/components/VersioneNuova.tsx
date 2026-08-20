'use client';

/**
 * "Premo Crea Appuntamento e non succede niente."
 *
 * Succedeva davvero, ed era la cosa peggiore: quando esce una versione nuova
 * del gestionale, le pagine rimaste aperte continuano a parlare con la build
 * vecchia. Il server non riconosce più quelle chiamate ("Failed to find Server
 * Action") e risponde con un errore che sullo schermo non compare: il tasto si
 * preme, non si rompe niente a vista, e semplicemente non succede nulla.
 * Chi è al banco non ha modo di capirlo, e ricaricare la pagina non gli viene
 * in mente perché non è successo niente di strano.
 *
 * Qui si chiude il buco da due lati:
 *
 *  - si controlla ogni minuto se il server ha una versione diversa da quella
 *    con cui la pagina è partita, e in quel caso si avvisa con un tasto per
 *    ricaricare — senza ricaricare a tradimento mentre si sta scrivendo;
 *  - se una chiamata fallisce proprio per quel motivo, a quel punto la pagina è
 *    già inservibile e si ricarica da sola, una volta sola.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/** Ogni quanto si chiede al server se è cambiato qualcosa. */
const OGNI = 60_000;
/** Segno che il ricaricamento automatico è già stato fatto: mai due di fila. */
const CHIAVE_RICARICA = 'revo_ricaricato_per_versione';

async function leggiVersione(): Promise<string | null> {
  try {
    const r = await fetch('/api/versione', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d?.versione === 'string' ? d.versione : null;
  } catch {
    // Rete assente o server che riparte: non è il momento di dire niente.
    return null;
  }
}

export default function VersioneNuova() {
  const [nuova, setNuova] = useState(false);
  const iniziale = useRef<string | null>(null);

  const ricarica = useCallback(() => {
    try { sessionStorage.setItem(CHIAVE_RICARICA, '1'); } catch { /* no-op */ }
    window.location.reload();
  }, []);

  useEffect(() => {
    let vivo = true;

    const controlla = async () => {
      const v = await leggiVersione();
      if (!vivo || !v) return;
      if (iniziale.current === null) { iniziale.current = v; return; }
      if (v !== iniziale.current) setNuova(true);
    };

    void controlla();
    const t = setInterval(controlla, OGNI);

    /*
      La rete di sicurezza. Se una chiamata al server fallisce perché la pagina
      è di una build vecchia, aspettare il controllo del minuto dopo vuol dire
      lasciare qualcuno a premere un tasto morto: si ricarica subito, una volta
      sola per sessione.
    */
    const suErrore = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason as Error)?.message || e.reason || '');
      if (!/Failed to find Server Action|deployment/i.test(msg)) return;
      let giaFatto = false;
      try { giaFatto = sessionStorage.getItem(CHIAVE_RICARICA) === '1'; } catch { /* no-op */ }
      if (giaFatto) { setNuova(true); return; }
      ricarica();
    };
    window.addEventListener('unhandledrejection', suErrore);

    // Dopo un ricaricamento andato a buon fine il segno si toglie, se no il
    // secondo aggiornamento della giornata non ricaricherebbe più niente.
    const pulisci = setTimeout(() => {
      try { sessionStorage.removeItem(CHIAVE_RICARICA); } catch { /* no-op */ }
    }, 10_000);

    return () => {
      vivo = false;
      clearInterval(t);
      clearTimeout(pulisci);
      window.removeEventListener('unhandledrejection', suErrore);
    };
  }, [ricarica]);

  if (!nuova) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3
      rounded-2xl bg-bg-secondary border border-accent/40 shadow-2xl max-w-[92vw]">
      <RefreshCw className="w-4 h-4 text-accent flex-shrink-0" />
      <p className="text-sm text-text-primary">
        <strong>C&apos;è una versione nuova del gestionale.</strong>{' '}
        <span className="text-text-secondary">Ricarica, se no i tasti non salvano più niente.</span>
      </p>
      <button onClick={ricarica}
        className="px-3 py-1.5 rounded-xl gradient-accent text-white text-xs font-bold hover:opacity-90 flex-shrink-0">
        Ricarica
      </button>
    </div>
  );
}
