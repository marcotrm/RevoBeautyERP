'use client';

/**
 * Recensioni Google in Marketing.
 *
 * Lo scopo è uno solo: accorgersi che è arrivata una recensione, subito, e
 * soprattutto se è brutta. Una recensione negativa a cui si risponde in
 * giornata fa meno danno di una a cui si risponde fra due settimane, e finché
 * bisognava ricordarsi di aprire Google nessuno se ne accorgeva.
 *
 * Per questo il riquadro pulsa finché non lo si guarda, e le negative hanno un
 * colore diverso dalle positive.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Star, RefreshCw, Loader2, ExternalLink, Search, Check, AlertTriangle } from 'lucide-react';
import {
  statoRecensioni, aggiornaSeVecchio, cercaSchedaGoogle, collegaSchedaGoogle, segnaRecensioniViste,
} from '@/app/actions/recensioni';
import type { StatoRecensioni, Recensione } from '@/lib/recensioni';
import { NO_AUTOFILL } from '@/lib/noAutofill';

type Stato = StatoRecensioni & { configurato: boolean };

/** Sotto le tre stelle è un problema da gestire, non un complimento da leggere. */
const negativa = (r: Recensione) => r.stelle <= 3;

function Stelle({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} style={{ width: size, height: size }}
          className={i <= Math.round(n) ? 'text-warning fill-warning' : 'text-border'} />
      ))}
    </span>
  );
}

