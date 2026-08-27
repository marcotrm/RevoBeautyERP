'use client';

/**
 * Quello che la segretaria ha sbagliato, e cosa propone di imparare.
 *
 * Le proposte stanno qui e non si applicano da sole, apposta. Un testo che si
 * riscrive ogni notte senza che nessuno lo rilegga, dopo un mese non è più
 * quello che qualcuno ha approvato — e dentro le chat analizzate ci sono
 * messaggi scritti da estranei, che potrebbero chiedere proprio quello.
 * Accettare è un click, ed è il click che tiene insieme le due cose.
 */

import React, { useEffect, useState, useTransition } from 'react';
import { Loader2, RefreshCw, Check, X, ChevronDown } from 'lucide-react';
import {
  caricaAutocritiche, rileggiOggi, accettaPropostaAssistente, scartaPropostaAssistente,
} from '@/app/actions/assistente';
import type { Autocritica, Gravita } from '@/lib/autocritica';

const COLORE: Record<Gravita, string> = {
  grave: 'text-error',
  media: 'text-warning',
  lieve: 'text-text-muted',
};

const FACCIA: Record<number, string> = { 1: '🔴', 2: '🟠', 3: '🟡', 4: '🟢', 5: '🟢' };

export default function Autocritica() {
  const [giorni, setGiorni] = useState<Autocritica[] | null>(null);
  const [aperto, setAperto] = useState<string | null>(null);
  const [inCorso, start] = useTransition();
  const [nota, setNota] = useState<string | null>(null);

  const ricarica = async () => setGiorni(await caricaAutocritiche(10));

  useEffect(() => {
    void (async () => { setGiorni(await caricaAutocritiche(10)); })();
  }, []);

  const rileggi = (quante: number) => start(async () => {
    setNota(null);
    const r = await rileggiOggi(quante);
    if (!r.ok) setNota(r.motivo || 'Niente da rileggere');
    await ricarica();
  });

  const decidi = (id: string, accetta: boolean) => start(async () => {
    const r = accetta ? await accettaPropostaAssistente(id) : await scartaPropostaAssistente(id);
    if (!r.ok) setNota(r.errore || 'Non riuscito');
    await ricarica();
  });

  if (!giorni) {
    return <p className="text-xs text-text-muted flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Carico…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted leading-relaxed max-w-2xl">
          Ogni sera alle 21:30 rilegge le conversazioni con davanti le sue regole, <b>intere</b> — non solo
          i messaggi di oggi — e scrive cosa non ha funzionato. Se propone di aggiungere qualcosa alle note,
          <b> non lo fa da sola</b>: resta qui finché non lo accetti tu.
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Due tagli: le ultime cinque per guardare in fretta dopo una chat
              storta, tutte quando si vuole il quadro. */}
          <button onClick={() => rileggi(5)} disabled={inCorso}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-50">
            {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Rileggi le ultime 5
          </button>
          <button onClick={() => rileggi(25)} disabled={inCorso}
            className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-50">
            Tutte
          </button>
        </div>
      </div>

      {nota && <p className="text-[11px] text-warning">{nota}</p>}

      {giorni.length === 0 && (
        <p className="text-xs text-text-muted">
          Ancora nessuna analisi. Ne fa una a sera, se durante il giorno la segretaria ha risposto a qualcuno.
        </p>
      )}

      {giorni.map(a => {
        const gravi = a.problemi.filter(p => p.gravita === 'grave').length;
        const inAttesa = (a.proposte || []).filter(p => p.stato === 'in_attesa');
        const apertoQui = aperto === a.giorno;

        return (
          <div key={a.giorno} className="rounded-xl bg-bg-secondary border border-border/50 overflow-hidden">
            <button onClick={() => setAperto(apertoQui ? null : a.giorno)}
              className="w-full flex items-center gap-3 p-3 text-left">
              <span className="text-lg">{FACCIA[a.voto] || '🟡'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary">
                  {a.giorno} · <span className="text-text-muted">{a.chatLette} chat, {a.risposteLette} risposte</span>
                </p>
                <p className="text-[11px] text-text-muted truncate">{a.riepilogo}</p>
              </div>
              {gravi > 0 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-error/15 text-error flex-shrink-0">
                  {gravi} {gravi === 1 ? 'GRAVE' : 'GRAVI'}
                </span>
              )}
              {inAttesa.length > 0 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning flex-shrink-0">
                  {inAttesa.length} DA DECIDERE
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${apertoQui ? 'rotate-180' : ''}`} />
            </button>

            {apertoQui && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                <p className="text-xs text-text-secondary leading-relaxed">{a.riepilogo}</p>

                {a.problemi.length > 0 && (
                  <div className="space-y-1.5">
                    {a.problemi.map((p, i) => (
                      <div key={i} className="text-[11px] leading-relaxed">
                        <span className={`font-semibold uppercase ${COLORE[p.gravita]}`}>{p.gravita}</span>
                        {' · '}
                        <span className="text-text-primary">{p.cosa}</span>
                        <span className="text-text-muted"> — {p.chat}</span>
                        {p.esempio && (
                          <p className="text-text-muted/70 italic pl-3 border-l border-border ml-1 mt-0.5">«{p.esempio}»</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(a.proposte || []).map(p => (
                  <div key={p.id} className="p-2.5 rounded-lg bg-bg-tertiary border border-border/60">
                    <p className="text-xs text-text-primary">«{p.testo}»</p>
                    <p className="text-[11px] text-text-muted mt-1">{p.perche}</p>
                    {p.stato === 'in_attesa' ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => decidi(p.id, true)} disabled={inCorso}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/15 text-success text-[11px] font-medium disabled:opacity-50">
                          <Check className="w-3 h-3" /> Aggiungi alle note
                        </button>
                        <button onClick={() => decidi(p.id, false)} disabled={inCorso}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-hover text-text-muted text-[11px] disabled:opacity-50">
                          <X className="w-3 h-3" /> No
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[11px] mt-1.5 ${p.stato === 'accettata' ? 'text-success' : 'text-text-muted'}`}>
                        {p.stato === 'accettata' ? 'Aggiunta alle note.' : 'Scartata.'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
