'use client';

/**
 * Il trillo: si preme e suona.
 *
 * Quando una seduta sfora, il titolare non puo' entrare in cabina a dire
 * all'operatrice di sbrigarsi: la cliente e' li' che sente tutto, e sentirsi
 * dire che il proprio trattamento sta rubando tempo e' il modo piu' veloce di
 * perderla. Cosi' non lo dice nessuno, e l'appuntamento dopo slitta.
 *
 * Il trillo e' quello di MSN: parte dalle casse del computer al banco e si
 * sente in sala. L'operatrice sa cosa vuol dire; per la cliente e' un suono
 * del gestionale come i bip di fine trattamento, che li' suonano tutto il
 * giorno.
 *
 * Prima passava dal database per suonare sugli ALTRI schermi, e sul computer
 * che lo premeva restava muto: chi lo provava concludeva — giustamente — che
 * fosse rotto. Adesso e' quello che sembra: un tasto che fa un suono.
 */

import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { suonaTrillo, usaSuonoSuo } from '@/lib/suono';
import { leggiSuonoTrillo } from '@/app/actions/suoni';

export default function TastoTrillo() {
  const [stato, setStato] = useState<'' | 'suonato' | 'muto'>('');

  /*
    Il suono del centro, se ne ha caricato uno suo.

    Si chiede una volta all'apertura e resta li': premendo il tasto non c'e'
    tempo di andare a cercarlo nel database — il suono deve uscire subito.
  */
  useEffect(() => {
    let vivo = true;
    leggiSuonoTrillo()
      .then(s => { if (vivo && s?.dataUrl) usaSuonoSuo(s.dataUrl); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const trilla = async () => {
    const ok = await suonaTrillo();
    setStato(ok ? 'suonato' : 'muto');
    setTimeout(() => setStato(''), 2500);
  };

  return (
    <div className="relative flex-shrink-0">
      <button onClick={trilla}
        title="Trillo: suona dalle casse di questo computer"
        aria-label="Suona il trillo"
        className={`p-2 rounded-xl transition-colors ${
          stato === 'suonato' ? 'bg-warning/20 text-warning'
            : stato === 'muto' ? 'bg-error/15 text-error'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
        <BellRing className="w-5 h-5" />
      </button>

      {stato && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary shadow-lg z-50">
          {stato === 'suonato' ? 'Trillo!' : 'Il browser non fa uscire l\u2019audio: controlla il volume'}
        </span>
      )}
    </div>
  );
}
