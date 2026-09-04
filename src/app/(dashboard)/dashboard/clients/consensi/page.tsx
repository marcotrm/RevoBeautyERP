'use client';

/**
 * I consensi firmati, tutti insieme.
 *
 * Finora un consenso si poteva guardare solo aprendo la scheda di quella
 * cliente: per sapere chi ce l'aveva e chi no bisognava aprirle una per una,
 * quattrocento volte. Cosi' non lo sapeva nessuno.
 *
 * La domanda che conta pero' non e' «chi ha firmato»: e' il suo contrario, ed
 * e' il riquadro rosso in cima — chi ha fatto una seduta laser senza aver
 * firmato niente. Sta prima di tutto perche' e' l'unica parte di questa
 * pagina su cui c'e' qualcosa da fare.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, FileCheck, IdCard, Loader2, PenLine, Search } from 'lucide-react';
import {
  consensoPerId, elencoConsensi, riepilogoConsensi,
  type ConsensoInElenco, type RiepilogoConsensi,
} from '@/app/actions/consensi';
import DettaglioConsenso, { type ConsensoDaVedere } from '../[id]/DettaglioConsenso';

export default function ConsensiPage() {
  const [cerca, setCerca] = useState('');
  const [lista, setLista] = useState<ConsensoInElenco[] | null>(null);
  const [riepilogo, setRiepilogo] = useState<RiepilogoConsensi | null>(null);
  const [aperto, setAperto] = useState<{ consenso: ConsensoDaVedere; clientId: string; cliente: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    riepilogoConsensi().then(r => { if (vivo) setRiepilogo(r); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  // La ricerca aspetta che si smetta di scrivere: una chiamata per lettera su
  // cinquecento consensi non serve a nessuno.
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      elencoConsensi(cerca).then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista([]); });
    }, cerca ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [cerca]);

  const apri = useCallback(async (id: string) => {
    const c = await consensoPerId(id).catch(() => null);
    if (!c) return;
    setAperto({
      clientId: c.clientId,
      cliente: c.cliente,
      consenso: {
        id: c.id, title: c.title, signedAt: c.signedAt,
        notes: c.notes, signatureData: c.signatureData, data: c.data,
      },
    });
  }, []);

  const data = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-2 rounded-xl border border-border text-text-secondary hover:bg-bg-hover">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">Consensi firmati</h2>
            <p className="text-sm text-text-secondary">Chi ha firmato, cosa ha dichiarato, e chi non ha firmato affatto</p>
          </div>
        </div>
        <Link href="/dashboard/clients/documenti"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-all">
          <IdCard className="w-4 h-4" /> Documenti
        </Link>
      </div>

      {riepilogo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Consensi firmati</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.totale}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Clienti che ne hanno uno</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.clientiConConsenso}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Con documento allegato</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.conDocumento}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Con qualcosa da guardare</p>
            <p className={`text-2xl font-display font-bold mt-1 ${riepilogo.daGuardare > 0 ? 'text-warning' : 'text-text-primary'}`}>
              {riepilogo.daGuardare}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">farmaci, herpes, cure ormonali</p>
          </div>
        </div>
      )}

      {/*
        Il pezzo che conta: chi il laser l'ha gia' fatto senza firmare niente.
        Sta in cima perche' e' l'unica parte di questa pagina su cui c'e'
        qualcosa da fare — chiamarla, e farglielo firmare la prossima volta.
      */}
      {riepilogo && riepilogo.senzaConsenso.length > 0 && (
        <div className="bg-error/5 border-2 border-error/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-error" />
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">
                {riepilogo.senzaConsenso.length === 1
                  ? 'Una cliente ha fatto il laser senza consenso firmato'
                  : `${riepilogo.senzaConsenso.length} clienti hanno fatto il laser senza consenso firmato`}
              </h3>
              <p className="text-xs text-text-secondary">Ultimi sei mesi. Alla prossima seduta, prima il modulo.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {riepilogo.senzaConsenso.map(s => (
              <Link key={s.clientId} href={`/dashboard/clients/${s.clientId}`}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-bg-secondary hover:border-error/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{s.cliente}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {s.quando.slice(0, 10).split('-').reverse().join('/')} · {s.trattamento} · {s.operatrice}
                  </p>
                </div>
                <span className="text-[11px] text-error font-semibold flex-shrink-0">apri la scheda →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input type="text" value={cerca} onChange={e => setCerca(e.target.value)}
          placeholder="Cerca per nome della cliente"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
      </div>

      {lista === null ? (
        <p className="flex items-center justify-center gap-2 text-sm text-text-muted py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carico…
        </p>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
          <PenLine className="w-9 h-9 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            {cerca ? 'Nessun consenso per questo nome.' : 'Nessun consenso firmato, per ora.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(c => (
            <button key={c.id} onClick={() => apri(c.id)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-bg-secondary border border-border hover:border-accent/40 transition-colors text-left">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                c.daGuardare.length > 0 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
                {c.daGuardare.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-text-primary truncate">{c.cliente}</p>
                  {c.laser && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent">laser</span>}
                  {c.conDocumento && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">documento</span>}
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  {data(c.quando)}{c.zone ? ` · ${c.zone}` : ''}
                </p>
                {c.daGuardare.length > 0 && (
                  <p className="text-[11px] text-warning mt-0.5 truncate">
                    Da guardare: {c.daGuardare.join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-text-muted flex-shrink-0">apri</span>
            </button>
          ))}
        </div>
      )}

      {aperto && (
        <DettaglioConsenso
          consenso={aperto.consenso}
          clientId={aperto.clientId}
          nomeCliente={aperto.cliente}
          onChiudi={() => setAperto(null)}
        />
      )}
    </motion.div>
  );
}
