'use client';

/**
 * Quello che la cliente ha davvero compilato e firmato.
 *
 * Il modulo si firmava e spariva: in scheda restava una riga con la data e
 * una firma grande come un francobollo. Le risposte — l'ultima depilazione,
 * l'ultima esposizione al sole, i farmaci, l'herpes — stavano nel database e
 * non le leggeva nessuno. Sono esattamente le informazioni per cui il modulo
 * esiste: servono all'operatrice PRIMA di accendere la macchina.
 *
 * Le risposte si mostrano insieme alla domanda per intero, mai da sole. La
 * riga "gravidanza: sì" letta senza la domanda vuol dire il contrario di
 * quello che la cliente ha dichiarato — la domanda e' «Dichiara di NON essere
 * in stato di gravidanza», quindi quel "sì" e' la conferma che non lo e'.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, FileText, PenLine, X } from 'lucide-react';
import { CONSENSO_LASER, DICHIARAZIONE_FINALE, DOMANDE_STORICO, TESTO_FOTO } from '@/lib/consensoLaserTesto';
import { documentoDi, type DocumentoSalvato } from '@/app/actions/documenti';

export interface ConsensoDaVedere {
  id: string;
  title: string;
  signedAt: string;
  notes?: string | null;
  signatureData?: string | null;
  data?: unknown;
}

interface DatiLaser {
  documento?: { tipo?: string; numero?: string } | null;
  zone?: string;
  seduta?: string;
  operatrice?: string;
  consensoFoto?: boolean;
  eraLaser?: boolean;
  versioneTesto?: string;
  appointmentId?: string;
  storico?: Record<string, string>;
}

/** Come si legge una risposta, secondo il tipo di domanda che le e' stata fatta. */
function leggiRisposta(domanda: typeof DOMANDE_STORICO[number], valore?: string): {
  testo: string; attenzione: boolean;
} {
  const v = (valore || '').trim();
  if (!v) return { testo: 'non risposto', attenzione: false };

  if (domanda.tipo === 'conferma') {
    // "si" = ha confermato la dichiarazione. Il contrario e' quello che pesa.
    return v === 'si'
      ? { testo: 'Confermato', attenzione: false }
      : { testo: 'NON confermato', attenzione: true };
  }
  if (domanda.tipo === 'sino') {
    // Un "sì" su farmaci o herpes non e' un allarme: e' una cosa da guardare
    // in faccia prima di accendere la macchina.
    return v === 'si' ? { testo: 'Sì', attenzione: true } : { testo: 'No', attenzione: false };
  }
  return { testo: v, attenzione: false };
}

