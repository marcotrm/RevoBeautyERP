'use client';

/**
 * Gli abbonamenti, e quanto entra ogni mese senza fare niente.
 *
 * Il numero grande in alto e' il fatturato ricorrente: quello che entra il
 * mese prossimo se nessuno disdice. E' l'unico numero di questo gestionale
 * che si puo' guardare a inizio mese invece che alla fine.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, Loader2, Pause, Play, Plus, Repeat, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/helpers';
import { useClientStore } from '@/stores/useClientStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  cambiaStatoAbbonamento, creaAbbonamento, elencoAbbonamenti, eliminaAbbonamento,
  giroRinnovi, incassaRinnovo, riepilogoAbbonamenti,
  type Abbonamento, type RiepilogoAbbonamenti,
} from '@/app/actions/abbonamenti';

const METODI = ['Carta', 'Contanti', 'Satispay', 'Bonifico'] as const;

function NuovoAbbonamento({ onChiudi, onFatto }: { onChiudi: () => void; onFatto: () => void }) {
  const clients = useClientStore(s => s.clients);
  const fetchClients = useClientStore(s => s.fetchClients);
  useEffect(() => { fetchClients(); }, [fetchClients]);

  const [cerca, setCerca] = useState('');
  const [scelto, setScelto] = useState<{ id: string; nome: string } | null>(null);
  const [nome, setNome] = useState('');
  const [prezzo, setPrezzo] = useState('');
  const [sedute, setSedute] = useState('0');
  const [metodo, setMetodo] = useState<string>('Carta');
  const [incassaSubito, setIncassaSubito] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const trovati = cerca.trim()
    ? clients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(cerca.toLowerCase())).slice(0, 6)
    : [];

  const salva = async () => {
    if (!scelto || !nome.trim() || !Number(prezzo.replace(',', '.'))) return;
    setSalvando(true);
    try {
      const io = useAuthStore.getState().user;
      await creaAbbonamento({
        clientId: scelto.id,
        clientName: scelto.nome,
        nome: nome.trim(),
        prezzoMensile: Number(prezzo.replace(',', '.')),
        seduteAlMese: Number(sedute) || 0,
        incassaSubito,
        metodo,
        operatore: [io?.firstName, io?.lastName].filter(Boolean).join(' ') || 'Staff',
      });
      onFatto();
      onChiudi();
    } finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onChiudi}>
      <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-display font-semibold text-text-primary">Nuovo abbonamento</h3>
          <button onClick={onChiudi} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Cliente</label>
            {scelto ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/30">
                <span className="text-sm text-text-primary">{scelto.nome}</span>
                <button onClick={() => setScelto(null)} className="text-xs text-text-muted hover:text-text-primary">cambia</button>
              </div>
            ) : (
              <>
                <input type="text" value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca per nome"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
                {trovati.length > 0 && (
                  <div className="mt-1 rounded-xl border border-border overflow-hidden">
                    {trovati.map(c => (
                      <button key={c.id} onClick={() => { setScelto({ id: c.id, nome: `${c.firstName} ${c.lastName}`.trim() }); setCerca(''); }}
                        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-bg-hover">
                        {c.firstName} {c.lastName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Come si chiama</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Laser illimitato, Viso ogni mese"
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Quanto al mese</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={prezzo} onChange={e => setPrezzo(e.target.value)} placeholder="49,00"
                  className="w-full pl-3 pr-7 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Sedute comprese</label>
              <input type="text" inputMode="numeric" value={sedute} onChange={e => setSedute(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
              <p className="text-[10px] text-text-muted mt-1">0 = illimitate</p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={incassaSubito} onChange={e => setIncassaSubito(e.target.checked)} className="w-4 h-4 accent-accent" />
              <span className="text-sm text-text-primary">Il primo mese lo paga adesso</span>
            </label>
            {incassaSubito && (
              <div className="flex gap-2 mt-2">
                {METODI.map(m => (
                  <button key={m} onClick={() => setMetodo(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${metodo === m ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onChiudi} className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover">Annulla</button>
          <button onClick={salva} disabled={salvando || !scelto || !nome.trim() || !prezzo.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-40">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Attiva
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AbbonamentiPage() {
  const [lista, setLista] = useState<Abbonamento[] | null>(null);
  const [riepilogo, setRiepilogo] = useState<RiepilogoAbbonamenti | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [occupato, setOccupato] = useState('');
  const [versione, setVersione] = useState(0);
  const [avviso, setAvviso] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([elencoAbbonamenti(), riepilogoAbbonamenti()])
      .then(([l, r]) => { if (vivo) { setLista(l); setRiepilogo(r); } })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [versione]);

  const ricarica = useCallback(() => setVersione(v => v + 1), []);

  const azione = async (id: string, fn: () => Promise<unknown>) => {
    setOccupato(id);
    try { await fn(); ricarica(); } finally { setOccupato(''); }
  };

  const mandaPromemoria = async () => {
    setOccupato('giro');
    try {
      const r = await giroRinnovi(false);
      setAvviso(r.daChiedere === 0
        ? 'Nessun rinnovo in scadenza: non c’era niente da mandare.'
        : `${r.daChiedere} da rinnovare, ${r.avvisate} avvisate per email. L’elenco è su Telegram.`);
    } finally { setOccupato(''); }
  };

  const attivi = (lista || []).filter(a => a.stato === 'attivo');
  const altri = (lista || []).filter(a => a.stato !== 'attivo');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/packages" className="p-2 rounded-xl border border-border text-text-secondary hover:bg-bg-hover">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">Abbonamenti</h2>
            <p className="text-sm text-text-secondary">Quello che entra ogni mese senza dover rivendere niente</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={mandaPromemoria} disabled={occupato === 'giro'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover disabled:opacity-50">
            {occupato === 'giro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />} Promemoria rinnovi
          </button>
          <button onClick={() => setNuovo(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> Nuovo abbonamento
          </button>
        </div>
      </div>

      {avviso && <p className="text-sm text-text-secondary">{avviso}</p>}

      {riepilogo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Ogni mese, sicuri</p>
            <p className="text-2xl font-display font-bold text-accent mt-1">{formatCurrency(riepilogo.mensileRicorrente)}</p>
            <p className="text-xs text-text-muted mt-1">se non disdice nessuno</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Abbonate</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.attivi}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Scadono a giorni</p>
            <p className="text-2xl font-display font-bold text-warning mt-1">{riepilogo.inScadenza}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">In ritardo</p>
            <p className={`text-2xl font-display font-bold mt-1 ${riepilogo.inRitardo > 0 ? 'text-error' : 'text-text-primary'}`}>{riepilogo.inRitardo}</p>
            <p className="text-xs text-text-muted mt-1">da chiedere</p>
          </div>
        </div>
      )}

      {lista === null && <p className="text-sm text-text-muted text-center py-8">Carico…</p>}

      {lista !== null && lista.length === 0 && (
        <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
          <Repeat className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-primary font-medium">Nessun abbonamento, per ora</p>
          <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
            È la voce che rende prevedibile il fatturato: un prezzo al mese, sedute comprese, e a inizio mese
            sai già quanto entra. Funziona bene sul laser e sui trattamenti che si ripetono.
          </p>
          <button onClick={() => setNuovo(true)} className="mt-4 text-sm text-accent font-medium hover:underline">Attiva il primo</button>
        </div>
      )}

      <div className="space-y-2">
        {[...attivi, ...altri].map(a => {
          const ritardo = a.stato === 'attivo' && a.giorniAlRinnovo < 0;
          const vicino = a.stato === 'attivo' && a.giorniAlRinnovo >= 0 && a.giorniAlRinnovo <= 7;
          return (
            <div key={a.id} className={`bg-bg-secondary border rounded-2xl p-4 ${ritardo ? 'border-error/40' : vicino ? 'border-warning/40' : 'border-border'}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">{a.clientName}</p>
                    <span className="text-xs text-text-muted">·</span>
                    <p className="text-sm text-text-secondary">{a.nome}</p>
                    {a.stato !== 'attivo' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
                        {a.stato === 'sospeso' ? 'sospeso' : 'chiuso'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {formatCurrency(a.prezzoMensile)} al mese ·{' '}
                    {a.seduteAlMese === 0 ? 'sedute illimitate' : `${a.seduteUsate}/${a.seduteAlMese} sedute questo mese`} ·{' '}
                    da {a.mesiAttivo} {a.mesiAttivo === 1 ? 'mese' : 'mesi'} · ha portato {formatCurrency(a.incassatoTotale)}
                  </p>
                  {a.stato === 'attivo' && (
                    <p className={`text-[11px] mt-1 font-medium ${ritardo ? 'text-error' : vicino ? 'text-warning' : 'text-text-muted'}`}>
                      {ritardo && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                      {ritardo
                        ? `In ritardo di ${Math.abs(a.giorniAlRinnovo)} ${Math.abs(a.giorniAlRinnovo) === 1 ? 'giorno' : 'giorni'}`
                        : a.giorniAlRinnovo === 0 ? 'Si rinnova oggi'
                          : `Si rinnova fra ${a.giorniAlRinnovo} giorni (${a.prossimoRinnovo.split('-').reverse().join('/')})`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {a.stato === 'attivo' && (
                    <button disabled={occupato === a.id}
                      onClick={() => azione(a.id, () => {
                        const io = useAuthStore.getState().user;
                        return incassaRinnovo(a.id, { operatore: [io?.firstName, io?.lastName].filter(Boolean).join(' ') || 'Staff' });
                      })}
                      className="px-3 py-2 rounded-lg gradient-accent text-white text-xs font-semibold disabled:opacity-50">
                      {occupato === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Incassa ${formatCurrency(a.prezzoMensile)}`}
                    </button>
                  )}
                  <button disabled={occupato === a.id}
                    onClick={() => azione(a.id, () => cambiaStatoAbbonamento(a.id, a.stato === 'attivo' ? 'sospeso' : 'attivo'))}
                    className="p-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50"
                    title={a.stato === 'attivo' ? 'Sospendi' : 'Riattiva'}>
                    {a.stato === 'attivo' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button disabled={occupato === a.id}
                    onClick={() => { if (confirm(`Eliminare l’abbonamento di ${a.clientName}? Gli incassi già registrati restano in cassa.`)) azione(a.id, () => eliminaAbbonamento(a.id)); }}
                    className="p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/40 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted">
        Il rinnovo non è un addebito automatico: nessuna carta è salvata qui. Il gestionale dice chi scade, manda il
        promemoria per email e registra l’incasso quando i soldi arrivano. Ogni rinnovo incassato diventa una riga in cassa.
      </p>

      {nuovo && <NuovoAbbonamento onChiudi={() => setNuovo(false)} onFatto={ricarica} />}
    </motion.div>
  );
}