function CardRecensione({ r, nuova }: { r: Recensione; nuova: boolean }) {
  const brutta = negativa(r);
  return (
    <div className={`p-3 rounded-xl border transition-colors ${
      nuova
        ? brutta ? 'border-error/50 bg-error/5' : 'border-success/50 bg-success/5'
        : 'border-border bg-bg-tertiary/30'
    }`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm font-medium text-text-primary truncate flex-1">{r.autore}</span>
        {nuova && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${brutta ? 'bg-error' : 'bg-success'}`}>
            NUOVA
          </span>
        )}
        <Stelle n={r.stelle} />
      </div>
      {r.testo
        ? <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{r.testo}</p>
        : <p className="text-xs text-text-muted italic">Solo stelle, senza commento.</p>}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-text-muted">{r.quandoTesto || (r.quando ? new Date(r.quando).toLocaleDateString('it-IT') : '')}</span>
        {r.link && (
          <a href={r.link} target="_blank" rel="noreferrer"
            className="text-[10px] text-accent font-medium hover:underline flex items-center gap-1">
            {brutta ? 'Rispondi su Google' : 'Apri su Google'} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Prima configurazione: si sceglie quale scheda Google guardare. */
function CollegaScheda({ onCollegata }: { onCollegata: (s: Stato) => void }) {
  const [query, setQuery] = useState('RevoBeauty Via Caudina 30 Maddaloni');
  const [cercando, setCercando] = useState(false);
  const [schede, setSchede] = useState<{ placeId: string; nome: string; indirizzo: string; media: number; totale: number }[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [collegando, setCollegando] = useState('');

  const cerca = async () => {
    setCercando(true); setErrore(null);
    const r = await cercaSchedaGoogle(query);
    setCercando(false);
    if (!r.ok) { setErrore(r.error || 'Ricerca fallita'); return; }
    setSchede(r.schede);
  };

  const collega = async (s: { placeId: string; nome: string; indirizzo: string }) => {
    setCollegando(s.placeId);
    try { onCollegata(await collegaSchedaGoogle(s.placeId, s.nome, s.indirizzo)); }
    finally { setCollegando(''); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary leading-relaxed">
        Scegli la scheda Google del centro. Attenzione a prendere quella giusta: esiste anche una
        <b> Revo Beauty a Marcianise</b>, che è un&apos;altra attività.
      </p>
      <div className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} {...NO_AUTOFILL}
          onKeyDown={e => { if (e.key === 'Enter') void cerca(); }}
          className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        <button onClick={cerca} disabled={cercando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50">
          {cercando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Cerca
        </button>
      </div>
      {errore && <p className="text-xs text-error">{errore}</p>}
      {schede?.length === 0 && <p className="text-xs text-text-muted">Nessuna scheda trovata. Prova col nome esatto che si legge su Google Maps.</p>}
      {schede?.map(s => (
        <div key={s.placeId} className="flex items-center gap-3 p-3 rounded-xl border border-border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary truncate">{s.nome}</p>
            <p className="text-[11px] text-text-muted truncate">{s.indirizzo}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {s.media ? `${s.media.toFixed(1)} ★ · ${s.totale} recensioni` : 'nessuna recensione'}
            </p>
          </div>
          <button onClick={() => collega(s)} disabled={!!collegando}
            className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50 flex-shrink-0">
            {collegando === s.placeId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'È questa'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function RecensioniGoogle() {
  const [stato, setStato] = useState<Stato | null>(null);
  const [aggiornando, setAggiornando] = useState(false);

  // Prima si mostra quello che sappiamo già (istantaneo), poi si rilegge da
  // Google solo se la fotografia è vecchia: ogni lettura è a pagamento.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const subito = await statoRecensioni();
      if (!vivo) return;
      setStato(subito);
      if (subito.configurato && subito.placeId) {
        const fresco = await aggiornaSeVecchio(false);
        if (vivo) setStato(fresco);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const aggiorna = useCallback(async () => {
    setAggiornando(true);
    try { setStato(await aggiornaSeVecchio(true)); }
    finally { setAggiornando(false); }
  }, []);

  const viste = new Set(stato?.viste || []);
  const nuove = (stato?.recensioni || []).filter(r => !viste.has(r.id));
  // Il conteggio su Google è salito più di quanto si veda: una recensione c'è
  // ma non è fra le cinque che l'API restituisce.
  const nuoveNascoste = Math.max(0, (stato?.totale || 0) - (stato?.totaleAllUltimaVista || 0) - nuove.length);
  const daGuardare = nuove.length + nuoveNascoste;
  const brutteNuove = nuove.filter(negativa).length;

  return (
    <div className={`bg-bg-secondary border rounded-2xl overflow-hidden transition-colors ${
      daGuardare > 0
        ? brutteNuove > 0 ? 'border-error animate-pulse-brutta' : 'border-success animate-pulse-buona'
        : 'border-border'
    }`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${daGuardare > 0 ? (brutteNuove > 0 ? 'bg-error/15 text-error' : 'bg-success/15 text-success') : 'bg-warning/10 text-warning'}`}>
            <Star className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-semibold text-text-primary">Recensioni Google</h3>
            <p className="text-xs text-text-muted">
              {stato?.nomeScheda ? stato.nomeScheda : 'La scheda del centro su Google Maps'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {daGuardare > 0 && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${brutteNuove > 0 ? 'bg-error' : 'bg-success'}`}>
              {daGuardare} {daGuardare === 1 ? 'nuova' : 'nuove'}
            </span>
          )}
          {stato?.placeId && (
            <>
              <button onClick={aggiorna} disabled={aggiornando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${aggiornando ? 'animate-spin' : ''}`} /> Aggiorna
              </button>
              {daGuardare > 0 && (
                <button onClick={async () => setStato(await segnaRecensioniViste())}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-white text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" /> Le ho viste
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* L'avviso della chiave mancante non sostituisce i dati: se una
            fotografia c'è già, si continua a mostrarla. */}
        {stato && !stato.configurato && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Manca la chiave <b>GOOGLE_MAPS_API_KEY</b> nelle variabili del server. Si crea in Google Cloud
              Console (Places API attiva) e si incolla su Railway: senza, il gestionale non può più rileggere Google.
            </p>
          </div>
        )}

        {stato === null ? (
          <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> carico…</p>
        ) : !stato.placeId ? (
          // Senza chiave la ricerca della scheda non funzionerebbe: prima
          // quella, poi si sceglie quale scheda guardare.
          stato.configurato && <CollegaScheda onCollegata={setStato} />
        ) : (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-text-primary">{stato.media ? stato.media.toFixed(1) : '—'}</span>
                <Stelle n={stato.media} size={16} />
              </div>
              <span className="text-sm text-text-secondary">{stato.totale} recensioni in totale</span>
              {stato.ultimaLettura && (
                <span className="text-[11px] text-text-muted ml-auto">
                  letto {new Date(stato.ultimaLettura).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {stato.errore && <p className="text-xs text-error">{stato.errore}</p>}

            {nuoveNascoste > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/5 border border-accent/25">
                <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  Su Google il conteggio è salito di <b>{nuoveNascoste}</b>, ma il testo non è fra quelle che
                  ci fa vedere: Google ne restituisce al massimo cinque e le sceglie lui.
                  {' '}<a href={`https://search.google.com/local/reviews?placeid=${stato.placeId}`}
                    target="_blank" rel="noreferrer" className="text-accent font-medium hover:underline">
                    Aprile su Google
                  </a>.
                </p>
              </div>
            )}

            {stato.recensioni.length === 0 ? (
              <p className="text-sm text-text-muted">Nessuna recensione con testo, per ora.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {[...stato.recensioni]
                  // Le nuove in cima, poi le più recenti: si guarda la prima e si è a posto.
                  .sort((a, b) => Number(!viste.has(b.id)) - Number(!viste.has(a.id)) || b.quando.localeCompare(a.quando))
                  .map(r => <CardRecensione key={r.id} r={r} nuova={!viste.has(r.id)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
