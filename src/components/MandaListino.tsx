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
import { daSfondo } from '@/lib/chiusuraModale';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, X, Send, Check, Copy, QrCode } from 'lucide-react';
import { mandaListino, urlListino, statoTemplateListino, creaTemplateListino, type VistaListino } from '@/app/actions/listino';
import { useClientStore } from '@/stores/useClientStore';

export default function MandaListino({ phone, nome, className = '', soloIcona = false, chiediNumero = false }: {
  phone?: string | null; nome?: string; className?: string;
  /** Solo l'icona, per le barre strette dove non c'è posto per la scritta. */
  soloIcona?: boolean;
  /**
   * Il numero lo si scrive lì per lì.
   *
   * Al banco arriva anche chi in rubrica non c'è: chiede il listino, detta il
   * numero e se ne va. Senza questa strada bisognava prima crearle la scheda —
   * cioè chiederle dei dati che non voleva dare — per mandarle un link.
   */
  chiediNumero?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  /*
    Cosa si manda: tutto, solo i trattamenti o solo i pacchetti.

    Chi chiede "quanto viene la ceretta" non deve scorrere quindici pacchetti,
    e a chi si sta convincendo del pacchetto i prezzi singoli non servono.
  */
  const [vista, setVista] = useState<VistaListino>('tutto');
  const [numero, setNumero] = useState('');
  const [nomeScritto, setNomeScritto] = useState('');
  /*
    Chi è già in rubrica non si ribatte.

    Il numero a mano serve per chi cliente non è ancora; per tutte le altre
    è tempo perso al banco e un rischio in più di sbagliare una cifra.
  */
  const [cercaCliente, setCercaCliente] = useState('');
  const clienti = useClientStore(s => s.clients);
  const caricaClienti = useClientStore(s => s.fetchClients);
  const trovati = React.useMemo(() => {
    const q = cercaCliente.trim().toLowerCase();
    if (!q) return [];
    const cifre = q.replace(/\D/g, '');
    return clienti
      .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        || (cifre.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(cifre)))
      .slice(0, 6);
  }, [cercaCliente, clienti]);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string; avviso?: boolean } | null>(null);
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
    // La rubrica può non essere ancora in memoria: nella pagina WhatsApp
    // nessuno l'ha chiesta, e senza clienti la ricerca sembrerebbe rotta.
    if (clienti.length === 0) caricaClienti().catch(() => {});
    urlListino().then(setLink).catch(() => {});
    statoTemplateListino().then(r => setTpl(r.stato)).catch(() => {});
  }, [aperto]);

  // Il numero: quello della scheda, o quello appena scritto a mano.
  const numeroDaUsare = (phone || numero).replace(/[^\d+]/g, '');
  const pronto = numeroDaUsare.replace(/\D/g, '').length >= 9;

  const manda = async () => {
    if (!pronto) return;
    setInviando(true);
    setEsito(null);
    const r = await mandaListino({ phone: numeroDaUsare, nome: nome || nomeScritto, vista })
      .catch(() => ({ ok: false, error: 'Invio fallito' }));
    setInviando(false);
    /*
      Riuscito ma con un avvertimento: fuori dalle 24 ore il messaggio
      approvato porta a tutto il listino, quindi la scelta "solo pacchetti"
      non arriva. Meglio dirlo che lasciar credere il contrario.
    */
    const avviso = r.ok && 'error' in r && r.error ? r.error : null;
    setEsito({
      ok: Boolean(r.ok),
      avviso: Boolean(avviso),
      testo: avviso || (r.ok ? 'Listino mandato su WhatsApp.' : (('error' in r && r.error) || 'Invio fallito')),
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
        title="Manda il listino"
        className={soloIcona
          ? `p-1.5 rounded-lg text-text-muted hover:bg-bg-hover transition-colors ${className}`
          : `flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors ${className}`}>
        <Receipt className="w-3.5 h-3.5" />{soloIcona ? null : ' Manda il listino'}
      </button>

      <AnimatePresence>
        {aperto && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={() => setAperto(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="fixed inset-0 z-[81] flex items-center justify-center p-4"
              onClick={e => daSfondo(e) && setAperto(false)}>
              <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h3 className="text-base font-display font-semibold text-text-primary">Manda il listino</h3>
                  <button onClick={() => setAperto(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Le tre linguette: cambiano il link, il messaggio e il QR. */}
                  <div className="flex rounded-xl border border-border overflow-hidden text-xs">
                    {([['tutto', 'Tutto'], ['trattamenti', 'Trattamenti'], ['pacchetti', 'Pacchetti']] as const).map(([val, lab]) => (
                      <button key={val} type="button" onClick={() => { setVista(val); setEsito(null); }}
                        className={`flex-1 py-2 font-semibold transition-colors ${
                          vista === val ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                        {lab}
                      </button>
                    ))}
                  </div>

                  {/* Il numero scritto a mano: per chi in rubrica non c'è. */}
                  {!phone && chiediNumero && (
                    <div className="space-y-2">
                      {/* Prima si cerca in rubrica: un tocco e numero e nome sono a posto. */}
                      <div className="relative">
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">Cerca una cliente già registrata</label>
                        <input value={cercaCliente} onChange={e => { setCercaCliente(e.target.value); setEsito(null); }}
                          placeholder="Nome o numero…" autoFocus
                          className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
                        {trovati.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 z-10 rounded-xl border border-border bg-bg-secondary shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                            {trovati.map(c => (
                              <button key={c.id} type="button"
                                onClick={() => {
                                  setNumero(c.phone || '');
                                  setNomeScritto(c.firstName || '');
                                  setCercaCliente('');
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-bg-hover flex items-center justify-between gap-2">
                                <span className="text-sm text-text-primary truncate">{c.firstName} {c.lastName}</span>
                                <span className="text-[11px] text-text-muted font-mono flex-shrink-0">{c.phone}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">oppure scrivi il numero</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">Numero di WhatsApp</label>
                        <input value={numero} onChange={e => { setNumero(e.target.value); setEsito(null); }}
                          inputMode="tel" placeholder="Es. 333 1234567"
                          className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-secondary mb-1">Nome <span className="font-normal text-text-muted">(facoltativo)</span></label>
                        <input value={nomeScritto} onChange={e => setNomeScritto(e.target.value)}
                          placeholder="Come la saluto nel messaggio"
                          className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Non serve che sia registrata: il messaggio parte lo stesso e la scheda si crea quando viene.
                      </p>
                    </div>
                  )}

                  {(phone || chiediNumero) && (
                    <div>
                      <button onClick={manda} disabled={inviando || !pronto}
                        className="w-full py-3 rounded-xl gradient-accent text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                        <Send className="w-4 h-4" /> {inviando ? 'Sto mandando…' : phone ? `Manda su WhatsApp al ${phone}` : 'Manda il listino'}
                      </button>
                      {esito && (
                        <p className={`text-[11px] mt-2 ${esito.avviso ? 'text-warning' : esito.ok ? 'text-success' : 'text-error'}`}>
                          {esito.ok && !esito.avviso ? <><Check className="w-3 h-3 inline mr-1" />{esito.testo}</> : esito.testo}
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
                    <img src={vista === 'tutto' ? '/api/listino/qr' : `/api/listino/qr?v=${vista}`} alt="QR del listino"
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
