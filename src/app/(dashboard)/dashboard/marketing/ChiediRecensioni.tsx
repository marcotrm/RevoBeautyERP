'use client';

/**
 * "Chiedi le recensioni": il giro che porta le clienti su Google.
 *
 * La schermata risponde a tre domande, in quest'ordine: a chi lo chiedo oggi,
 * quanto mi costa mandarlo, e sta funzionando? L'ultima è quella che di solito
 * manca: chieste → aperture del modulo → recensioni sulla scheda. Se le
 * aperture sono tante e le recensioni no, il problema è Google; se sono poche
 * le aperture, il problema è il messaggio.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Star, Send, Loader2, RefreshCw, ExternalLink, Info, CheckCircle } from 'lucide-react';
import {
  candidateRecensioni, mandaRichiesteRecensione, statoCampagnaRecensioni,
  type StatoCampagnaRecensioni,
} from '@/app/actions/campagnaRecensioni';
import { costoStimato, type CandidataRecensione } from '@/lib/campagnaRecensioni';

const FINESTRE = [7, 14, 30];

function Numero({ valore, etichetta, nota, tono = 'normale' }: {
  valore: string | number; etichetta: string; nota?: string; tono?: 'normale' | 'buono' | 'accento';
}) {
  const colore = tono === 'buono' ? 'text-success' : tono === 'accento' ? 'text-accent' : 'text-text-primary';
  return (
    <div className="flex-1 min-w-[110px]">
      <p className={`text-2xl font-display font-bold leading-tight ${colore}`}>{valore}</p>
      <p className="text-xs font-medium text-text-secondary">{etichetta}</p>
      {nota && <p className="text-[11px] text-text-muted leading-tight mt-0.5">{nota}</p>}
    </div>
  );
}

export default function ChiediRecensioni() {
  const [finestra, setFinestra] = useState(14);
  const [candidate, setCandidate] = useState<CandidataRecensione[]>([]);
  const [scartati, setScartati] = useState<{ nome: string; motivo: string }[]>([]);
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [stato, setStato] = useState<StatoCampagnaRecensioni | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  const carica = useCallback(async (giorni: number) => {
    setCaricando(true);
    try {
      const [c, s] = await Promise.all([candidateRecensioni(giorni), statoCampagnaRecensioni()]);
      setCandidate(c.candidate);
      setScartati(c.scartati);
      // Tutte spuntate: il caso normale è "mandale a tutte", chi va tolta si toglie.
      setScelti(new Set(c.candidate.map(x => x.clientId)));
      setStato(s);
    } finally {
      setCaricando(false);
    }
  }, []);

  useEffect(() => { void carica(finestra); }, [carica, finestra]);

  const cambia = (id: string) => setScelti(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const manda = async () => {
    const ids = candidate.filter(c => scelti.has(c.clientId)).map(c => c.clientId);
    if (ids.length === 0) return;
    if (!window.confirm(`Mandare la richiesta di recensione a ${ids.length} client${ids.length === 1 ? 'e' : 'i'}?\n\nCosto stimato ${costoStimato(ids.length).toFixed(2)} €.`)) return;

    setInviando(true);
    try {
      const r = await mandaRichiesteRecensione(ids);
      setEsito(
        r.inviate > 0
          ? `Partite ${r.inviate} richieste (${r.costo.toFixed(2)} €).${r.fallite ? ` ${r.fallite} non partite: ${r.errori.join(', ')}` : ''}`
          : `Nessuna richiesta partita. ${r.errori.join(', ') || 'Controlla il collegamento WhatsApp.'}`
      );
      await carica(finestra);
    } finally {
      setInviando(false);
    }
  };

  const quanti = scelti.size;

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
          <Star className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-base font-display font-semibold text-text-primary">Chiedi le recensioni</h3>
          <p className="text-xs text-text-secondary">
            Un messaggio a chi è appena stata, col bottone che apre il modulo di Google
          </p>
        </div>
        <button onClick={() => carica(finestra)} disabled={caricando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-xs font-medium text-text-primary hover:bg-bg-hover disabled:opacity-50">
          {caricando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Aggiorna
        </button>
      </div>

      {/* Il giro: chieste → aperture → recensioni */}
      {stato && (
        <div className="flex items-start gap-4 px-5 py-4 border-b border-border bg-bg-tertiary/30 flex-wrap">
          <Numero valore={stato.chieste} etichetta="richieste mandate" nota={`${stato.chiesteMese} negli ultimi 30 giorni`} />
          <Numero valore={stato.aperture} etichetta="hanno aperto Google" nota="click sul bottone del messaggio" />
          <Numero valore={stato.recensioni || '—'} etichetta="recensioni sulla scheda"
            nota={stato.media ? `media ${stato.media.toFixed(1)} ★` : 'collega la scheda Google qui sotto'}
            tono="buono" />
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Cosa si può e cosa non si può fare col link */}
        <div className="flex gap-2.5 p-3 rounded-xl bg-accent/5 border border-accent/20">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed space-y-1">
            <p>
              Il bottone porta la cliente <b>dritta al modulo con le stelle</b>: tocca la quinta, scrive due
              righe se vuole, pubblica. Non serve cercare il centro su Maps.
            </p>
            <p>
              Le <b>cinque stelle non si possono lasciare già segnate</b>: Google non accetta il voto dentro
              al link, deve essere la cliente a toccarlo. E non si filtra chi invitare in base a quanto è
              contenta — Google lo chiama <i>review gating</i> e può sospendere la scheda. Si chiede a tutte.
            </p>
          </div>
        </div>

        {/* Finestra: quanto indietro andare a pescare */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-secondary">Chi è venuto negli ultimi</span>
          {FINESTRE.map(g => (
            <button key={g} onClick={() => setFinestra(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                finestra === g ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
              }`}>
              {g} giorni
            </button>
          ))}
          {stato && (
            <span className="text-[11px] text-text-muted ml-auto">
              A chi ha già ricevuto non si richiede per {stato.giorniRichiesta} giorni
            </span>
          )}
        </div>

        {esito && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-xs text-success">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{esito}</span>
          </div>
        )}

        {caricando ? (
          <div className="py-8 text-center text-text-muted text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cerco chi è passato…
          </div>
        ) : candidate.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-secondary">Nessuno a cui chiedere in questi {finestra} giorni.</p>
            <p className="text-xs text-text-muted mt-1">
              Si pesca solo fra gli appuntamenti chiusi: se la giornata non è stata incassata, la cliente non
              risulta passata.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setScelti(new Set(candidate.map(c => c.clientId)))}
                className="text-xs font-medium text-accent hover:underline">Scegli tutte</button>
              <span className="text-text-muted text-xs">·</span>
              <button onClick={() => setScelti(new Set())}
                className="text-xs font-medium text-text-secondary hover:underline">Nessuna</button>
              <span className="text-xs text-text-muted ml-auto">
                {candidate.length} client{candidate.length === 1 ? 'e' : 'i'} da chiedere
              </span>
            </div>

            <div className="border border-border rounded-xl divide-y divide-border/40 max-h-80 overflow-y-auto">
              {candidate.map(c => (
                <label key={c.clientId}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover cursor-pointer transition-colors">
                  <input type="checkbox" checked={scelti.has(c.clientId)} onChange={() => cambia(c.clientId)}
                    className="w-4 h-4 rounded border-border accent-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{c.nome}</p>
                    <p className="text-[11px] text-text-secondary truncate">{c.trattamento}</p>
                  </div>
                  <span className="text-[11px] text-text-muted flex-shrink-0">
                    {c.giorniFa === 0 ? 'oggi' : c.giorniFa === 1 ? 'ieri' : `${c.giorniFa} giorni fa`}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={manda} disabled={inviando || quanti === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                {inviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {inviando ? 'Sto mandando…' : `Manda a ${quanti} client${quanti === 1 ? 'e' : 'i'}`}
              </button>
              <span className="text-xs text-text-muted">
                Costo stimato {costoStimato(quanti).toFixed(2)} € · template <code>richiesta_recensione</code>
              </span>
              <a href="/r/recensione" target="_blank" rel="noreferrer"
                className="text-xs text-accent font-medium hover:underline flex items-center gap-1 ml-auto">
                Prova il bottone <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}

        {/* Chi è rimasto fuori, e perché: senza questo sembra che il gestionale si dimentichi delle clienti */}
        {scartati.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
              {scartati.length} rimasti fuori
            </summary>
            <ul className="mt-2 space-y-1 pl-1">
              {scartati.map((s, i) => (
                <li key={i} className="text-text-muted">
                  <span className="text-text-secondary">{s.nome}</span> — {s.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
