'use client';

/**
 * "Epilazione laser Total Body, 2 volte" — e quando?
 *
 * Le classifiche dicono quanto e quante volte, ma la domanda che viene subito
 * dopo è sempre la stessa: quando l'abbiamo fatto, a chi, con chi. Finora
 * bisognava cercarle in agenda una per una sapendo già dove guardare — cioè
 * non si faceva, e il numero restava una curiosità.
 *
 * Qui si preme la riga e c'è tutto: ogni seduta con data, ora, cliente,
 * operatrice e prezzo, più chi lo fa più spesso e quali clienti tornano.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Users, Euro, Repeat } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { storicoTrattamento, type StoricoTrattamento } from '@/app/actions/seduteTrattamento';
import { daSfondo } from '@/lib/chiusuraModale';

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function giorno(ymd: string): string {
  const [a, m, g] = (ymd || '').split('-');
  return a && m && g ? `${g}/${m}/${a.slice(2)}` : ymd;
}

export function mese(chiave: string): string {
  const [a, m] = chiave.split('-');
  return `${MESI[Number(m) - 1]} ${a.slice(2)}`;
}

export default function DettaglioTrattamento({ nome, onClose }: { nome: string; onClose: () => void }) {
  const [dati, setDati] = useState<StoricoTrattamento | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    let vivo = true;
    storicoTrattamento(nome)
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
                  {dati ? `Ultimi 12 mesi · dal ${giorno(dati.primaVolta || '')} al ${giorno(dati.ultimaVolta || '')}` : 'Sto cercando…'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {caricando && (
                <div className="flex flex-col items-center py-16 text-text-muted">
                  <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm">Sto raccogliendo le sedute…</p>
                </div>
              )}

              {!caricando && dati && dati.volte === 0 && (
                <p className="text-sm text-text-muted text-center py-16">
                  Negli ultimi dodici mesi non risulta fatto nemmeno una volta.
                </p>
              )}

              {!caricando && dati && dati.volte > 0 && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Numero icona={Repeat} titolo="Volte" valore={String(dati.volte)} />
                    <Numero icona={Euro} titolo="Incassato" valore={formatCurrency(dati.incasso)} />
                    <Numero icona={Euro} titolo="Prezzo medio" valore={formatCurrency(dati.prezzoMedio)} nota="sulle sedute pagate" />
                    <Numero icona={Users} titolo="Clienti diverse" valore={String(dati.clientiDiverse)} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Blocco titolo="Chi lo fa">
                      {dati.perOperatrice.map(o => (
                        <Riga key={o.nome} sinistra={o.nome} destra={`${o.volte} ${o.volte === 1 ? 'volta' : 'volte'}`} nota={formatCurrency(o.incasso)} />
                      ))}
                    </Blocco>
                    <Blocco titolo="Chi lo fa più spesso">
                      {dati.topClienti.map(c => (
                        <Riga key={c.nome} sinistra={c.nome} destra={`${c.volte} ${c.volte === 1 ? 'volta' : 'volte'}`} nota={formatCurrency(c.spesa)} />
                      ))}
                    </Blocco>
                  </div>

                  {dati.perMese.length > 1 && (
                    <Blocco titolo="Mese per mese">
                      {dati.perMese.map(m => (
                        <Riga key={m.mese} sinistra={mese(m.mese)} destra={`${m.volte} ${m.volte === 1 ? 'volta' : 'volte'}`} nota={formatCurrency(m.incasso)} />
                      ))}
                    </Blocco>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Tutte le volte, dalla più recente
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-tertiary/40">
                          <tr>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Giorno</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase">Cliente</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase hidden sm:table-cell">Chi l&apos;ha fatto</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase text-right">Prezzo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {dati.sedute.map((s, i) => (
                            <tr key={`${s.appointmentId}-${i}`} className="hover:bg-bg-hover/50">
                              <td className="px-3 py-2 text-sm text-text-primary whitespace-nowrap">
                                {giorno(s.data)} <span className="text-text-muted">{s.ora}</span>
                              </td>
                              <td className="px-3 py-2 text-sm text-text-primary truncate max-w-[180px]">{s.cliente}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary hidden sm:table-cell truncate">{s.operatrice}</td>
                              <td className="px-3 py-2 text-sm text-right tabular-nums whitespace-nowrap">
                                {s.daPacchetto
                                  ? <span className="text-accent text-[11px] font-semibold">da pacchetto</span>
                                  : <span className="font-semibold text-text-primary">{formatCurrency(s.prezzo)}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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

export function Numero({ icona: Icona, titolo, valore, nota }: {
  icona: React.ComponentType<{ className?: string }>; titolo: string; valore: string; nota?: string;
}) {
  return (
    <div className="rounded-xl bg-bg-tertiary/40 border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1">
        <Icona className="w-3 h-3" /> {titolo}
      </p>
      <p className="text-lg font-display font-bold text-text-primary mt-0.5 tabular-nums">{valore}</p>
      {nota && <p className="text-[10px] text-text-muted">{nota}</p>}
    </div>
  );
}

export function Blocco({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">{titolo}</p>
      <div className="rounded-xl border border-border divide-y divide-border/40 max-h-52 overflow-y-auto">{children}</div>
    </div>
  );
}

export function Riga({ sinistra, destra, nota }: { sinistra: string; destra: string; nota?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="text-sm text-text-primary truncate">{sinistra}</span>
      <span className="text-xs text-text-secondary flex-shrink-0">
        {destra}{nota ? <span className="text-text-muted"> · {nota}</span> : null}
      </span>
    </div>
  );
}
