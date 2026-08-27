'use client';

/**
 * Le domande che distinguono i trattamenti.
 *
 * «Il gel» al banco non vuol dire niente: può essere una ricostruzione da
 * zero, un ritocco, un semipermanente, un acrygel. Le ragazze lo risolvono
 * senza pensarci, con due domande — e quelle domande non stanno in nessun
 * database, stanno nella loro testa.
 *
 * Qui si scrivono una volta. Da quel momento le fa anche l'assistente, e sono
 * l'unica cosa che le permette di prendere appuntamenti senza indovinare.
 */

import React, { useState, useTransition } from 'react';
import { Plus, Trash2, Sparkles, Loader2, Check } from 'lucide-react';
import { proponiDomandeTrattamenti } from '@/app/actions/assistente';
import type { ChiarimentoProposto } from '@/lib/chiarimentiProposti';
import type { Chiarimento } from '@/lib/centro';

const VUOTO: Chiarimento = { parole: [], chiedi: '', scelta: '' };

export default function Chiarimenti({
  valore, onChange,
}: {
  valore: Chiarimento[];
  onChange: (v: Chiarimento[]) => void;
}) {
  const aggiorna = (i: number, patch: Partial<Chiarimento>) =>
    onChange(valore.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const [proposte, setProposte] = useState<ChiarimentoProposto[] | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [inCorso, start] = useTransition();

  const chiediProposte = () => start(async () => {
    setNota(null);
    const r = await proponiDomandeTrattamenti();
    if (!r.ok) { setNota(r.motivo); return; }
    setProposte(r.proposte.filter(p => !p.giaPresente));
    if (r.proposte.length === 0) setNota('Non ha trovato parole ambigue da chiarire.');
    else setNota(r.chatLette > 0
      ? `Ha letto il listino e ${r.chatLette} conversazioni in cui ha risposto una persona.`
      : 'Ha letto solo il listino: in archivio non c\'erano conversazioni con risposte scritte a mano.');
  });

  const accetta = (p: ChiarimentoProposto) => {
    onChange([...valore, { parole: p.parole, chiedi: p.chiedi, scelta: p.scelta }]);
    setProposte((proposte || []).filter(x => x !== p));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-muted leading-relaxed">
        Quando una cliente dice una parola che può voler dire più trattamenti, l&apos;assistente
        <b> non sceglie</b>: fa la domanda che scrivi qui. Se quella cliente quel trattamento
        l&apos;ha già fatto, invece, non chiede niente — conferma e basta.
      </p>

      {valore.length === 0 && (
        <p className="text-xs text-text-muted">
          Nessuna ancora. Comincia dalle due o tre parole che al telefono vi fanno sempre
          chiedere «in che senso?».
        </p>
      )}

      {valore.map((c, i) => (
        <div key={i} className="p-3 rounded-xl bg-bg-secondary border border-border/50 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Quando la cliente dice…
                </label>
                <input
                  type="text"
                  value={(c.parole || []).join(', ')}
                  onChange={e => aggiorna(i, { parole: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="gel, unghie, ricostruzione"
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary" />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  …tu chiedi
                </label>
                <input
                  type="text"
                  value={c.chiedi}
                  onChange={e => aggiorna(i, { chiedi: e.target.value })}
                  placeholder="Le hai già fatte o partiamo da zero?"
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary" />
                <p className="text-[10px] text-text-muted/70 mt-1">
                  Una domanda sulla sua situazione, non un elenco di nomi: se sapesse la differenza
                  fra acrygel e gel te lo avrebbe già detto.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  E in base alla risposta scegli così
                </label>
                <textarea
                  value={c.scelta || ''}
                  onChange={e => aggiorna(i, { scelta: e.target.value })}
                  rows={2}
                  placeholder="Se è un ritocco su una ricostruzione che ha già → Refill. Se parte da zero → Ricostruzione gel. Se le rompe spesso → Acrygel."
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary" />
              </div>
            </div>

            <button
              onClick={() => onChange(valore.filter((_, k) => k !== i))}
              title="Togli"
              className="p-1.5 rounded-lg bg-bg-tertiary border border-border text-text-muted hover:text-error flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onChange([...valore, { ...VUOTO }])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover">
          <Plus className="w-3.5 h-3.5" /> Aggiungi
        </button>

        {/* Scriverle a mano è il modo giusto ed è anche quello che non si fa
            mai. Le domande però esistono già: sono nelle chat, ogni volta che
            una ragazza ha risposto «ce le hai già o partiamo da zero?». */}
        <button onClick={chiediProposte} disabled={inCorso}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-xs text-accent hover:bg-accent/15 disabled:opacity-50">
          {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Proponile tu, dal listino e dalle chat
        </button>
      </div>

      {nota && <p className="text-[11px] text-text-muted">{nota}</p>}

      {proposte && proposte.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-medium text-text-secondary">
            Proposte — entrano solo se le accetti
          </p>
          {proposte.map((p, i) => (
            <div key={i} className="p-3 rounded-xl bg-bg-tertiary border border-accent/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-text-primary">
                    <b>{p.parole.join(', ')}</b>
                    {p.dalleChat && (
                      <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-success/15 text-success align-middle">
                        DALLE VOSTRE CHAT
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">«{p.chiedi}»</p>
                  {p.scelta && <p className="text-[11px] text-text-muted mt-1">{p.scelta}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => accetta(p)} title="Aggiungi"
                    className="p-1.5 rounded-lg bg-success/15 text-success">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setProposte(proposte.filter(x => x !== p))} title="No"
                    className="p-1.5 rounded-lg bg-bg-hover text-text-muted">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-text-muted/70 leading-relaxed">
            Quelle accettate finiscono nell&apos;elenco qui sopra: rileggile e poi <b>Salva</b>.
          </p>
        </div>
      )}
    </div>
  );
}
