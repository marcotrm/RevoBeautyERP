'use client';

/**
 * Le tre iconcine accanto al nome di una cliente.
 *
 * Un componente solo, usato ovunque compaia un nome — agenda, ricerca,
 * WhatsApp, cassa, clienti — perché il senso è che si vedano sempre, e
 * soprattutto MENTRE si prenota: sapere dopo che quella disdice sempre non
 * serve a niente.
 *
 * Chi lo usa passa quello che ha: l'id (disdette e segnalazioni) e il nome
 * (corona). Se non c'è niente da dire, non occupa spazio.
 */

import React, { useEffect, useMemo } from 'react';
import { Crown, CalendarX, Frown } from 'lucide-react';
import { useSegniStore, segniDi } from '@/stores/useSegniStore';
import { riassunto } from '@/lib/clientiTop';
import { riassuntoAffidabilita, consiglioAffidabilita } from '@/lib/affidabilita';

interface Props {
  clientId?: string;
  nome?: string;
  /** Piccolo per le righe fitte (tendine, elenchi), normale per le intestazioni. */
  taglia?: 'sm' | 'md';
  className?: string;
}

export default function SegniCliente({ clientId, nome, taglia = 'sm', className = '' }: Props) {
  const carica = useSegniStore(s => s.carica);
  // Il valore si rilegge quando il magazzino dei segni cambia: senza questa
  // dipendenza le icone comparirebbero solo al render successivo.
  const caricato = useSegniStore(s => s.caricato);

  useEffect(() => { void carica(); }, [carica]);

  const { corona, rischio, segnalata } = useMemo(
    () => segniDi(clientId, nome),
    [clientId, nome, caricato],
  );
  if (!corona && !rischio && !segnalata) return null;

  const misura = taglia === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span className={`inline-flex items-center gap-1 flex-shrink-0 ${className}`}>
      {corona && (
        <span title={`Fra le clienti che spendono di più: ${riassunto(corona)} negli ultimi 12 mesi`}
          aria-label="Cliente da coccolare">
          <Crown className={`${misura} text-warning`} />
        </span>
      )}
      {rischio && (
        <span title={`${riassuntoAffidabilita(rischio)}. ${consiglioAffidabilita(rischio)}`}
          aria-label="Cliente che salta gli appuntamenti">
          <CalendarX className={`${misura} ${rischio.livello === 'rischio' ? 'text-error' : 'text-warning'}`} />
        </span>
      )}
      {segnalata && (
        <span title={`Segnalata${segnalata.segnalataDa ? ` da ${segnalata.segnalataDa}` : ''}: ${segnalata.motivo}`}
          aria-label="Cliente segnalata">
          <Frown className={`${misura} text-error`} />
        </span>
      )}
    </span>
  );
}
