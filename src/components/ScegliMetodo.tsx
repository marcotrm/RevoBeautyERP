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
        {/*
          Il riquadro grosso, con i due simboli e il bordo tratteggiato.
          In mezzo a quattro riquadri tutti uguali questo spariva: chi non
          sapeva gia' che esisteva non lo cercava nemmeno.
        */}
        <button type="button" onClick={() => dividi(round2(totale / 2))}
          className={`col-span-2 flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed transition-all ${
            misto ? 'border-accent bg-accent/10' : 'border-accent/40 bg-accent/5 hover:bg-accent/10'}`}>
          <span className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xl">💵</span>
            <span className="text-sm font-bold text-accent">+</span>
            <span className="text-xl">💳</span>
          </span>
          <span className="text-left min-w-0">
            <span className="block text-sm font-semibold text-accent">Paga una parte in contanti e una con la carta</span>
            <span className="block text-[11px] text-text-muted">per esempio 50 in contanti e 20 con la carta</span>
          </span>
        </button>
        {dopo}
      </div>

      {misto && (
        <div className="mt-3 p-4 rounded-xl bg-accent/5 border-2 border-accent/30 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Come dividiamo i {formatCurrency(totale)}?</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">💵 In contanti</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={cash} onChange={e => scriviContanti(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-bg-secondary border-2 border-border text-xl font-display font-bold text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">💳 Con la carta</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={card} onChange={e => scriviCarta(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 rounded-xl bg-bg-secondary border-2 border-border text-xl font-display font-bold text-text-primary text-right focus:outline-none focus:border-accent" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
              </div>
            </div>
          </div>

          {/* Le cifre che si sentono davvero al bancone: "cinquanta in contanti
              e il resto con la carta". Un tocco invece di scriverle. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-text-muted">In contanti:</span>
            {[10, 20, 50, 100].filter(v => v < totale).map(v => (
              <button key={v} type="button" onClick={() => dividi(v)}
                className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-xs font-semibold text-text-secondary hover:border-accent hover:text-accent transition-colors">
                {v} €
              </button>
            ))}
            <button type="button" onClick={() => dividi(round2(totale / 2))}
              className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-xs font-semibold text-text-secondary hover:border-accent hover:text-accent transition-colors">
              metà
            </button>
          </div>

          {scollato ? (
            <button type="button" onClick={() => dividi(round2(totale / 2))}
              className="w-full text-center text-xs text-warning font-medium hover:underline">
              La divisione fa {formatCurrency(somma)} ma il totale è {formatCurrency(totale)} — tocca qui per rifarla
            </button>
          ) : (
            <p className="text-center text-xs text-text-secondary pt-1 border-t border-accent/20">
              <strong className="text-text-primary">{formatCurrency(numero(cash))}</strong> in contanti
              {' + '}
              <strong className="text-text-primary">{formatCurrency(numero(card))}</strong> con la carta
              {' = '}
              <strong className="text-success">{formatCurrency(totale)}</strong>
            </p>
          )}
        </div>
      )}

    </div>
  );
}
