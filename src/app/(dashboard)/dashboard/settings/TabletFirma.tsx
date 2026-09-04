'use client';

/**
 * Come si collega il tablet della firma.
 *
 * Si fa una volta sola e non si tocca piu': si inquadra il QR col tablet, si
 * mette la pagina a schermo intero, e da quel momento il tablet aspetta. Non
 * c'e' nessun account da creare e nessuna password da ricordare — e
 * soprattutto il tablet non entra nel gestionale: se una cliente lo prende in
 * mano non trova ne' agenda, ne' anagrafica, ne' incassi.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Tablet } from 'lucide-react';
import { generaChiaveTablet, statoTablet, type StatoTablet } from '@/app/actions/tablet';

export function TabletFirma() {
  const [stato, setStato] = useState<StatoTablet | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let vivo = true;
    statoTablet()
      .then(s => { if (vivo) setStato(s); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [versione]);

  // Finche' questa schermata e' aperta si guarda se il tablet si fa vivo: e'
  // il momento in cui qualcuno lo sta collegando, e vedere "collegato"
  // comparire da solo vale piu' di qualunque istruzione scritta.
  useEffect(() => {
    const t = setInterval(() => setVersione(v => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const origine = typeof window !== 'undefined' ? window.location.origin : 'https://erp.revobeauty.it';
  const link = stato?.chiave ? `${origine}/tablet/${stato.chiave}` : '';

  const crea = useCallback(async (rifare: boolean) => {
    if (rifare && !confirm('Il tablet collegato adesso smetterà di funzionare e andrà ricollegato. Procedo?')) return;
    setOccupato(true);
    try {
      await generaChiaveTablet();
      setVersione(v => v + 1);
    } finally { setOccupato(false); }
  }, []);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch { /* niente permesso: il link resta a schermo */ }
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Tablet className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Il tablet della firma</h3>
            <p className="text-xs text-text-muted">
              I consensi si aprono lì da soli: la cliente firma al banco, senza carta e senza WhatsApp.
            </p>
          </div>
        </div>
        {stato && (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
            stato.collegato ? 'bg-success/15 text-success' : 'bg-bg-tertiary text-text-muted'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stato.collegato ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
            {stato.collegato ? 'tablet acceso' : 'nessun tablet'}
          </span>
        )}
      </div>

      {!stato ? (
        <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Carico…</p>
      ) : !stato.chiave ? (
        <>
          <p className="text-sm text-text-secondary">
            Non c’è ancora nessun tablet. Premi qui sotto e ti do il codice da inquadrare.
          </p>
          <button onClick={() => crea(false)} disabled={occupato}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-50">
            {occupato ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tablet className="w-4 h-4" />}
            Collega un tablet
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/tablet/qr?k=${encodeURIComponent(stato.chiave)}`} alt="Codice da inquadrare col tablet"
              className="w-40 h-40 rounded-xl border border-border bg-white flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <ol className="text-sm text-text-secondary space-y-1.5 list-decimal list-inside">
                <li>Col tablet, inquadra questo codice (o apri il link qui sotto).</li>
                <li>Metti la pagina a schermo intero e lascia il tablet acceso sul banco.</li>
                <li>Da lì in poi, «Manda al tablet» dalla scheda cliente lo apre lì.</li>
              </ol>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-bg-tertiary border border-border text-[11px] text-text-secondary truncate">
                  {link}
                </code>
                <button onClick={copia}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex-shrink-0">
                  {copiato ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiato ? 'Copiato' : 'Copia'}
                </button>
              </div>
              {stato.ultimoContatto && (
                <p className="text-[11px] text-text-muted">
                  Ultima volta che il tablet si è fatto vivo:{' '}
                  {new Date(stato.ultimoContatto).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {stato.inAttesa && (
                <p className="text-[11px] text-warning">
                  In questo momento sul tablet c’è il modulo di {stato.inAttesa.cliente} in attesa di firma.
                </p>
              )}
            </div>
          </div>

          <button onClick={() => crea(true)} disabled={occupato}
            className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-error">
            <RefreshCw className="w-3 h-3" /> Rigenera il codice (se il tablet si perde o si cambia)
          </button>

          <p className="text-[11px] text-text-muted leading-relaxed">
            Il tablet non entra nel gestionale: vede solo la schermata d’attesa e il modulo da firmare. Se una cliente
            lo prende in mano non trova né l’agenda, né le altre schede, né la cassa — è la stessa ragione per cui il
            POS ha un tastierino e non un computer.
          </p>
        </>
      )}
    </div>
  );
}
