'use client';

/**
 * I richiami: le persone a cui hai promesso di ritelefonare.
 *
 * Quella che ha chiesto il prezzo del laser e ci sta pensando, quella che ha
 * scritto «vi faccio sapere», quella che ha detto «richiamatemi lunedi'».
 * Stavano su un post-it, e i post-it si perdono: dopo tre giorni non ti
 * ricordi ne' chi era ne' cosa voleva, e quella telefonata non parte piu'.
 *
 * Il tasto sta in agenda perche' e' la schermata aperta tutto il giorno, ed e'
 * li' che il promemoria deve poter saltare fuori. Bussa da solo quando arriva
 * l'ora, e la telefonata si chiude con un esito scritto — «ha prenotato» e
 * «non interessata» non sono la stessa cosa, e a fine mese la differenza fra
 * le due dice se queste telefonate valga la pena farle.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, X, Plus, Check, Clock, Phone, Trash2, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  nuovoRichiamo, richiamiAperti, richiamiChiusi, chiudiRichiamo, rimandaRichiamo,
  riapriRichiamo, eliminaRichiamo,
  type RigaRichiamo,
} from '@/app/actions/richiami';
import { ESITI, type EsitoRichiamo } from '@/lib/esitiRichiamo';

/** Le fasce, con l'ora in cui il promemoria torna a bussare. */
const FASCE: { id: string; testo: string; ora: string }[] = [
  { id: 'mattina', testo: 'Mattina', ora: '09:30' },
  { id: 'pomeriggio', testo: 'Pomeriggio', ora: '15:00' },
  { id: 'sera', testo: 'Sera', ora: '18:00' },
  { id: 'qualsiasi', testo: 'Quando capita', ora: '09:30' },
];

/**
 * Da giorno + ora a istante, nel fuso di chi sta al banco.
 *
 * `new Date('2026-09-07T09:30')` senza la Z e' ora locale: e' esattamente
 * quello che serve, perche' «lunedi' mattina» vuol dire le nove e mezza di
 * qui, non di un server che sta altrove.
 */
function istante(giorno: string, ora: string): string {
  const d = new Date(`${giorno}T${ora}`);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const giornoIso = (d: Date) => {
  const p = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return p.toISOString().slice(0, 10);
};

/** Il prossimo lunedì (o quello di oggi, se oggi è lunedì e non è ancora tardi). */
function prossimoLunedi(): string {
  const d = new Date();
  const quantiGiorni = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + quantiGiorni);
  return giornoIso(d);
}

function quandoScritto(iso: string): string {
  const d = new Date(iso);
  const oggi = giornoIso(new Date());
  const suo = giornoIso(d);
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (suo === oggi) return `oggi alle ${ora}`;
  const domani = new Date(); domani.setDate(domani.getDate() + 1);
  if (suo === giornoIso(domani)) return `domani alle ${ora}`;
  return `${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${ora}`;
}

