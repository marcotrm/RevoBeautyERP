'use client';

/**
 * I riquadri con cui si sceglie come paga la cliente.
 *
 * Sta qui, e non dentro una pagina sola, perche' i soldi si incassano in piu'
 * punti — la cassa, l'attivazione di un pacchetto, una rata, un buono regalo —
 * e il pagamento misto deve esserci dappertutto: chi tira fuori cinquanta euro
 * dal portafogli e mette il resto sulla carta non lo fa solo davanti al POS.
 *
 * I due importi si tengono per mano: se ne scrivi uno, l'altro si aggiusta da
 * solo, cosi' la somma fa sempre il totale e non c'e' modo di salvare una
 * divisione sbagliata.
 */

import React, { useState } from 'react';
import { descriviMisto, eMisto } from '@/lib/pagamenti';
import { formatCurrency } from '@/lib/helpers';

const BASE = [['Carta', '💳'], ['Contanti', '💵'], ['Satispay', '📱'], ['Bonifico', '🏦']] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const numero = (s: string) => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const euro = (n: number) => n.toFixed(2).replace('.', ',');

export default function ScegliMetodo({ totale, valore, onChange, dopo, compatto }: {
  /** Il totale da dividere fra contanti e carta. */
  totale: number;
  valore: string;
  onChange: (metodo: string) => void;
  /** Un riquadro in piu' in fondo (il Regalo, dove ha senso). */
  dopo?: React.ReactNode;
  compatto?: boolean;
}) {
  const misto = eMisto(valore);
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');

  const dividi = (contanti: number) => {
    const c = Math.max(0, Math.min(totale, round2(contanti)));
    const resto = round2(totale - c);
    setCash(euro(c));
    setCard(euro(resto));
    onChange(descriviMisto(c, resto));
  };

  const scriviContanti = (v: string) => {
    setCash(v);
    const c = Math.max(0, Math.min(totale, round2(numero(v))));
    const resto = round2(totale - c);
    setCard(euro(resto));
    onChange(descriviMisto(c, resto));
  };

  const scriviCarta = (v: string) => {
    setCard(v);
    const k = Math.max(0, Math.min(totale, round2(numero(v))));
    const resto = round2(totale - k);
    setCash(euro(resto));
    onChange(descriviMisto(resto, k));
  };

  // Se il totale cambia dopo aver diviso (si corregge l'importo), la divisione
  // resta quella di prima: meglio dirlo che salvare due numeri che non tornano.
  const somma = round2(numero(cash) + numero(card));
  const scollato = misto && Math.abs(somma - totale) > 0.01;

  const p = compatto ? 'p-2.5' : 'p-3';
  const t = compatto ? 'text-xs' : 'text-sm';

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {BASE.map(([m, icon]) => (
          <button key={m} type="button" onClick={() => onChange(m)}
            className={`flex items-center gap-2 ${p} rounded-xl border-2 transition-all ${valore === m ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
            <span className={compatto ? 'text-base' : 'text-lg'}>{icon}</span>
            <span className={`${t} font-medium ${valore === m ? 'text-accent' : 'text-text-primary'}`}>{m}</span>
          </button>
        ))}
        <button type="button" onClick={() => dividi(round2(totale / 2))}
          className={`col-span-2 flex items-center gap-2 ${p} rounded-xl border-2 transition-all ${misto ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'}`}>
          <span className={compatto ? 'text-base' : 'text-lg'}>⚖️</span>
          <span className={`${t} font-medium ${misto ? 'text-accent' : 'text-text-primary'}`}>Contanti + Carta</span>
          <span className="text-[10px] text-text-muted ml-auto">un po&apos; e un po&apos;</span>
        </button>
        {dopo}
      </div>

      {misto && (
        <div className="mt-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border space-y-2">
          <p className="text-xs text-text-muted">
            Dividi i {formatCurrency(totale)}: scrivi quanto paga in contanti, il resto va sulla carta da solo.
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] text-text-secondary mb-1">Contanti</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={cash} onChange={e => scriviContanti(e.target.value)}
                  className="w-full pl-2 pr-6 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-text-secondary mb-1">Carta / POS</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={card} onChange={e => scriviCarta(e.target.value)}
                  className="w-full pl-2 pr-6 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary text-right focus:outline-none focus:border-accent/50" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
              </div>
            </div>
          </div>
          {scollato && (
            <button type="button" onClick={() => dividi(round2(totale / 2))}
              className="text-[11px] text-warning font-medium hover:underline">
              La divisione fa {formatCurrency(somma)} ma il totale è {formatCurrency(totale)} — tocca qui per rifarla
            </button>
          )}
        </div>
      )}
    </div>
  );
}
