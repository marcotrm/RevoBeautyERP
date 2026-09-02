'use client';

/**
 * L'interruttore «non chiederle la recensione», nella scheda della cliente.
 *
 * Sta fra le impostazioni personali e non fra i segni: non e' un giudizio
 * sulla persona, e' una decisione su un messaggio. Chi lo tocca deve poterlo
 * ritogliere con lo stesso gesto.
 */

import React, { useEffect, useState } from 'react';
import { leggiSenzaRecensione, impostaSenzaRecensione } from '@/app/actions/recensioneCliente';

export default function NienteRecensione({ clientId }: { clientId: string }) {
  const [escluso, setEscluso] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    leggiSenzaRecensione(clientId)
      .then(v => { if (vivo) setEscluso(v); })
      .catch(() => { if (vivo) setEscluso(false); });
    return () => { vivo = false; };
  }, [clientId]);

  const cambia = async () => {
    if (escluso === null || salvando) return;
    const nuovo = !escluso;
    setSalvando(true);
    setEscluso(nuovo);
    try { await impostaSenzaRecensione(clientId, nuovo); }
    catch { setEscluso(!nuovo); }
    finally { setSalvando(false); }
  };

  return (
    <div className="flex items-center justify-between py-2 border-t border-border mt-2 pt-4">
      <div className="min-w-0 pr-3">
        <span className="text-sm font-semibold text-text-secondary">Richiesta recensione</span>
        <p className="text-[11px] text-text-muted">
          {escluso ? 'A questa cliente non viene chiesta.' : 'Le arriva il giorno dopo la visita, una volta sola.'}
        </p>
      </div>
      <button onClick={cambia} disabled={escluso === null || salvando}
        title={escluso ? 'Rimetti la richiesta di recensione' : 'Non chiedere la recensione a questa cliente'}
        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
          escluso
            ? 'border-warning/40 bg-warning/10 text-warning'
            : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
        {escluso === null ? '…' : escluso ? 'Non gliela chiediamo' : 'Non chiedergliela'}
      </button>
    </div>
  );
}
