'use client';

/**
 * "Ha speso 100 €" — e come ci è arrivata?
 *
 * Nella classifica quella cifra non dice niente da sola: tre visite da trenta
 * o una sola da cento sono due clienti diverse — la prima è un'abitudine, la
 * seconda un episodio. E per capirlo bisognava aprire la scheda e mettersi a
 * sommare a mano.
 *
 * Qui c'è l'estratto conto: ogni passaggio in cassa con la data, cosa ha
 * preso, come ha pagato, e la somma che cresce riga dopo riga fino al totale
 * che si legge in classifica. Il progressivo serve proprio a questo: si segue
 * la colonna e si vede da dove viene la cifra.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { X, Euro, Receipt, CalendarCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { contoCliente, type ContoCliente } from '@/app/actions/seduteTrattamento';
import { daSfondo } from '@/lib/chiusuraModale';
import { Numero, Blocco, Riga, giorno } from './DettaglioTrattamento';

export default function DettaglioCliente({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [dati, setDati] = useState<ContoCliente | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const avvio = setTimeout(() => {
      contoCliente(clientId)
        .then(d => { if (vivo) { setDati(d); setCaricando(false); } })
        .catch(() => { if (vivo) setCaricando(false); });
    }, 0);
    return () => { vivo = false; clearTimeout(avvio); };
  }, [clientId]);

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
                <h3 className="text-lg font-display font-semibold text-text-primary truncate">
                  {dati?.nome || 'Cliente'}
                </h3>
                <p className="text-xs text-text-muted">
                  {dati && dati.scontrini > 0
                    ? `Dal ${giorno(dati.primaVolta || '')} a oggi · ${dati.telefono || ''}`
                    : dati?.telefono || ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link href={`/dashboard/clients/${clientId}`}
                  className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary" title="Apri la scheda completa">
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {caricando && (
                <div className="flex flex-col items-center py-16 text-text-muted">
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Sto rifacendo il conto…</p>
                </div>
              )}

              {!caricando && dati && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Numero icona={Euro} titolo="Ha speso in tutto" valore={formatCurrency(dati.totale)}
                      nota={`${dati.scontrini} ${dati.scontrini === 1 ? 'passaggio in cassa' : 'passaggi in cassa'}`} />
                    <Numero icona={Receipt} titolo="Scontrino medio" valore={formatCurrency(dati.scontrinoMedio)} />
                    <Numero icona={CalendarCheck} titolo="Visite" valore={String(dati.visite)}
                      nota="giornate con un trattamento fatto" />
                    <Numero icona={AlertTriangle} titolo="Deve ancora dare"
                      valore={formatCurrency(dati.daIncassare)}
                      nota={dati.seduteDaFare > 0 ? `${dati.seduteDaFare} sedute già pagate da fare` : 'nessuna rata aperta'} />
                  </div>

                  {dati.scontrini === 0 && (
                    <p className="text-sm text-text-muted text-center py-8">
                      Non risulta nessun passaggio in cassa a suo nome. Se ha fatto trattamenti, sono stati
                      incassati sotto un altro nome o non sono mai stati battuti.
                    </p>
                  )}

                  {dati.visite2.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Ogni volta che è venuta — dalla più recente
                      </p>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] text-left border-collapse">
                            <thead className="bg-bg-tertiary/40">
                              <tr>
                                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Quando</th>
                                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Cosa ha fatto</th>
                                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Con chi</th>
                                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right">Speso</th>
                                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right hidden sm:table-cell">Totale</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {dati.visite2.map((v, i) => (
                                <tr key={i} className="hover:bg-bg-hover/50 align-top">
                                  <td className="px-3 py-2 text-sm text-text-primary whitespace-nowrap">
                                    {giorno(v.data)} <span className="text-text-muted">{v.ora}</span>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-text-secondary">
                                    {v.trattamenti.length > 0
                                      ? v.trattamenti.map((t, k) => (
                                          <span key={k} className="block truncate max-w-[220px]">{t.nome}</span>
                                        ))
                                      : <span className="text-text-muted italic">solo passaggio in cassa</span>}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-text-secondary">
                                    {v.trattamenti.length > 0
                                      ? v.trattamenti.map((t, k) => (
                                          <span key={k} className="block truncate max-w-[150px]">{t.operatrice}</span>
                                        ))
                                      : <span className="text-text-muted">—</span>}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-right tabular-nums whitespace-nowrap">
                                    {/* Zero non vuol dire gratis: quel giorno non è
                                        passata in cassa (pacchetto, omaggio, o non
                                        incassato). Scriverlo evita la domanda. */}
                                    {v.senzaIncasso
                                      ? <span className="text-[11px] text-accent">niente in cassa</span>
                                      : <span className="font-semibold text-text-primary">{formatCurrency(v.speso)}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-accent text-right tabular-nums hidden sm:table-cell">
                                    {formatCurrency(v.progressivo)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-bg-tertiary/40 border-t border-border">
                                <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-text-primary">
                                  {dati.visite2.length} {dati.visite2.length === 1 ? 'volta' : 'volte'} · totale speso
                                </td>
                                <td colSpan={2} className="px-3 py-2 text-sm font-bold text-accent text-right tabular-nums">
                                  {formatCurrency(dati.totale)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                      <p className="text-[10px] text-text-muted mt-2">
                        La colonna <b>Totale</b> è la somma che cresce riga dopo riga: l&apos;ultima in basso è la prima
                        volta che è venuta, quella in alto è la cifra che leggi in classifica. Dove c&apos;è scritto
                        &laquo;niente in cassa&raquo; la seduta è stata scalata da un pacchetto, era omaggio, o non è
                        stata incassata.
                      </p>
                    </div>
                  )}

                  {dati.perTrattamento.length > 0 && (
                    <Blocco titolo="Cosa fa, e quanto vale">
                      {dati.perTrattamento.slice(0, 12).map(t => (
                        <Riga key={t.nome} sinistra={t.nome}
                          destra={`${t.volte} ${t.volte === 1 ? 'volta' : 'volte'}`}
                          nota={formatCurrency(t.spesa)} />
                      ))}
                    </Blocco>
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
