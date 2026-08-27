'use client';

/**
 * Assistente — la pagina dove il centro decide cosa sa e cosa dice.
 *
 * Fin qui le regole stavano solo nel codice: chi lavora al centro non poteva
 * né leggerle né cambiarle, e un assistente che parla alle clienti senza che
 * nessuno sappia cosa gli è stato detto è un rischio, non un aiuto.
 *
 * Le tre cose che si fanno qui: gli orari veri di apertura, quello che
 * l'assistente deve sapere e che nei dati non c'è, e la lettura del testo
 * esatto che riceve — perché finché resta invisibile nessuno può accorgersi
 * che dice una cosa sbagliata.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Clock, FileText, CheckCircle2, AlertTriangle, Save, ScanSearch, HelpCircle } from 'lucide-react';
import Autocritica from './Autocritica';
import Chiamate from './Chiamate';
import Chiarimenti from './Chiarimenti';

import {
  caricaCentro, salvaImpostazioniCentro, anteprimaIstruzioni, statoAssistente,
} from '@/app/actions/assistente';
import type { Centro, OrarioGiorno } from '@/lib/centro';

const GIORNI: { n: string; nome: string }[] = [
  { n: '1', nome: 'Lunedì' }, { n: '2', nome: 'Martedì' }, { n: '3', nome: 'Mercoledì' },
  { n: '4', nome: 'Giovedì' }, { n: '5', nome: 'Venerdì' }, { n: '6', nome: 'Sabato' },
  { n: '7', nome: 'Domenica' },
];

type Stato = Awaited<ReturnType<typeof statoAssistente>>;

export default function AssistentePage() {
  const [centro, setCentro] = useState<Centro | null>(null);
  const [stato, setStato] = useState<Stato | null>(null);
  const [istruzioni, setIstruzioni] = useState('');
  const [canale, setCanale] = useState<'telefono' | 'whatsapp'>('telefono');
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);

  const ricarica = useCallback(async (quale: 'telefono' | 'whatsapp') => {
    setIstruzioni(await anteprimaIstruzioni(quale));
  }, []);

  useEffect(() => {
    void (async () => {
      setCentro(await caricaCentro());
      setStato(await statoAssistente());
      await ricarica('telefono');
    })();
  }, [ricarica]);

  const cambiaCanale = async (quale: 'telefono' | 'whatsapp') => {
    setCanale(quale);
    await ricarica(quale);
  };

  const aggiornaOrario = (giorno: string, patch: Partial<OrarioGiorno> | null) => {
    if (!centro) return;
    const orari = { ...(centro.orari || {}) };
    orari[giorno] = patch === null ? null : { apre: '09:00', chiude: '19:00', ...orari[giorno], ...patch };
    setCentro({ ...centro, orari });
    setSalvato(false);
  };

  const salva = async () => {
    if (!centro) return;
    setSalvando(true);
    try {
      await salvaImpostazioniCentro(centro);
      // Le istruzioni contengono gli orari: cambiati quelli, cambia il testo.
      await ricarica(canale);
      setStato(await statoAssistente());
      setSalvato(true);
    } finally {
      setSalvando(false);
    }
  };

  if (!centro) {
    return <div className="p-6 text-sm text-text-muted">Carico…</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Assistente</h2>
        <p className="text-sm text-text-secondary">
          Cosa sa e cosa dice alle clienti, al telefono e su WhatsApp.
        </p>
      </div>

      {/* ---------------------------------------------------------- stato */}
      {stato && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Spia ok={stato.segretoImpostato} testo="Collegamento" manca="Manca VOICE_API_SECRET" />
          <Spia ok={stato.modelloImpostato} testo="Modello" manca="Manca ANTHROPIC_API_KEY" />
          <Spia ok={stato.orariImpostati} testo="Orari" manca="Orari non impostati" />
          <Spia ok={stato.telefonoCentro} testo="Numero del centro" manca="Senza, non può passare le chiamate" />
        </div>
      )}

      {/* --------------------------------------------------- dati del centro */}
      <Sezione icona={Phone} titolo="Il centro"
        sotto="Quello che l'assistente dice quando le chiedono dove siete e come raggiungervi.">
        <div className="grid md:grid-cols-2 gap-3">
          <Campo etichetta="Nome" valore={centro.nome}
            onChange={v => { setCentro({ ...centro, nome: v }); setSalvato(false); }} />
          <Campo etichetta="Indirizzo" valore={centro.indirizzo || ''}
            onChange={v => { setCentro({ ...centro, indirizzo: v }); setSalvato(false); }} />
          <Campo etichetta="Telefono" valore={centro.telefono || ''}
            aiuto="È il numero a cui l'assistente passa la chiamata quando non sa rispondere."
            onChange={v => { setCentro({ ...centro, telefono: v }); setSalvato(false); }} />
          <Campo etichetta="Sito" valore={centro.sito || ''}
            onChange={v => { setCentro({ ...centro, sito: v }); setSalvato(false); }} />
        </div>
      </Sezione>

      {/* ------------------------------------------------------------ orari */}
      <Sezione icona={Clock} titolo="Orari di apertura"
        sotto="L'assistente li dice a voce e non propone appuntamenti nei giorni chiusi.">
        <div className="space-y-2">
          {GIORNI.map(g => {
            const o = centro.orari?.[g.n] ?? null;
            return (
              <div key={g.n} className="flex items-center gap-3 flex-wrap">
                <span className="w-24 text-sm text-text-primary">{g.nome}</span>
                <label className="flex items-center gap-2 text-xs text-text-muted">
                  <input type="checkbox" checked={!!o}
                    onChange={e => aggiornaOrario(g.n, e.target.checked ? {} : null)} />
                  {o ? 'Aperto' : 'Chiuso'}
                </label>
                {o && (
                  <>
                    <input type="time" value={o.apre}
                      onChange={e => aggiornaOrario(g.n, { apre: e.target.value })}
                      className="px-2 py-1 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary" />
                    <span className="text-text-muted text-xs">→</span>
                    <input type="time" value={o.chiude}
                      onChange={e => aggiornaOrario(g.n, { chiude: e.target.value })}
                      className="px-2 py-1 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="text-xs text-text-muted mb-1">Chiusure straordinarie (ferie, festivi), una data per riga</p>
          <textarea
            value={(centro.chiusure || []).join('\n')}
            onChange={e => {
              setCentro({ ...centro, chiusure: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) });
              setSalvato(false);
            }}
            rows={3} placeholder="2026-08-15"
            className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary font-mono" />
        </div>
      </Sezione>

      {/* ------------------------------------------------------------- note */}
      <Sezione icona={FileText} titolo="Da sapere"
        sotto="Quello che l'assistente deve sapere e che nei dati non c'è. Finisce in fondo alle sue istruzioni.">
        <textarea
          value={centro.noteVoce || ''}
          onChange={e => { setCentro({ ...centro, noteVoce: e.target.value }); setSalvato(false); }}
          rows={5}
          placeholder={'Es. In agosto siamo aperti solo la mattina.\nIl parcheggio è nel cortile interno.\nPer il laser serve la visita prima.'}
          className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary" />
      </Sezione>

      {/* ------------------------------------------------------ chiarimenti */}
      <Sezione icona={HelpCircle} titolo="Quando non è chiaro quale trattamento"
        sotto="«Il gel» può essere quattro cose. Qui si scrivono le domande che le ragazze fanno per capirlo.">
        <Chiarimenti
          valore={centro.chiarimenti || []}
          onChange={v => { setCentro({ ...centro, chiarimenti: v }); setSalvato(false); }} />
      </Sezione>

      {/* ------------------------------------------------------ salvataggio */}
      <div className="flex items-center gap-3">
        <button onClick={salva} disabled={salvando}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60">
          <Save className="w-4 h-4" />
          {salvando ? 'Salvo…' : 'Salva'}
        </button>
        {salvato && <span className="text-xs text-success">Salvato. Vale dalla prossima telefonata.</span>}
      </div>

      {/* -------------------------------------------------------- chiamate */}
      <Sezione icona={Phone} titolo="Le telefonate"
        sotto="Chi ha chiamato, com'e' finita e cosa si sono detti. Comprese quelle che ha passato a una persona.">
        <Chiamate />
      </Sezione>

      {/* ------------------------------------------------------ autocritica */}
      <Sezione icona={ScanSearch} titolo="Come è andata"
        sotto="La segretaria si rilegge ogni sera e dice cosa ha sbagliato. Quello che propone di imparare lo decidi tu.">
        <Autocritica />
      </Sezione>

      {/* ------------------------------------------------------- istruzioni */}
      <Sezione icona={FileText} titolo="Le regole, come le riceve l'assistente"
        sotto="Il testo esatto. Le parti fisse stanno nel codice; orari, dati del centro e note qui sopra ci entrano da sole.">
        <div className="flex gap-2 mb-3">
          {(['telefono', 'whatsapp'] as const).map(q => (
            <button key={q} onClick={() => cambiaCanale(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                canale === q ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-muted'
              }`}>
              {q === 'telefono' ? 'Al telefono' : 'Su WhatsApp'}
            </button>
          ))}
        </div>
        <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-bg-secondary border border-border rounded-xl p-4 max-h-96 overflow-auto">
          {istruzioni}
        </pre>
      </Sezione>
    </motion.div>
  );
}

function Spia({ ok, testo, manca }: { ok: boolean; testo: string; manca: string }) {
  return (
    <div className={`p-3 rounded-xl border ${ok ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />}
        <span className="text-xs font-medium text-text-primary">{testo}</span>
      </div>
      {!ok && <p className="text-[11px] text-text-muted mt-1">{manca}</p>}
    </div>
  );
}

function Sezione({ icona: Icona, titolo, sotto, children }: {
  icona: typeof Phone; titolo: string; sotto: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Icona className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{titolo}</p>
          <p className="text-xs text-text-muted mt-0.5">{sotto}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Campo({ etichetta, valore, onChange, aiuto }: {
  etichetta: string; valore: string; onChange: (v: string) => void; aiuto?: string;
}) {
  return (
    <div>
      <label className="text-xs text-text-muted">{etichetta}</label>
      <input value={valore} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary" />
      {aiuto && <p className="text-[11px] text-text-muted mt-1">{aiuto}</p>}
    </div>
  );
}
