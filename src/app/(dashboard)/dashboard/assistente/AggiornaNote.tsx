'use client';

/**
 * «Scrivi quello che vuoi che sappia, al resto penso io.»
 *
 * Il riquadro delle note è un campo libero, e chi gestisce il centro sa
 * benissimo cosa deve sapere l'assistente — ma scriverlo in modo che lo
 * applichi bene è un mestiere diverso. Le frasi vaghe diventano comportamenti
 * vaghi, le regole scritte due volte si contraddicono, e la nota cresce finché
 * nessuno la rilegge più.
 *
 * Qui si scrive a braccio. Il modello rimette in ordine e restituisce una
 * proposta, che si vede PRIMA di applicarla: quello che cambia è scritto
 * riga per riga, e finché non si preme «Usa queste note» la nota vera resta
 * quella di adesso.
 */

import React, { useState, useTransition } from 'react';
import { Loader2, Wand2, Check, X, AlertTriangle } from 'lucide-react';
import { proponiNote } from '@/app/actions/assistente';
import type { NoteProposte } from '@/lib/noteRiscritte';

export default function AggiornaNote({ attuali, onApplica }: {
  attuali: string;
  onApplica: (note: string) => void;
}) {
  const [testo, setTesto] = useState('');
  const [proposta, setProposta] = useState<NoteProposte | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, start] = useTransition();

  const chiedi = () => start(async () => {
    setErrore(null);
    setProposta(null);
    const r = await proponiNote(attuali, testo);
    if (!r.ok || !r.proposta) setErrore(r.errore || 'Non riuscito');
    else setProposta(r.proposta);
  });

  const applica = () => {
    if (!proposta) return;
    onApplica(proposta.note);
    setProposta(null);
    setTesto('');
  };

  return (
    <div className="space-y-2">
      <textarea
        value={testo}
        onChange={e => setTesto(e.target.value)}
        rows={3}
        placeholder={'Scrivi come viene, anche disordinato. Es. «da settembre il lunedì siamo chiusi, e se chiedono di Marika dì che torna a gennaio»'}
        className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary" />

      <div className="flex items-center gap-2">
        <button onClick={chiedi} disabled={inCorso || !testo.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-40">
          {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Sistemalo tu
        </button>
        <span className="text-[10px] text-text-muted/70">
          Lo unisce alle note che ci sono già. Non salva niente finché non lo dici tu.
        </span>
      </div>

      {errore && (
        <p className="text-[11px] text-error flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />{errore}
        </p>
      )}

      {proposta && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
          <p className="text-[11px] font-medium text-text-primary">Come verrebbero le note</p>
          <pre className="whitespace-pre-wrap text-[11px] text-text-secondary bg-bg-secondary border border-border rounded-lg p-3 max-h-64 overflow-auto">
            {proposta.note}
          </pre>

          {proposta.cambiato.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Cosa cambia</p>
              <ul className="mt-1 space-y-0.5">
                {proposta.cambiato.map((c, i) => (
                  <li key={i} className="text-[11px] text-text-secondary">· {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Quello che NON è entrato conta quanto quello che è entrato: di
              solito è un orario o un prezzo, che l'assistente legge già dal
              gestionale e che scritto anche qui diventa un secondo posto che
              invecchia. Se non lo si dice, sembra che sia stato ignorato. */}
          {proposta.scartato.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-warning uppercase tracking-wider">Lasciato fuori</p>
              <ul className="mt-1 space-y-0.5">
                {proposta.scartato.map((c, i) => (
                  <li key={i} className="text-[11px] text-text-secondary">· {c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={applica}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium">
              <Check className="w-3.5 h-3.5" /> Usa queste note
            </button>
            <button onClick={() => setProposta(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover">
              <X className="w-3.5 h-3.5" /> Lascia stare
            </button>
            <span className="text-[10px] text-text-muted/70">Poi ricordati di premere Salva.</span>
          </div>
        </div>
      )}
    </div>
  );
}
