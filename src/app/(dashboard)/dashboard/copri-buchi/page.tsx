'use client';

/**
 * Copri buchi: la pagina da cui si guarda cosa sta succedendo.
 *
 * Non si lancia da qui — si lancia dall'agenda, cliccando sul posto libero,
 * o parte da sola quando una cliente disdice. Qui si vede a che punto è, chi
 * è stata contattata, chi ha risposto e quanto è costato.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone, Loader2, CheckCircle2, XCircle, Clock, Users, Euro, StopCircle, AlertTriangle,
} from 'lucide-react';
import { campagneCopriBuchi, fermaCopriBuchi, quantoCarburante, type CampagnaInPagina } from '@/app/actions/copriBuchi';

const STATI: Record<CampagnaInPagina['stato'], { testo: string; classe: string }> = {
  attiva: { testo: 'in corso', classe: 'bg-warning/15 text-warning border-warning/30' },
  riempita: { testo: 'posto riempito', classe: 'bg-success/15 text-success border-success/30' },
  scaduta: { testo: 'nessuna risposta', classe: 'bg-bg-tertiary text-text-muted border-border' },
  annullata: { testo: 'fermata', classe: 'bg-bg-tertiary text-text-muted border-border' },
};

function quando(date: string, from: string, to: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y} · ${from}–${to}`;
}

export default function CopriBuchiPage() {
  const [campagne, setCampagne] = useState<CampagnaInPagina[] | null>(null);
  const [carburante, setCarburante] = useState<{ attiveConConsenso: number; attive: number; totali: number } | null>(null);
  const [fermando, setFermando] = useState('');

  const carica = useCallback(async () => {
    setCampagne(await campagneCopriBuchi());
  }, []);

  useEffect(() => {
    void carica();
    void quantoCarburante().then(setCarburante);
    // Le campagne aperte si muovono da sole ogni mezz'ora: si ricontrolla spesso.
    const t = setInterval(() => { void carica(); }, 30_000);
    return () => clearInterval(t);
  }, [carica]);

  const ferma = async (id: string) => {
    setFermando(id);
    try { await fermaCopriBuchi(id); await carica(); } finally { setFermando(''); }
  };

  const attive = (campagne || []).filter(c => c.stato === 'attiva');
  const chiuse = (campagne || []).filter(c => c.stato !== 'attiva');
  const riempite = chiuse.filter(c => c.stato === 'riempita');
  const incassoRecuperato = riempite.reduce((s, c) => s + c.prezzo, 0);
  const speso = (campagne || []).reduce((s, c) => s + c.costo, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-success/10 text-success"><Megaphone className="w-5 h-5" /></div>
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Copri buchi</h2>
          <p className="text-sm text-text-secondary">
            Quando una cliente disdice, il posto vuoto viene offerto su WhatsApp alle clienti attive,
            a blocchi di dieci, con mezz&apos;ora fra un blocco e l&apos;altro. Lo prende la prima che risponde.
          </p>
        </div>
      </div>

      {/* Benzina: senza consenso marketing il sistema non ha a chi scrivere */}
      {carburante && (
        <div className={`rounded-2xl border p-4 ${carburante.attiveConConsenso < 30
          ? 'bg-warning/5 border-warning/30' : 'bg-bg-secondary border-border'}`}>
          <div className="flex items-start gap-3">
            {carburante.attiveConConsenso < 30 && <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm text-text-primary">
                Contattabili adesso: <strong>{carburante.attiveConConsenso}</strong> clienti
                — quelle attive ({carburante.attive} su {carburante.totali}) che hanno dato il consenso a ricevere messaggi.
              </p>
              {carburante.attiveConConsenso < 30 && (
                <p className="text-xs text-text-secondary mt-1">
                  Sono poche: a blocchi di dieci finiscono in {Math.max(1, Math.floor(carburante.attiveConConsenso / 10))} giri
                  e poi si riscrive sempre alle stesse. Il consenso si raccoglie dalla scheda al check-in.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Il bilancio: quanto ha recuperato, quanto è costato */}
      {campagne && campagne.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Posti riempiti', v: String(riempite.length), i: <CheckCircle2 className="w-4 h-4 text-success" /> },
            { l: 'Chiamate fatte', v: String(campagne.length), i: <Megaphone className="w-4 h-4 text-text-muted" /> },
            { l: 'Incasso recuperato', v: `${incassoRecuperato.toFixed(0)} €`, i: <Euro className="w-4 h-4 text-success" /> },
            { l: 'Speso in messaggi', v: `${speso.toFixed(2)} €`, i: <Euro className="w-4 h-4 text-text-muted" /> },
          ].map(k => (
            <div key={k.l} className="rounded-2xl border border-border bg-bg-secondary p-4">
              <div className="flex items-center gap-1.5 text-xs text-text-muted">{k.i} {k.l}</div>
              <p className="text-xl font-display font-bold text-text-primary mt-1">{k.v}</p>
            </div>
          ))}
        </div>
      )}

      {campagne === null ? (
        <p className="text-sm text-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> carico…</p>
      ) : campagne.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-secondary">
            Ancora nessuna chiamata. Parte da sola quando una cliente disdice un appuntamento della giornata,
            oppure la lanci tu dall&apos;agenda cliccando su un posto libero.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...attive, ...chiuse].map(c => {
            const stato = STATI[c.stato];
            const risposte = c.contattate.filter(x => x.risposta);
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text-primary">{c.treatmentName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stato.classe}`}>
                        {stato.testo}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {quando(c.date, c.from, c.to)} · {c.operatorName} · {c.prezzo.toFixed(0)} €
                      {c.disdettaDi && <> · liberato da {c.disdettaDi}</>}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.contattate.length} contattate in {c.giro} blocc{c.giro === 1 ? 'o' : 'hi'}</span>
                      <span className="flex items-center gap-1"><Euro className="w-3 h-3" /> {c.costo.toFixed(2)} €</span>
                      {c.stato === 'attiva' && (
                        <span className="flex items-center gap-1 text-warning">
                          <Clock className="w-3 h-3" /> prossimo blocco alle {new Date(c.prossimoGiroIl).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.stato === 'attiva' && (
                    <button onClick={() => ferma(c.id)} disabled={fermando === c.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                      <StopCircle className="w-3.5 h-3.5" /> Ferma
                    </button>
                  )}
                </div>

                {c.vinta && (
                  <div className="px-5 py-2.5 bg-success/10 border-t border-success/20 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    <p className="text-sm text-text-primary">
                      <strong>{c.vinta.nome}</strong> ha preso il posto — appuntamento già in agenda.
                    </p>
                  </div>
                )}

                {risposte.length > 0 && (
                  <div className="px-5 py-2.5 border-t border-border/50 flex flex-wrap gap-2">
                    {risposte.map(r => (
                      <span key={r.clientId}
                        className={`text-[11px] px-2 py-1 rounded-lg flex items-center gap-1 ${
                          r.risposta === 'si' ? 'bg-success/10 text-success' : 'bg-bg-tertiary text-text-muted'}`}>
                        {r.risposta === 'si' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {r.nome}
                      </span>
                    ))}
                  </div>
                )}

                {c.motivoFine && c.stato !== 'riempita' && (
                  <p className="px-5 py-2 border-t border-border/50 text-[11px] text-text-muted">{c.motivoFine}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