export default function DettaglioConsenso({ consenso, clientId, nomeCliente, onChiudi }: {
  consenso: ConsensoDaVedere; clientId?: string; nomeCliente?: string; onChiudi: () => void;
}) {
  const [testoAperto, setTestoAperto] = useState(false);
  const [documento, setDocumento] = useState<DocumentoSalvato | null>(null);
  const [ingrandita, setIngrandita] = useState(false);

  /*
    Il documento allegato: si carica a parte perche' la foto pesa, e questa
    finestra si apre anche solo per rileggere due risposte.
  */
  useEffect(() => {
    let vivo = true;
    if (!clientId) return;
    documentoDi(clientId).then(d => { if (vivo) setDocumento(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [clientId]);
  const d = (consenso.data || {}) as DatiLaser;
  const storico = d.storico || {};
  const eLaser = d.eraLaser || /laser|epilazione/i.test(consenso.title);
  const risposte = eLaser ? DOMANDE_STORICO.map(q => ({ q, r: leggiRisposta(q, storico[q.id]) })) : [];
  const daGuardare = risposte.filter(x => x.r.attenzione);

  const quando = new Date(consenso.signedAt).toLocaleString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm niente-stampa" onClick={onChiudi} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none">
        <div className="da-stampare w-full max-w-2xl max-h-[90vh] flex flex-col bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">

          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-lg font-display font-semibold text-text-primary">{consenso.title}</h3>
              {/*
                Il nome di chi ha firmato, sul foglio.

                A schermo si sa gia' di chi e' la scheda che si sta guardando;
                su un foglio stampato no, e un consenso senza il nome di chi
                l'ha firmato non e' un documento, e' una pagina di risposte.
              */}
              {nomeCliente && <p className="text-sm font-medium text-text-primary">{nomeCliente}</p>}
              <p className="text-xs text-text-muted capitalize">{quando}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 niente-stampa">
              <button onClick={() => window.print()}
                className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
                Stampa
              </button>
              <button onClick={onChiudi} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {/* Le cose da guardare in faccia, prima di tutto il resto */}
            {daGuardare.length > 0 && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Da guardare prima della seduta</p>
                  <ul className="mt-1 space-y-0.5">
                    {daGuardare.map(({ q, r }) => (
                      <li key={q.id} className="text-xs text-text-secondary">
                        {q.testo} → <strong className="text-text-primary">{r.testo}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {d.zone && (
                <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                  <p className="text-[11px] text-text-muted">Zone concordate</p>
                  <p className="text-sm text-text-primary font-medium">{d.zone}</p>
                </div>
              )}
              {d.seduta && (
                <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                  <p className="text-[11px] text-text-muted">Per la seduta del</p>
                  <p className="text-sm text-text-primary font-medium">
                    {d.seduta.slice(0, 10).split('-').reverse().join('/')}
                    {d.seduta.length > 10 ? ` alle ${d.seduta.slice(11)}` : ''}
                  </p>
                </div>
              )}
              {d.operatrice && (
                <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                  <p className="text-[11px] text-text-muted">Operatrice</p>
                  <p className="text-sm text-text-primary font-medium">{d.operatrice}</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                <p className="text-[11px] text-text-muted flex items-center gap-1"><Camera className="w-3 h-3" /> Foto prima/dopo</p>
                <p className={`text-sm font-medium ${d.consensoFoto ? 'text-success' : 'text-text-secondary'}`}>
                  {d.consensoFoto ? 'Ha acconsentito' : 'Non ha acconsentito'}
                </p>
              </div>
            </div>

            {/* Il questionario, domanda per domanda */}
            {risposte.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Quello che ha dichiarato</p>
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                  {risposte.map(({ q, r }) => (
                    <div key={q.id} className="flex items-start gap-3 px-3.5 py-2.5 bg-bg-tertiary/30">
                      <p className="text-xs text-text-secondary flex-1 min-w-0">{q.testo}</p>
                      <p className={`text-sm font-semibold flex-shrink-0 text-right ${r.attenzione ? 'text-warning' : 'text-text-primary'}`}>
                        {r.testo}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Il documento allegato: e' da li' che esce il numero */}
            {documento && (
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Documento allegato</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={documento.foto} alt="Documento della cliente"
                    onClick={() => setIngrandita(true)}
                    className="w-full max-h-56 object-contain bg-white cursor-zoom-in" />
                  <div className="px-3.5 py-2.5 bg-bg-tertiary/40 border-t border-border">
                    <p className="text-sm font-semibold text-text-primary">
                      {documento.tipoLeggibile} n. {documento.numero}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {[documento.nome, documento.cognome].filter(Boolean).join(' ')}
                      {documento.dataNascita ? ` · nata il ${documento.dataNascita.split('-').reverse().join('/')}` : ''}
                      {documento.scadenza ? ` · scade il ${documento.scadenza.split('-').reverse().join('/')}` : ''}
                      {documento.scaduto ? ' · SCADUTO' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* La firma, grande abbastanza da riconoscerla */}
            <div>
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">La firma</p>
              {consenso.signatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={consenso.signatureData} alt="Firma della cliente"
                  className="w-full max-h-40 object-contain bg-white rounded-xl border border-border p-2" />
              ) : (
                <div className="flex items-center gap-2 p-4 rounded-xl border border-border bg-bg-tertiary/40 text-sm text-text-muted">
                  <PenLine className="w-4 h-4" /> Nessuna firma salvata su questo consenso.
                </div>
              )}
              {consenso.notes && <p className="text-[11px] text-text-muted mt-1.5">{consenso.notes}</p>}
            </div>

            {/* Il testo che ha firmato: si apre solo se serve rileggerlo */}
            {eLaser && (
              <div>
                <button onClick={() => setTestoAperto(v => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline">
                  <FileText className="w-3.5 h-3.5" />
                  {testoAperto ? 'Nascondi il testo firmato' : 'Leggi il testo che ha firmato'}
                  {d.versioneTesto ? <span className="text-text-muted font-normal">· versione del {d.versioneTesto.split('-').reverse().join('/')}</span> : null}
                </button>
                {testoAperto && (
                  <div className="mt-2 p-4 rounded-xl border border-border bg-bg-tertiary/30 max-h-72 overflow-y-auto space-y-3">
                    {CONSENSO_LASER.map((s, i) => (
                      <div key={i} className="space-y-1.5">
                        {s.titolo && <p className="text-xs font-bold text-text-primary uppercase tracking-wide">{s.titolo}</p>}
                        {s.testo?.map((t, j) => <p key={j} className="text-[11px] text-text-secondary leading-relaxed">{t}</p>)}
                        {s.punti && (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {s.punti.map((p, j) => <li key={j} className="text-[11px] text-text-secondary leading-relaxed">{p}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border space-y-1.5">
                      {DICHIARAZIONE_FINALE.map((t, i) => (
                        <p key={i} className="text-[11px] text-text-secondary leading-relaxed">{t}</p>
                      ))}
                      {d.consensoFoto && <p className="text-[11px] text-text-secondary leading-relaxed italic">{TESTO_FOTO}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Il documento a schermo intero: un numero si legge solo se si vede */}
      {ingrandita && documento && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIngrandita(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={documento.foto} alt="Documento" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </>
  );
}
