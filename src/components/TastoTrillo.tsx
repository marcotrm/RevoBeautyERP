'use client';

/**
 * Il tasto del trillo, accanto alla chat.
 *
 * Sta qui e non dentro l'appuntamento perche' il momento in cui serve non e'
 * quello in cui si guarda una scheda: e' quando alzi gli occhi, vedi che sono
 * le e venti e la cabina e' ancora chiusa. Deve essere a portata di pollice
 * sempre, come la chat.
 *
 * E non e' rivolto a nessuno. Non dice chi e' in ritardo, non dice di quanto,
 * non nomina la cliente che aspetta: fa un suono, e basta. Chi lavora sa cosa
 * vuol dire — e se qualcosa fosse scritto sullo schermo del tablet, quello
 * schermo lo puo' leggere anche la cliente sdraiata accanto.
 */

import React, { useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { mandaTrillo } from '@/app/actions/trillo';
import { idSchermo, suonaTrillo } from '@/components/Trillo';

export default function TastoTrillo() {
  const [statoBreve, setStatoBreve] = useState<'' | 'mandato' | 'qui' | 'muto'>('');
  const tenuto = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eraTenuto = useRef(false);

  const mostra = (s: 'mandato' | 'qui' | 'muto') => {
    setStatoBreve(s);
    setTimeout(() => setStatoBreve(''), 2600);
  };

  const manda = async () => {
    try {
      await mandaTrillo({ da: idSchermo() });
      mostra('mandato');
    } catch { /* se non parte si va di persona, come si e' sempre fatto */ }
  };

  /*
    Tenendolo premuto si sente qui.

    Serve solo a provarlo: da soli, davanti a un tasto che di proposito non
    suona sul telefono che lo preme, l'unica conclusione possibile e' che sia
    rotto.
  */
  const iniziaPressione = () => {
    eraTenuto.current = false;
    tenuto.current = setTimeout(() => {
      eraTenuto.current = true;
      mostra(suonaTrillo(1) ? 'qui' : 'muto');
    }, 600);
  };
  const finePressione = () => {
    if (tenuto.current) clearTimeout(tenuto.current);
    if (!eraTenuto.current) void manda();
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        onPointerDown={iniziaPressione}
        onPointerUp={finePressione}
        onPointerLeave={() => { if (tenuto.current) clearTimeout(tenuto.current); }}
        onContextMenu={e => e.preventDefault()}
        title="Trillo: suona sugli altri schermi del centro. Tienilo premuto per sentirlo qui."
        aria-label="Manda il trillo"
        className={`p-2 rounded-xl transition-colors ${
          statoBreve ? 'bg-warning/15 text-warning' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
      >
        <BellRing className="w-5 h-5" />
      </button>

      {statoBreve && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary shadow-lg z-50">
          {statoBreve === 'mandato' ? 'Trillo mandato · suona sugli altri schermi'
            : statoBreve === 'qui' ? 'Questo è il suono'
              : 'Qui non riesce a suonare: controlla il volume'}
        </span>
      )}
    </div>
  );
}
