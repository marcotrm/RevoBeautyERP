'use client';

/**
 * "Crema antirughe, 56 €" — venduta a chi, e quando?
 *
 * Sul magazzino la domanda è un'altra rispetto ai trattamenti: non chi l'ha
 * fatta, ma se gira. Un prodotto con due pezzi venduti in un anno e cinque a
 * scaffale sono soldi fermi, e finché non si vede la data dell'ultima vendita
 * non lo sa nessuno.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Euro, Users, Boxes } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { storicoProdotto, type StoricoProdotto } from '@/app/actions/seduteTrattamento';
import { daSfondo } from '@/lib/chiusuraModale';
import { Numero, Blocco, Riga, giorno, mese } from './DettaglioTrattamento';

export default function DettaglioProdotto({ nome, onClose }: { nome: string; onClose: () => void }) {
  const [dati, setDati] = useState<StoricoProdotto | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    storicoProdotto(nome)
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
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-display font-semibold text-text-primary truncate">{dati?.nome || nome}</h3>
                <p className="text-xs text-text-muted">
                  {dati && dati.pezzi > 0
                    ? `Ultimi 12 mesi · dal ${giorno(dati.primaVolta || '')} al ${giorno(dati.ultimaVolta || '')}`
                    : 'Ultimi 12 mesi'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {caricando && (
                <div className="flex flex-col items-center py-16 text-text-muted">
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Sto cercando le vendite…</p>
                </div>
              )}

              {!caricando && dati && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Numero icona={Package} titolo="Pezzi venduti" valore={String(dati.pezzi)} />
                    <Numero icona={Euro} titolo="Incassato" valore={formatCurrency(dati.incasso)} />
                    <Numero icona={Boxes} titolo="A scaffale" valore={dati.giacenza !== null ? String(dati.giacenza) : '—'}
                      nota={dati.prezzo !== null ? `${formatCurrency(dati.prezzo)} al pezzo` : undefined} />
                    <Numero icona={Users} titolo="Clienti diverse" valore={String(dati.clientiDiverse)} />
                  </div>

                  {dati.pezzi === 0 && (
                    <p className="text-sm text-text-muted text-center py-8">
                      Negli ultimi dodici mesi non è stato venduto nemmeno un pezzo.
                      {dati.giacenza ? ` A scaffale però ce ne sono ${dati.giacenza}: sono soldi fermi.` : ''}
                    </p>
                  )}

                  {dati.perMese.length > 1 && (
                    <Blocco titolo="Mese per mese">
                      {dati.perMese.map(m => (
                        <Riga key={m.mese} sinistra={mese(m.mese)} destra={`${m.pezzi} pz`} nota={formatCurrency(m.incasso)} />
                      ))}
                    </Blocco>
                  )}

                  {dati.vendite.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Tutte le vendite, dalla più recente
                      </p>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-bg-tertiary/40">
                            <tr>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Giorno</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Cliente</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase hidden sm:table-cell">Pagato con</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right">Pezzi</th>
                              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right">Incasso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {dati.vendite.map((v, i) => (
                              <tr key={i} className="hover:bg-bg-hover/50">
                                <td className="px-3 py-2 text-sm text-text-primary whitespace-nowrap">
                                  {giorno(v.data)} <span className="text-text-muted">{v.ora}</span>
                                </td>
                                <td className="px-3 py-2 text-sm text-text-primary truncate max-w-[160px]">{v.cliente}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary hidden sm:table-cell">{v.metodo}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary text-right tabular-nums">{v.quantita}</td>
                                <td className="px-3 py-2 text-sm font-semibold text-text-primary text-right tabular-nums">{formatCurrency(v.incasso)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-text-muted mt-2">
                        L&apos;incasso è calcolato al prezzo di listino di adesso: se il prezzo è cambiato dopo la
                        vendita, la cifra vera dello scontrino può essere un po&apos; diversa.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
