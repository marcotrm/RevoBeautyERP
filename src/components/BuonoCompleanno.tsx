'use client';

/**
 * "Ha il regalo di compleanno da spendere."
 *
 * Il messaggio degli auguri promette uno sconto con una scadenza. Questa
 * targhetta è la prova che quella promessa esiste ancora: si vede nella scheda
 * della cliente e in agenda, così chi la prenota lo sa prima che lei debba
 * chiederlo — che è il momento in cui un regalo smette di sembrare un regalo.
 *
 * Non compare nulla se il buono non c'è, è scaduto o è già stato speso.
 */

import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { buonoDiCliente } from '@/app/actions/buoni';
import type { BuonoCompleanno } from '@/lib/buonoCompleanno';

function giorno(ymd: string): string {
  const [y, m, d] = (ymd || '').split('-');
  return y && m && d ? `${d}/${m}` : ymd;
}

/** Quanti giorni mancano alla scadenza, oggi compreso. */
function giorniAllaScadenza(scadenza: string): number {
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const a = Date.parse(`${oggi}T12:00:00Z`);
  const b = Date.parse(`${scadenza}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 99;
  return Math.round((b - a) / 86_400_000);
}

export default function BuonoCompleannoBadge({ clientId, className = '' }: { clientId?: string | null; className?: string }) {
  const [buono, setBuono] = useState<BuonoCompleanno | null>(null);

  useEffect(() => {
    let vivo = true;
    // Anche senza cliente si chiede lo stesso: torna null e la targhetta
    // sparisce da sé, senza scrivere nello stato durante il disegno.
    buonoDiCliente(clientId).then(b => { if (vivo) setBuono(b); }).catch(() => {});
    return () => { vivo = false; };
  }, [clientId]);

  if (!buono) return null;

  /*
    Quanto manca, non solo quando scade.

    "Entro il 28/08" costringe a fare il conto in testa mentre si ha la cliente
    al telefono. "Scade domani" si capisce senza pensarci — ed è quello che fa
    prendere l'appuntamento adesso invece che un giorno qualsiasi.
  */
  const mancano = giorniAllaScadenza(buono.scadenza);
  const urgente = mancano <= 2;
  const quando = mancano <= 0 ? 'scade oggi'
    : mancano === 1 ? 'scade domani'
    : `restano ${mancano} giorni`;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${
      urgente ? 'bg-error/10 border-error/30 text-error' : 'bg-accent/10 border-accent/25 text-accent'} ${className}`}
      title={`Regalo di compleanno: ${buono.percento}% sul prossimo trattamento, valido fino al ${giorno(buono.scadenza)} compreso. Si scala da solo in cassa, una volta sola.`}>
      <Gift className="w-3.5 h-3.5 flex-shrink-0" />
      Regalo compleanno {buono.percento}% — {quando} (entro il {giorno(buono.scadenza)})
    </span>
  );
}
