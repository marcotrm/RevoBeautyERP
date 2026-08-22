'use client';

/**
 * Il promemoria della sera: "stasera si caccia la carta".
 *
 * Il calendario in dashboard va bene per chi lo guarda, ma alle sette di sera
 * nessuno guarda la dashboard: si sta chiudendo, si conta la cassa, si spegne
 * tutto. Quindi l'avviso viene a cercare le ragazze, a schermo intero, e non
 * se ne va finché qualcuno non dice cosa è successo.
 *
 * Due risposte, tutte e due vere: "buttata" (e allora resta scritto chi e a
 * che ora, così domani non si discute) oppure "la butto dopo", che è quello
 * che succede davvero quando c'è ancora una cliente in cabina — e allora
 * ritorna fra mezz'ora.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Check, Clock } from 'lucide-react';
import { leggiCalendarioImmondizia, immondiziaDiOggi, segnaImmondiziaButtata } from '@/app/actions/immondizia';
import { cosaTocca, type CalendarioImmondizia, type TocaStasera } from '@/lib/immondizia';
import { useAuthStore } from '@/stores/useAuthStore';

/** Ogni quanto si controlla se è arrivata l'ora. */
const OGNI = 60_000;
/** Quanto dura "la butto dopo". */
const RINVIO_MIN = 30;
const CHIAVE_RINVIO = 'revo_immondizia_rinviata';

function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function oraRoma(): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

export default function PopupImmondizia() {
  const [tocca, setTocca] = useState<TocaStasera | null>(null);
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const utente = useAuthStore(s => s.user);

  const rinviata = () => {
    try {
      const fino = Number(localStorage.getItem(CHIAVE_RINVIO) || 0);
      return fino > Date.now();
    } catch { return false; }
  };

  const controlla = useCallback(async () => {
    try {
      const cal: CalendarioImmondizia = await leggiCalendarioImmondizia();
      const scritto = Object.values(cal.giorni).some(v => (v || []).length > 0);
      if (!scritto) return;

      const adesso = oraRoma();
      if (adesso < (cal.oraAvviso || '19:00')) return;

      const cosa = cosaTocca(cal);
      if (!cosa) return;

      // Già portata fuori da qualcuno, magari sull'altro computer.
      const fatta = await immondiziaDiOggi(oggiRoma());
      if (fatta) return;
      if (rinviata()) return;

      setTocca(cosa);
      setAperto(true);
    } catch {
      // Se il server non risponde non si insiste: meglio nessun avviso che un
      // avviso sbagliato mentre si sta chiudendo.
    }
  }, []);

  useEffect(() => {
    // Il primo controllo si fa subito ma fuori dal disegno: qui dentro si
    // avvia solo il battito, come si fa con qualunque cosa che sta fuori.
    const subito = setTimeout(controlla, 0);
    const t = setInterval(controlla, OGNI);
    return () => { clearTimeout(subito); clearInterval(t); };
  }, [controlla]);

  const buttata = async () => {
    setSalvando(true);
    const chi = utente ? `${utente.firstName} ${utente.lastName || ''}`.trim() : '';
    await segnaImmondiziaButtata(oggiRoma(), chi).catch(() => {});
    setSalvando(false);
    setAperto(false);
  };

  const dopo = () => {
    try { localStorage.setItem(CHIAVE_RINVIO, String(Date.now() + RINVIO_MIN * 60_000)); } catch { /* no-op */ }
    setAperto(false);
  };

  return (
    <AnimatePresence>
      {aperto && tocca && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed inset-0 z-[91] flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-display font-bold text-text-primary">
                  {tocca.stasera ? "Stasera si caccia l'immondizia" : "Oggi si caccia l'immondizia"}
                </h3>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {tocca.tipi.map(t => (
                    <span key={t.id} className="px-3 py-1.5 rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: t.colore }}>
                      {t.nome}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-3">
                  Raccolta di {tocca.nomeGiorno.toLowerCase()}. Portalo fuori prima di chiudere.
                </p>
              </div>
              <div className="px-4 pb-4 flex flex-col gap-2">
                <button onClick={buttata} disabled={salvando}
                  className="w-full py-3 rounded-xl gradient-accent text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  <Check className="w-4 h-4" /> {salvando ? 'Un attimo…' : 'Immondizia buttata'}
                </button>
                <button onClick={dopo}
                  className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> La butto dopo
                </button>
                <p className="text-[10px] text-text-muted text-center">
                  &laquo;La butto dopo&raquo; lo fa tornare fra mezz&apos;ora.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
