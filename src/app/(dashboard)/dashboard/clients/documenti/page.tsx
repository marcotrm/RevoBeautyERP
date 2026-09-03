'use client';

/**
 * I documenti delle clienti, tutti in un posto.
 *
 * Prima il numero del documento finiva scritto su un foglio dentro un
 * raccoglitore, e quando serviva bisognava sfogliare. Qui si cerca per nome o
 * per numero e si vede la foto vera: la stessa che la cliente ha scattato
 * quando ha firmato il consenso.
 *
 * Sono dati sensibili. Stanno qui perche' servono al consenso e a nient'altro,
 * e si cancellano con un tasto quando non servono piu'.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, IdCard, Loader2, Search, Trash2 } from 'lucide-react';
import {
  elencoDocumenti, eliminaDocumento, fotoDocumento, riepilogoDocumenti,
  type DocumentoSalvato, type RiepilogoDocumenti,
} from '@/app/actions/documenti';

export default function DocumentiPage() {
  const [cerca, setCerca] = useState('');
  const [lista, setLista] = useState<DocumentoSalvato[] | null>(null);
  const [riepilogo, setRiepilogo] = useState<RiepilogoDocumenti | null>(null);
  const [aperta, setAperta] = useState<DocumentoSalvato | null>(null);
  /** La foto intera di quello aperto: si chiede solo adesso, pesa. */
  const [fotoIntera, setFotoIntera] = useState<string>('');
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      elencoDocumenti(cerca)
        .then(l => { if (vivo) setLista(l); })
        .catch(() => { if (vivo) setLista([]); });
    }, cerca ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [cerca, versione]);

  useEffect(() => {
    let vivo = true;
    riepilogoDocumenti().then(r => { if (vivo) setRiepilogo(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [versione]);

  const ricarica = useCallback(() => setVersione(v => v + 1), []);

  const elimina = async (d: DocumentoSalvato) => {
    if (!confirm(`Eliminare il documento di ${d.clientName}? La foto viene cancellata per sempre.`)) return;
    await eliminaDocumento(d.id);
    setAperta(null);
    ricarica();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/clients" className="p-2 rounded-xl border border-border text-text-secondary hover:bg-bg-hover">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Documenti delle clienti</h2>
          <p className="text-sm text-text-secondary">Quelli fotografati quando hanno firmato il consenso</p>
        </div>
      </div>

      {riepilogo && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Documenti</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.totale}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Clienti coperte</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{riepilogo.clientiConDocumento}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <p className="text-sm text-text-secondary">Scaduti</p>
            <p className={`text-2xl font-display font-bold mt-1 ${riepilogo.scaduti > 0 ? 'text-warning' : 'text-text-primary'}`}>
              {riepilogo.scaduti}
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input type="text" value={cerca} onChange={e => setCerca(e.target.value)}
          placeholder="Cerca per nome, cognome o numero del documento"
          className="w-full pl-10 pr-3 py-3 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
      </div>

      {lista === null && (
        <p className="flex items-center justify-center gap-2 text-sm text-text-muted py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Carico…
        </p>
      )}

      {lista !== null && lista.length === 0 && (
        <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
          <IdCard className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-primary font-medium">
            {cerca ? 'Nessun documento trovato' : 'Ancora nessun documento'}
          </p>
          <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
            {cerca
              ? 'Prova con un pezzo del cognome o con il numero.'
              : 'Si riempie da solo: ogni cliente che firma il consenso fotografa il documento, e la foto finisce qui.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(lista || []).map(d => (
          <button key={d.id} onClick={() => { setAperta(d); setFotoIntera(''); fotoDocumento(d.id).then(f => setFotoIntera(f || d.anteprima)).catch(() => setFotoIntera(d.anteprima)); }}
            className="text-left bg-bg-secondary border border-border rounded-2xl overflow-hidden hover:border-accent/40 transition-colors">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.anteprima} alt={`Documento di ${d.clientName}`} className="w-full h-36 object-cover bg-white" />
            <div className="p-3.5">
              <p className="text-sm font-semibold text-text-primary truncate">{d.clientName || `${d.nome ?? ''} ${d.cognome ?? ''}`.trim()}</p>
              <p className="text-[11px] text-text-muted truncate">{d.tipoLeggibile} n. {d.numero}</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {new Date(d.createdAt).toLocaleDateString('it-IT')}
                {d.origine === 'operatrice' ? ' · caricato dal banco' : ''}
                {d.scaduto ? ' · scaduto' : ''}
              </p>
            </div>
          </button>
        ))}
      </div>

      {aperta && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAperta(null)}>
          <div className="w-full max-w-xl bg-bg-secondary border border-border rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoIntera || aperta.anteprima} alt="Documento" className="w-full max-h-[60vh] object-contain bg-white" />
            <div className="p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-text-primary">{aperta.clientName}</p>
                  <p className="text-sm text-text-secondary">{aperta.tipoLeggibile} n. <strong className="text-text-primary">{aperta.numero}</strong></p>
                  <p className="text-xs text-text-muted mt-1">
                    {[aperta.nome, aperta.cognome].filter(Boolean).join(' ')}
                    {aperta.dataNascita ? ` · nata il ${aperta.dataNascita.split('-').reverse().join('/')}` : ''}
                    {aperta.scadenza ? ` · scade il ${aperta.scadenza.split('-').reverse().join('/')}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/dashboard/clients/${aperta.clientId}`}
                    className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">
                    Apri la scheda
                  </Link>
                  <button onClick={() => elimina(aperta)}
                    className="p-2 rounded-xl border border-border text-text-muted hover:text-error hover:border-error/40">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {aperta.scaduto && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" /> Questo documento è scaduto: alla prossima seduta chiedine uno nuovo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        Sono dati sensibili: stanno qui perché servono al consenso, si vedono solo da dentro il gestionale e si
        cancellano con un tasto quando non servono più.
      </p>
    </motion.div>
  );
}
