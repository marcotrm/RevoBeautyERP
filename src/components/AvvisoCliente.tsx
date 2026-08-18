'use client';

/**
 * L'avviso in chiaro su una cliente, per quando le si sta dando un posto.
 *
 * Le iconcine servono a riconoscere in mezzo a un elenco; qui invece si sta
 * decidendo, e allora ci vuole una frase con dentro i numeri: "ha saltato 4
 * appuntamenti su 6, chiedile la conferma il giorno prima". Compare solo
 * quando c'è qualcosa da dire.
 */

import React, { useEffect, useMemo } from 'react';
import { CalendarX, Frown, Crown } from 'lucide-react';
import { useSegniStore, segniDi } from '@/stores/useSegniStore';
import { riassunto } from '@/lib/clientiTop';
import { riassuntoAffidabilita, consiglioAffidabilita } from '@/lib/affidabilita';

interface Props {
  clientId?: string;
  nome?: string;
  /** Mostra anche la corona: in prenotazione serve, in cassa meno. */
  conCorona?: boolean;
}

export default function AvvisoCliente({ clientId, nome, conCorona = true }: Props) {
  const carica = useSegniStore(s => s.carica);
  const caricato = useSegniStore(s => s.caricato);

  useEffect(() => { void carica(); }, [carica]);

  const { corona, rischio, segnalata } = useMemo(
    () => segniDi(clientId, nome),
    [clientId, nome, caricato],
  );
  if (!rischio && !segnalata && !(conCorona && corona)) return null;

  return (
    <div className="space-y-2">
      {rischio && (
        <div className={`flex items-start gap-2.5 p-3 rounded-xl ${rischio.livello === 'rischio' ? 'bg-error/10 border border-error/30' : 'bg-warning/10 border border-warning/30'}`}>
          <CalendarX className={`w-4 h-4 flex-shrink-0 mt-0.5 ${rischio.livello === 'rischio' ? 'text-error' : 'text-warning'}`} />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {rischio.livello === 'rischio' ? 'Attenzione: salta spesso gli appuntamenti' : 'Ha cominciato a saltare gli appuntamenti'}
            </p>
            <p className="text-xs text-text-secondary">{riassuntoAffidabilita(rischio)}. {consiglioAffidabilita(rischio)}</p>
          </div>
        </div>
      )}
      {segnalata && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-error/10 border border-error/30">
          <Frown className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Cliente segnalata</p>
            <p className="text-xs text-text-secondary">{segnalata.motivo}</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {segnalata.segnalataDa ? `da ${segnalata.segnalataDa}` : 'segnalata'} il {segnalata.quando.slice(8, 10)}/{segnalata.quando.slice(5, 7)}
            </p>
          </div>
        </div>
      )}
      {conCorona && corona && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <Crown className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Fra le clienti che spendono di più</p>
            <p className="text-xs text-text-secondary">{riassunto(corona)} negli ultimi 12 mesi: trovale il posto.</p>
          </div>
        </div>
      )}
    </div>
  );
}