export default function TastoRichiami() {
  const [aperto, setAperto] = useState(false);
  const [lista, setLista] = useState<RigaRichiamo[] | null>(null);
  const [storico, setStorico] = useState<RigaRichiamo[]>([]);
  const [scheda, setScheda] = useState<'aperti' | 'fatti'>('aperti');
  const [nuovo, setNuovo] = useState(false);
  const [zitto, setZitto] = useState<Set<string>>(new Set());
  const [montato, setMontato] = useState(false);

  // Il portale ha bisogno del `document`, che sul server non c'e': si aspetta
  // il primo giro nel browser. Fuori dal disegno della pagina, cosi' non
  // innesca un secondo render immediato.
  useEffect(() => {
    const t = setTimeout(() => setMontato(true), 0);
    return () => clearTimeout(t);
  }, []);

  const carica = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([richiamiAperti(), richiamiChiusi(30)]);
      setLista(a);
      setStorico(c);
    } catch { /* rete ballerina: si riprova al giro dopo */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void carica(); }, 0);
    const i = setInterval(() => { void carica(); }, 60_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [carica]);

  const scaduti = useMemo(() => (lista || []).filter(r => r.scaduto), [lista]);

  /*
    Il popup salta fuori da solo, ma uno alla volta e mai due volte di fila
    per la stessa persona: metterlo a tacere lo toglie finche' non si ricarica
    la pagina o non arriva la sua ora di nuovo. Cinque popup in fila si
    imparano a chiudere senza leggerli.

    Chi mostrare non e' uno stato: si ricava da quello che c'e' — il primo
    scaduto non ancora zittito — quindi si calcola qui e non si scrive da
    nessuna parte.
  */
  const popup = useMemo(
    () => (aperto ? null : scaduti.find(r => !zitto.has(r.id)) || null),
    [scaduti, aperto, zitto],
  );
  const zittisci = (id: string) => setZitto(z => new Set(z).add(id));

  const chiudi = async (id: string, esito: EsitoRichiamo, nota?: string) => {
    const io = useAuthStore.getState().user;
    await chiudiRichiamo({
      id, esito, nota,
      chiusoDa: [io?.firstName, io?.lastName].filter(Boolean).join(' ') || 'Staff',
    });
    zittisci(id);
    await carica();
  };

  return (
    <>
      <button onClick={() => setAperto(true)} title="Persone da richiamare"
        className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-sm font-medium transition-all ${
          scaduti.length > 0
            ? 'border-warning/40 bg-warning/10 text-warning'
            : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
        <PhoneCall className="w-4 h-4" />
        {(lista?.length ?? 0) > 0 && (
          <span className="text-xs font-bold">{lista!.length}</span>
        )}
        {scaduti.length > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
        )}
      </button>

      {montato && createPortal(
        <>
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
                      <h3 className="text-base font-display font-semibold text-text-primary">Da richiamare</h3>
                      <p className="text-xs text-text-muted">
                        {scaduti.length > 0 ? `${scaduti.length} da fare adesso` : `${lista?.length ?? 0} in lista`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setNuovo(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-accent text-white text-xs font-bold">
                        <Plus className="w-3.5 h-3.5" /> Nuovo
                      </button>
                      <button onClick={() => setAperto(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-1 px-4 pt-3 flex-shrink-0">
                    {([['aperti', `Da fare (${lista?.length ?? 0})`], ['fatti', 'Fatti']] as const).map(([id, testo]) => (
                      <button key={id} onClick={() => setScheda(id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          scheda === id ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-hover'}`}>
                        {testo}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {scheda === 'aperti' ? (
                      lista === null ? <p className="text-sm text-text-muted">Carico…</p>
                        : lista.length === 0 ? (
                          <div className="text-center py-10 px-6">
                            <PhoneCall className="w-9 h-9 text-text-muted mx-auto mb-3" />
                            <p className="text-sm font-medium text-text-secondary">Nessuno da richiamare</p>
                            <p className="text-xs text-text-muted mt-1">
                              Quando qualcuna chiede un prezzo e ci pensa, segnala qui: torna a bussare da sola.
                            </p>
                          </div>
                        ) : lista.map(r => (
                          <Riga key={r.id} r={r} onChiudi={chiudi} onRicarica={carica} />
                        ))
                    ) : (
                      storico.length === 0 ? <p className="text-sm text-text-muted">Ancora niente.</p>
                        : storico.map(r => (
                          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-tertiary/40">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary truncate">{r.nome} {r.cognome}</p>
                              <p className="text-[11px] text-text-muted truncate">
                                {r.interesse} · {ESITI.find(e => e.id === r.esito)?.testo || r.esito}
                                {r.chiusoDa ? ` · ${r.chiusoDa}` : ''}
                              </p>
                            </div>
                            <button onClick={async () => { await riapriRichiamo(r.id); await carica(); }}
                              title="Rimettilo fra quelli da fare"
                              className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 flex-shrink-0">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Il promemoria che bussa da solo */}
          <AnimatePresence>
            {popup && !aperto && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => zittisci(popup.id)} />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="relative w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6 z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <PhoneCall className="w-5 h-5 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-display font-bold text-text-primary truncate">
                        {popup.nome} {popup.cognome}
                      </h3>
                      <p className="text-xs text-text-muted">da richiamare {quandoScritto(popup.prossimoTentativo)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-bg-tertiary/60 border border-border p-3">
                    <p className="text-sm text-text-primary">{popup.interesse}</p>
                    {popup.note && <p className="text-xs text-text-secondary mt-1">{popup.note}</p>}
                    {popup.tentativi > 0 && (
                      <p className="text-[11px] text-text-muted mt-1.5">
                        Già provato {popup.tentativi} {popup.tentativi === 1 ? 'volta' : 'volte'}
                      </p>
                    )}
                  </div>

                  <a href={`tel:${popup.telefono}`}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl gradient-accent text-white text-sm font-bold">
                    <Phone className="w-4 h-4" /> Chiama {popup.telefono}
                  </a>

                  <div className="grid grid-cols-2 gap-2">
                    {ESITI.map(e => (
                      <button key={e.id} onClick={() => void chiudi(popup.id, e.id)}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          e.id === 'prenotato'
                            ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                            : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                        {e.testo}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => zittisci(popup.id)}
                    className="w-full py-2 text-xs font-medium text-text-muted hover:text-text-primary">
                    Più tardi
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {nuovo && <ModuloNuovo onChiudi={() => setNuovo(false)} onFatto={async () => { setNuovo(false); await carica(); }} />}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
}

/* ============================================================
   Una riga dell'elenco.
   ============================================================ */
function Riga({ r, onChiudi, onRicarica }: {
  r: RigaRichiamo;
  onChiudi: (id: string, esito: EsitoRichiamo, nota?: string) => Promise<void>;
  onRicarica: () => Promise<void>;
}) {
  const [apri, setApri] = useState(false);
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      r.scaduto ? 'border-warning/40 bg-warning/[0.06]' : 'border-border bg-bg-tertiary/40'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary truncate">
            {r.nome} {r.cognome}
            {r.priorita === 'alta' && <span className="ml-1.5 text-[10px] font-bold text-error">urgente</span>}
          </p>
          <p className="text-xs text-text-secondary truncate">{r.interesse}</p>
          <p className={`text-[11px] mt-0.5 ${r.scaduto ? 'text-warning font-semibold' : 'text-text-muted'}`}>
            <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
            {r.scaduto ? 'da fare adesso' : `da richiamare ${quandoScritto(r.prossimoTentativo)}`}
            {r.tentativi > 0 ? ` · ${r.tentativi} tentativ${r.tentativi === 1 ? 'o' : 'i'}` : ''}
          </p>
        </div>
        <a href={`tel:${r.telefono}`} title={`Chiama ${r.telefono}`}
          className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 flex-shrink-0">
          <Phone className="w-4 h-4" />
        </a>
      </div>

      {r.note && <p className="text-[11px] text-text-muted">{r.note}</p>}

      {!apri ? (
        <div className="flex gap-2">
          <button onClick={() => setApri(true)}
            className="flex-1 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-text-secondary hover:bg-bg-hover">
            Com&apos;è andata?
          </button>
          <button onClick={async () => {
            await rimandaRichiamo(r.id, new Date(Date.now() + 3600_000).toISOString());
            await onRicarica();
          }}
            className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-medium text-text-muted hover:bg-bg-hover">
            Fra un&apos;ora
          </button>
          <button onClick={async () => {
            if (!confirm('Tolgo questo richiamo dalla lista?')) return;
            await eliminaRichiamo(r.id);
            await onRicarica();
          }}
            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {ESITI.map(e => (
            <button key={e.id} onClick={() => void onChiudi(r.id, e.id)}
              className={`py-1.5 rounded-lg text-[11px] font-semibold border ${
                e.id === 'prenotato'
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
              {e.testo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Il modulo: chi è, cosa vuole, quando la richiamo.
   ============================================================ */
function ModuloNuovo({ onChiudi, onFatto }: { onChiudi: () => void; onFatto: () => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [interesse, setInteresse] = useState('');
  const [note, setNote] = useState('');
  const [fascia, setFascia] = useState('qualsiasi');
  const [priorita, setPriorita] = useState('normale');
  const [ripeti, setRipeti] = useState(120);
  const [giorno, setGiorno] = useState(() => giornoIso(new Date()));
  const [ora, setOra] = useState('');
  const [errore, setErrore] = useState('');
  const [occupato, setOccupato] = useState(false);

  const oraDellaFascia = FASCE.find(f => f.id === fascia)?.ora || '09:30';
  const quando = istante(giorno, ora || oraDellaFascia);

  /*
    Le scorciatoie si calcolano una volta sola, all'apertura del modulo.

    «Fra due ore» letto durante il disegno della pagina darebbe un'ora diversa
    a ogni render — e sul server un'ora che non e' quella di qui.
  */
  const [scorciatoie] = useState<{ testo: string; giorno: string; ora?: string }[]>(() => [
    { testo: 'Fra due ore', giorno: giornoIso(new Date()), ora: new Date(Date.now() + 7200_000).toTimeString().slice(0, 5) },
    { testo: 'Domani', giorno: giornoIso(new Date(Date.now() + 86400_000)) },
    { testo: 'Lunedì', giorno: prossimoLunedi() },
  ]);

  const salva = async () => {
    setOccupato(true);
    setErrore('');
    try {
      const io = useAuthStore.getState().user;
      const r = await nuovoRichiamo({
        nome, cognome, telefono, interesse, note,
        quando, fascia, priorita, ripetiOgniMin: ripeti,
        creatoDa: [io?.firstName, io?.lastName].filter(Boolean).join(' ') || 'Staff',
      });
      if (!r.ok) { setErrore(r.errore || 'Non sono riuscito a salvarlo.'); return; }
      await onFatto();
    } catch {
      setErrore('Errore di rete: riprova.');
    } finally { setOccupato(false); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onChiudi} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-bg-secondary">
          <h3 className="text-base font-display font-semibold text-text-primary">Da richiamare</h3>
          <button onClick={onChiudi} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" autoComplete="off"
              className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
            <input value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Cognome" autoComplete="off"
              className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          </div>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Numero di telefono"
            type="tel" inputMode="tel" autoComplete="off"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          <input value={interesse} onChange={e => setInteresse(e.target.value)} autoComplete="off"
            placeholder="Cosa le interessa (es. laser gambe, pressoterapia)"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Note: cosa le hai detto, che prezzo le hai fatto…"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary resize-none" />

          {/* Quando richiamarla: le tre risposte che si danno davvero al banco. */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-1.5">Quando la richiamiamo</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scorciatoie.map(s => (
                <button key={s.testo} onClick={() => { setGiorno(s.giorno); setOra(s.ora || ''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    giorno === s.giorno ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                  {s.testo}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={giorno} onChange={e => setGiorno(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
              <input type="time" value={ora} onChange={e => setOra(e.target.value)} placeholder={oraDellaFascia}
                className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary mb-1.5">Quando preferisce essere chiamata</p>
            <div className="flex flex-wrap gap-1.5">
              {FASCE.map(f => (
                <button key={f.id} onClick={() => setFascia(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    fascia === f.id ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                  {f.testo}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              Senza un&apos;ora precisa, il promemoria arriva alle {oraDellaFascia}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-1.5">Priorità</p>
              <div className="flex gap-1.5">
                {(['normale', 'alta'] as const).map(p => (
                  <button key={p} onClick={() => setPriorita(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${
                      priorita === p ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                    {p === 'alta' ? 'Urgente' : 'Normale'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-1.5">Se non rispondo, ribussa</p>
              <select value={ripeti} onChange={e => setRipeti(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary">
                <option value={30}>fra mezz&apos;ora</option>
                <option value={120}>fra due ore</option>
                <option value={360}>fra sei ore</option>
                <option value={1440}>domani</option>
              </select>
            </div>
          </div>

          {errore && <p className="text-[11px] text-error">{errore}</p>}
          <p className="text-[11px] text-text-muted">
            Tornerà a bussare {quandoScritto(quando)}.
          </p>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onChiudi} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover">
            Annulla
          </button>
          <button onClick={() => void salva()} disabled={occupato || !telefono.trim() || !interesse.trim()}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-40">
            <Check className="w-4 h-4" /> {occupato ? 'Salvo…' : 'Mettilo in lista'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
