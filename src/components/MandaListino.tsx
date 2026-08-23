'use client';

/**
 * "Quanto viene la pulizia viso?" — il listino sul suo telefono.
 *
 * Due strade, perché al banco succedono due cose diverse: se la cliente ha
 * scritto di recente su WhatsApp le si manda il link e ce l'ha per sempre; se
 * no — ed è il caso più frequente — le si fa inquadrare il QR, che non chiede
 * permesso a Meta e funziona anche con chi in rubrica non c'è.
 *
 * In tutti e due i casi arriva un link, non un foglio: il giorno che si alza
 * un prezzo, quello che ha in mano lei cambia da solo.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, X, Send, Check, Copy, QrCode } from 'lucide-react';
import { mandaListino, urlListino, statoTemplateListino, creaTemplateListino } from '@/app/actions/listino';

export default function MandaListino({ phone, nome, className = '' }: {
  phone?: string | null; nome?: string; className?: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [link, setLink] = useState('');
  const [copiato, setCopiato] = useState(false);
  /*
    Lo stato del template su Meta.

    Serve perché la differenza fra "glielo mando" e "non posso" non dipende da
    noi: dentro le 24 ore da un suo messaggio si scrive libero, fuori serve un
    template approvato. Chi sta al banco deve saperlo prima di premere, non
    dopo un errore.
  */
  const [tpl, setTpl] = useState<string>('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    urlListino().then(setLink).catch(() => {});
    statoTemplateListino().then(r => setTpl(r.stato)).catch(() => {});
  }, [aperto]);

  const manda = async () => {
    if (!phone) return;
    setInviando(true);
    setEsito(null);
    const r = await mandaListino({ phone, nome }).catch(() => ({ ok: false, error: 'Invio fallito' }));
    setInviando(false);
    setEsito({
      ok: Boolean(r.ok),
      testo: r.ok ? 'Listino mandato su WhatsApp.' : (('error' in r && r.error) || 'Invio fallito'),
    });
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch { /* no-op: resta il QR */ }
  };

  return (
    <>
      <button type="button" onClick={() => { setAperto(true); setEsito(null); }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors ${className}`}>
        <Receipt className="w-3.5 h-3.5" /> Manda il listino
      </button>

      <AnimatePresence>
        {aperto && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setAperto(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="fixed inset-0 z-[81] flex items-center justify-center p-4"
              onClick={e => e.target === e.currentTarget && setAperto(false)}>
              <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-base font-display font-semibold text-text-primary">Manda il listino</h3>
                  <button onClick={() => setAperto(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {phone && (
                    <div>
                      <button onClick={manda} disabled={inviando}
                        className="w-full py-3 rounded-xl gradient-accent text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        <Send className="w-4 h-4" /> {inviando ? 'Sto mandando…' : `Manda su WhatsApp al ${phone}`}
                      </button>
                      {esito && (
                        <p className={`text-[11px] mt-2 ${esito.ok ? 'text-success' : 'text-error'}`}>
                          {esito.ok ? <><Check className="w-3 h-3 inline mr-1" />{esito.testo}</> : esito.testo}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Il template: serve solo con chi non ha scritto di recente. */}
                  {tpl && tpl !== 'APPROVED' && (
                    <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/25">
                      <p className="text-[11px] text-warning font-semibold">
                        {tpl === 'ASSENTE'
                          ? 'Con chi non ha scritto nelle ultime 24 ore serve un messaggio approvato da Meta, e non c\u2019\u00e8 ancora.'
                          : `Il messaggio approvato da Meta \u00e8 ancora in attesa (${tpl.toLowerCase()}).`}
                      </p>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        Intanto funziona il QR qui sotto, che non chiede permesso a nessuno.
                      </p>
                      {tpl === 'ASSENTE' && (
                        <button onClick={async () => {
                          setCreando(true);
                          const r = await creaTemplateListino().catch(() => ({ ok: false }));
                          setCreando(false);
                          if ('stato' in r && r.stato) setTpl(String(r.stato).toUpperCase());
                        }} disabled={creando}
                          className="mt-2 px-2.5 py-1 rounded-lg bg-warning text-white text-[11px] font-bold disabled:opacity-50">
                          {creando ? 'Mando\u2026' : 'Mandalo in approvazione a Meta'}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-1 border-t border-border/60">
                    <p className="text-[11px] text-text-muted mb-2 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" /> Oppure faglielo inquadrare: funziona sempre, anche senza WhatsApp.
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/listino/qr" alt="QR del listino"
                      className="w-44 h-44 mx-auto rounded-xl bg-white p-2" />
                  </div>

                  {link && (
                    <button onClick={copia}
                      className="w-full py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover flex items-center justify-center gap-2">
                      <Copy className="w-3.5 h-3.5" /> {copiato ? 'Link copiato' : link.replace(/^https?:\/\//, '')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
