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

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent/10 border border-accent/25 text-[11px] font-semibold text-accent ${className}`}
      title={`Regalo di compleanno: ${buono.percento}% sul prossimo trattamento, valido fino al ${giorno(buono.scadenza)}. Si scala da solo in cassa, una volta sola.`}>
      <Gift className="w-3.5 h-3.5 flex-shrink-0" />
      Regalo compleanno {buono.percento}% — entro il {giorno(buono.scadenza)}
    </span>
  );
}
