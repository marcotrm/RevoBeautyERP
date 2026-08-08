'use client';

/**
 * Campagna WhatsApp verso chi ha scaricato il coupon e non ha ancora prenotato.
 *
 * Due passaggi obbligati: prima l'anteprima (simulazione, non parte niente) e
 * poi l'invio vero con conferma. Sono messaggi di marketing a decine di persone:
 * meglio vedere l'elenco esatto prima di far partire qualcosa di irreversibile.
 */

import React, { useCallback, useState } from 'react';
import { Megaphone, Loader2, Send, X, AlertTriangle, CheckCircle, Download } from 'lucide-react';
import { previewAutomation, runAutomationNow } from '@/app/actions/whatsapp';
import type { RunResult } from '@/lib/wa-automations';

export default function CampagnaOmaggio() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [anteprima, setAnteprima] = useState<RunResult | null>(null);
  const [esito, setEsito] = useState<RunResult | null>(null);
  // 1 = chi non ha ancora ricevuto niente · 2 = sollecito a chi non ha risposto
  const [giro, setGiro] = useState<1 | 2>(1);

  const carica = useCallback(async (g: 1 | 2) => {
    setGiro(g);
    setEsito(null);
    setAnteprima(null);
    setBusy(true);
    try { setAnteprima(await previewAutomation('omaggio', g)); }
    finally { setBusy(false); }
  }, []);

  const apri = async () => {
    setOpen(true);
    await carica(giro);
  };

  const invia = async () => {
    const quanti = anteprima?.candidates ?? 0;
    if (!window.confirm(
      `Mandare ${giro === 2 ? 'il sollecito' : 'il messaggio'} a ${quanti} contatt${quanti === 1 ? 'o' : 'i'}?\n\n` +
      'I messaggi partono davvero e non si possono richiamare. Ogni contatto lo riceve una volta sola.'
    )) return;
    setBusy(true);
    try { setEsito(await runAutomationNow('omaggio', giro)); }
    finally { setBusy(false); }
  };

  /** La stessa lista, da tenere fuori dal gestionale o da passare a qualcuno. */
  const scarica = () => {
    const righe = anteprima?.details ?? [];
    const csv = [['Nome', 'Telefono'], ...righe.map(d => [d.name || '', `+${d.to}`])]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = giro === 2 ? 'sollecito-omaggio.csv' : 'campagna-omaggio.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button onClick={apri}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors">
        <Megaphone className="w-4 h-4" /> Campagna WhatsApp
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-display font-semibold text-text-primary">Campagna seduta omaggio</h3>
                <p className="text-xs text-text-muted">
                  {giro === 2
                    ? 'Sollecito: solo a chi ha già ricevuto il primo messaggio e non ha risposto né prenotato'
                    : 'Primo invio: a chi ha scaricato il coupon e non ha ancora prenotato'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex rounded-xl border border-border overflow-hidden w-fit">
                {([[1, 'Primo invio'], [2, 'Sollecito']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => carica(val)} disabled={busy}
                    className={`px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                      giro === val ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {busy && !anteprima && (
                <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Preparo l&apos;elenco…</p>
              )}

              {esito && (
                <div className={`p-3 rounded-xl border ${esito.failed > 0 ? 'bg-warning/10 border-warning/30' : 'bg-success/10 border-success/30'}`}>
                  <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> Inviati {esito.sent} messaggi
                    {esito.failed > 0 && <span className="text-warning">· {esito.failed} non partiti</span>}
                  </p>
                  {esito.failed > 0 && (
                    <p className="text-xs text-text-secondary mt-1">
                      {esito.details.find(d => !d.ok)?.error}
                    </p>
                  )}
                </div>
              )}

              {anteprima && !esito && (
                <>
                  {anteprima.skipped && (
                    <p className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-xs text-error">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {anteprima.skipped}
                    </p>
                  )}

                  <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Messaggio che riceveranno</p>
                    <p className="text-sm text-text-primary whitespace-pre-line">
                      {anteprima.details[0]?.preview || 'Nessun destinatario: hanno già prenotato tutti.'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-text-primary mb-2">
                      <strong>{anteprima.candidates}</strong> contatt{anteprima.candidates === 1 ? 'o' : 'i'} riceveranno il messaggio
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border/30">
                      {anteprima.details.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-sm text-text-primary truncate">{d.name}</span>
                          <span className="text-[11px] text-text-muted font-mono flex-shrink-0">+{d.to}</span>
                        </div>
                      ))}
                      {anteprima.details.length === 0 && (
                        <p className="px-3 py-6 text-center text-sm text-text-muted">Nessuno da contattare</p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {giro === 2
                      ? 'Nel sollecito restano fuori: chi ha prenotato o è già venuto a fare la seduta, chi ha risposto al primo messaggio, chi il primo messaggio non l\u2019ha mai ricevuto e chi ha revocato il consenso marketing. Il sollecito parte una volta sola per contatto.'
                      : 'Chi ha già prenotato, chi ha revocato il consenso marketing e chi ha già ricevuto questa campagna viene saltato in automatico.'} Serve il template
                    <strong className="text-text-primary"> omaggio_inaugurazione</strong> approvato su 360dialog:
                    senza, i messaggi vengono rifiutati da Meta.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-bg-tertiary/30">
              <button onClick={scarica} disabled={!anteprima?.details.length}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-40">
                <Download className="w-4 h-4" /> Scarica lista
              </button>
              <button onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                Chiudi
              </button>
              {!esito && (
                <button onClick={invia} disabled={busy || !anteprima || anteprima.candidates === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {giro === 2 ? 'Sollecita' : 'Invia a'} {anteprima?.candidates ?? 0}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
