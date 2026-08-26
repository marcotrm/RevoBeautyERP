'use client';

/**
 * Chi ha comprato quel pacchetto, e a che punto è.
 *
 * Sui pacchetti la domanda non è quanto hanno reso: è chi ha pagato e non si
 * vede più. Un pacchetto venduto è un debito — soldi già in cassa e lavoro
 * ancora da fare — e la lista di chi ha sedute arretrate è la telefonata più
 * redditizia che si possa fare, prima che scada e diventi un reclamo.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Euro, AlertTriangle, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { storicoPacchetto, type StoricoPacchetto } from '@/app/actions/seduteTrattamento';
import { daSfondo } from '@/lib/chiusuraModale';
import { Numero, Blocco, Riga, giorno, mese } from './DettaglioTrattamento';

export default function DettaglioPacchetto({ nome, onClose }: { nome: string; onClose: () => void }) {
  const [dati, setDati] = useState<StoricoPacchetto | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    storicoPacchetto(nome)
      .then(d => { if (vivo) { setDati(d); setCaricando(false); } })
      .catch(() => { if (vivo) setCaricando(false); });
    return () => { vivo = false; };
  }, [nome]);

  return (
    <AnimatePresence>
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="fixed inset-0 z-[71] flex items-center justify-center sm:p-4"
          onClick={e => daSfondo(e) && onClose()}>
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-display font-semibold text-text-primary truncate">{nome}</h3>
                <p className="text-xs text-text-muted">
                  {dati && dati.venduti > 0 ? `Venduto dal ${giorno(dati.primaVolta || '')} al ${giorno(dati.ultimaVolta || '')}` : 'Tutti i pacchetti venduti'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {caricando && (
                <div className="flex flex-col items-center py-16 text-text-muted">
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Sto raccogliendo i pacchetti…</p>
                </div>
              )}

              {!caricando && dati && dati.venduti === 0 && (
                <p className="text-sm text-text-muted text-center py-16">Questo pacchetto non è mai stato venduto.</p>
              )}

              {!caricando && dati && dati.venduti > 0 && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Numero icona={Package} titolo="Venduti" valore={String(dati.venduti)} />
                    <Numero icona={Euro} titolo="Incassato" valore={formatCurrency(dati.incassato)} />
                    <Numero icona={AlertTriangle} titolo="Ancora da incassare" valore={formatCurrency(dati.daIncassare)}
                      nota={dati.daIncassare > 0 ? 'rate non saldate' : 'tutto pagato'} />
                    <Numero icona={Activity} titolo="Sedute da fare" valore={String(dati.seduteDaFare)}
                      nota={`usato al ${dati.usoPercento}%`} />
                  </div>

                  {dati.perMese.length > 1 && (
                    <Blocco titolo="Venduti mese per mese">
                      {dati.perMese.map(m => (
                        <Riga key={m.mese} sinistra={mese(m.mese)} destra={`${m.venduti}`} nota={formatCurrency(m.incassato)} />
                      ))}
                    </Blocco>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                      Chi l&apos;ha comprato, dal più recente
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-tertiary/40">
                          <tr>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Cliente</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Comprato</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-center">Sedute</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right hidden sm:table-cell">Pagato</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Scade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {dati.vendite.map((v, i) => {
                            const restano = v.totali - v.fatte;
                            return (
                              <tr key={i} className="hover:bg-bg-hover/50">
                                <td className="px-3 py-2 text-sm text-text-primary truncate max-w-[170px]">{v.cliente}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap">{giorno(v.acquistato)}</td>
                                <td className="px-3 py-2 text-sm text-center whitespace-nowrap">
                                  <span className={restano === 0 ? 'text-success' : restano >= v.totali ? 'text-error font-semibold' : 'text-text-primary'}>
                                    {v.fatte}/{v.totali}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-right tabular-nums hidden sm:table-cell whitespace-nowrap">
                                  {v.daIncassare > 0
                                    ? <span className="text-error font-semibold">deve {formatCurrency(v.daIncassare)}</span>
                                    : <span className="text-text-secondary">{formatCurrency(v.incassato)}</span>}
                                </td>
                                <td className="px-3 py-2 text-sm text-text-muted whitespace-nowrap">{giorno(v.scadenza)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">
                      In rosso chi non ha ancora fatto nessuna seduta e chi deve ancora dei soldi: sono le due
                      liste da cui partire per le telefonate.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
