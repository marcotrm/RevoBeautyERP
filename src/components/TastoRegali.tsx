'use client';

/**
 * I regali chiesti dall'app, in alto accanto alla chat.
 *
 * Quando una cliente tocca «50 punti» sul suo telefono succede gia' tutto:
 * i punti le scendono subito, nasce un codice di sei lettere e il regalo
 * resta li' in attesa che qualcuno glielo metta in mano. Il punto e' che
 * finora quel «qualcuno» doveva andarselo a cercare in una pagina — e una
 * richiesta che nessuno guarda e' una cliente che arriva al banco convinta
 * di avere un regalo che nessuno le ha preparato.
 *
 * Quindi sta qui, dove si guarda cento volte al giorno, col numero di quelle
 * ancora da consegnare. Due tasti soli: consegnato — e lo scaffale scala —
 * oppure annullato, e i punti tornano a lei.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Check, Undo2, Loader2, Sparkles } from 'lucide-react';

interface Riscatto {
  id: string;
  clientId: string;
  clientName: string;
  tipo?: string;
  nomeProdotto: string;
  punti: number;
  codice: string;
  stato: string;
  createdAt: string;
  consegnatoAt?: string | null;
  avatar?: string | null;
}

/** «12 min fa», «2 ore fa», «3 giorni fa». */
function quandoFa(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return ore === 1 ? "un'ora fa" : `${ore} ore fa`;
  const gg = Math.floor(ore / 24);
  return gg === 1 ? 'ieri' : `${gg} giorni fa`;
}

export default function TastoRegali() {
  const [aperto, setAperto] = useState(false);
  const [daRitirare, setDaRitirare] = useState<Riscatto[]>([]);
  const [storico, setStorico] = useState<Riscatto[]>([]);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [montato, setMontato] = useState(false);

  useEffect(() => { setMontato(true); }, []);

  const carica = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/premi-riscatti');
      const d = await r.json();
      setDaRitirare(d.daRitirare || []);
      setStorico(d.storico || []);
    } catch { /* offline: tieni quello che c'e' */ }
  }, []);

  // Ogni venti secondi: un regalo non e' urgente come un messaggio, ma
  // dev'essere pronto prima che lei arrivi al banco.
  useEffect(() => {
    carica();
    const t = setInterval(carica, 20_000);
    return () => clearInterval(t);
  }, [carica]);

  const agisci = async (id: string, azione: 'consegna' | 'annulla') => {
    if (azione === 'annulla' && !confirm('Annullare il regalo? I punti tornano alla cliente.')) return;
    setOccupato(id);
    try {
      await fetch('/api/admin/premi-riscatti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, azione }),
      });
      await carica();
    } finally { setOccupato(null); }
  };

  const quanti = daRitirare.length;

  return (
    <>
      <button onClick={() => setAperto(true)} title="Regali richiesti dall'app" aria-label="Regali richiesti dall'app"
        className={`relative p-2 rounded-xl transition-colors flex-shrink-0 ${
          quanti > 0 ? 'text-warning hover:bg-warning/10 regalo-blink' : 'text-text-secondary hover:bg-bg-hover'}`}>
        <Gift className="w-5 h-5" />
        {quanti > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold px-1">
            {quanti}
          </span>
        )}
      </button>

      {montato && createPortal(
        <AnimatePresence>
          {aperto && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setAperto(false)} />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-secondary border-l border-border z-[61] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-base font-display font-semibold text-text-primary">Regali richiesti</h3>
                    <p className="text-xs text-text-muted">
                      {quanti === 0 ? 'Niente da preparare' : quanti === 1 ? '1 da consegnare al banco' : `${quanti} da consegnare al banco`}
                    </p>
                  </div>
                  <button onClick={() => setAperto(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {quanti === 0 && storico.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                      <Gift className="w-10 h-10 text-text-muted mb-3" />
                      <p className="text-sm text-text-secondary font-medium">Nessuna richiesta</p>
                      <p className="text-xs text-text-muted mt-1">
                        Quando una cliente riscatta un regalo coi punti dall&apos;app, compare qui col suo codice.
                      </p>
                    </div>
                  )}

                  {daRitirare.map(r => (
                    <div key={r.id} className="rounded-2xl border border-warning/30 bg-warning/5 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{r.clientName}</p>
                          <p className="text-sm text-text-secondary">{r.nomeProdotto}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {r.tipo === 'trattamento' ? 'Trattamento' : 'Prodotto'} · {r.punti} punti · {quandoFa(r.createdAt)}
                          </p>
                        </div>
                        {/*
                          Il codice grande: e' quello che lei mostra sul
                          telefono, e va confrontato a occhio in due secondi
                          mentre le si parla.
                        */}
                        <span className="px-2.5 py-1.5 rounded-lg bg-bg-secondary border border-border font-mono text-sm font-bold tracking-widest text-text-primary flex-shrink-0">
                          {r.codice}
                        </span>
                      </div>
                      {r.tipo === 'trattamento' && (
                        <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                          <Sparkles className="w-3 h-3 flex-shrink-0" />
                          Da segnare in agenda: il trattamento e&apos; gia&apos; pagato coi punti.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => agisci(r.id, 'annulla')} disabled={occupato === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-40">
                          <Undo2 className="w-3.5 h-3.5" /> Annulla
                        </button>
                        <button onClick={() => agisci(r.id, 'consegna')} disabled={occupato === r.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg gradient-accent text-white text-xs font-bold disabled:opacity-40">
                          {occupato === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Consegnato
                        </button>
                      </div>
                    </div>
                  ))}

                  {storico.length > 0 && (
                    <>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted pt-3 pb-1">Ultimi consegnati</p>
                      {storico.map(r => (
                        <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-bg-tertiary/40">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text-primary truncate">{r.clientName}</p>
                            <p className="text-[11px] text-text-muted truncate">{r.nomeProdotto} · {r.punti} punti</p>
                          </div>
                          <span className={`text-[10px] font-medium flex-shrink-0 ${r.stato === 'annullato' ? 'text-text-muted' : 'text-success'}`}>
                            {r.stato === 'annullato' ? 'annullato' : 'consegnato'}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
