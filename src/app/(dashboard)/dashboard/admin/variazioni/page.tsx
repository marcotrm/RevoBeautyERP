'use client';

/**
 * Le variazioni dell'agenda, giorno per giorno.
 *
 * Serve a rispondere a una domanda precisa: «stamattina c'erano piu'
 * appuntamenti di adesso, dove sono finiti?». Si sceglie il giorno e si vede
 * cosa e' stato tolto, spostato o cambiato, con nome, ora, prezzo e chi.
 *
 * Due avvertenze che stanno anche a schermo, e non per formalita':
 *
 * - un annullamento NON e' un ammanco. Le disdette esistono, e la maggior
 *   parte di queste righe raccontera' giornate normali. Questo elenco serve a
 *   guardare i fatti invece di sospettare.
 * - «spostato» vuol dire che subito dopo l'annullamento e' nato un altro
 *   appuntamento per la stessa persona: quella seduta non e' persa, e non va
 *   contata come tale.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarX2, Trash2, ArrowRightLeft, Pencil, Plus, ShieldAlert, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { variazioniDelGiorno, type GiornataVariazioni } from '@/app/actions/diario';

const oggiIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });

const FACCIA: Record<string, { testo: string; icona: React.ElementType; classe: string }> = {
  annullato: { testo: 'Annullato', icona: CalendarX2, classe: 'text-error bg-error/10 border-error/25' },
  eliminato: { testo: 'Eliminato', icona: Trash2, classe: 'text-error bg-error/15 border-error/40' },
  modificato: { testo: 'Modificato', icona: Pencil, classe: 'text-warning bg-warning/10 border-warning/25' },
  creato: { testo: 'Creato', icona: Plus, classe: 'text-success bg-success/10 border-success/25' },
  riattivato: { testo: 'Riattivato', icona: RefreshCw, classe: 'text-accent bg-accent/10 border-accent/25' },
};

export default function VariazioniAgenda() {
  const [giorno, setGiorno] = useState(oggiIso);
  const [dati, setDati] = useState<GiornataVariazioni | null>(null);
  const [carico, setCarico] = useState(false);

  const carica = useCallback(async (g: string) => {
    setCarico(true);
    try { setDati(await variazioniDelGiorno(g)); }
    finally { setCarico(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void carica(giorno); }, 0);
    return () => clearTimeout(t);
  }, [giorno, carica]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Variazioni dell&apos;agenda</h1>
        <p className="text-sm text-text-secondary mt-1">
          Cosa è stato tolto, spostato o cambiato, e chi l&apos;ha fatto.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={giorno} onChange={e => setGiorno(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        {[['Oggi', 0], ['Ieri', -1], ['L\'altro ieri', -2]].map(([testo, delta]) => (
          <button key={String(testo)} onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() + Number(delta));
            setGiorno(d.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }));
          }}
            className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
            {testo}
          </button>
        ))}
        <button onClick={() => void carica(giorno)} disabled={carico}
          className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-40">
          Aggiorna
        </button>
      </div>

      {dati && !dati.ok && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-warning/30 bg-warning/10">
          <ShieldAlert className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">{dati.errore}</p>
        </div>
      )}

      {dati?.ok && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { testo: 'Spariti davvero', valore: String(dati.quantiPersi), sotto: 'annullati o eliminati, spostamenti esclusi' },
              { testo: 'Valore', valore: formatCurrency(dati.persiEuro), sotto: 'quanto valevano quelle sedute' },
              { testo: 'Eliminati', valore: String(dati.quantiEliminati), sotto: 'tolti dall\'archivio, non solo annullati' },
              { testo: 'Spostati', valore: String(dati.quantiSpostati), sotto: 'rifatti subito: non sono perdite' },
            ].map(c => (
              <div key={c.testo} className="rounded-2xl border border-border bg-bg-secondary p-4">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">{c.testo}</p>
                <p className="text-2xl font-display font-bold text-text-primary mt-0.5">{c.valore}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{c.sotto}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            Un annullamento non è un ammanco: le disdette esistono, e quasi tutte queste righe raccontano
            giornate normali. Questo elenco serve a guardare i fatti. «Spostato» vuol dire che subito dopo
            è nato un altro appuntamento per la stessa persona: quella seduta non è persa.
          </p>

          {dati.variazioni.length === 0 ? (
            <div className="text-center py-14 rounded-2xl border border-border bg-bg-secondary">
              <CalendarX2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-text-secondary">Nessuna variazione su questo giorno</p>
              <p className="text-xs text-text-muted mt-1">
                Il diario parte dal 5 settembre 2026: prima di allora non c&apos;era niente da leggere.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dati.variazioni.map(v => {
                const f = FACCIA[v.azione] || FACCIA.modificato;
                const Icona = f.icona;
                return (
                  <div key={v.id} className={`rounded-2xl border p-4 ${
                    v.spostato ? 'border-border bg-bg-secondary' : f.classe.replace(/text-\S+/, '')} bg-bg-secondary`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${f.classe}`}>
                        <Icona className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">{v.clientName}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${f.classe}`}>
                            {f.testo}
                          </span>
                          {v.spostato && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent">
                              <ArrowRightLeft className="w-3 h-3" /> spostato, non perso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {v.ora} · {v.trattamento || 'senza trattamento'} · {formatCurrency(v.prezzo)}
                        </p>
                        {v.cambiamenti.length > 0 && (
                          <p className="text-[11px] text-text-muted mt-1">{v.cambiamenti.join(' · ')}</p>
                        )}
                        {v.motivo && <p className="text-[11px] text-text-muted mt-0.5">Motivo: {v.motivo}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-text-primary">{v.chi}</p>
                        <p className="text-[11px] text-text-muted">
                          {new Date(v.quando).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
