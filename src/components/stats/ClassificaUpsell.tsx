'use client';

/**
 * Classifica upsell: chi vende trattamenti in più mentre la cliente è già in
 * cabina. I dati nascono in agenda, dal "+ Aggiungi" del pannello appuntamento
 * dopo il check-in, e dai prodotti battuti in cassa.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { classificaUpsell, type RigaClassificaUpsell } from '@/app/actions/upsell';

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const MEDAGLIE = ['🥇', '🥈', '🥉'];

export default function ClassificaUpsell() {
  // Mese mostrato: primo giorno del mese
  const [mese, setMese] = useState(() => {
    const oggi = new Date();
    return new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  });
  const [dati, setDati] = useState<{ periodo: string; righe: RigaClassificaUpsell[] } | null>(null);
  const [aperta, setAperta] = useState('');

  const dal = `${mese.getFullYear()}-${String(mese.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoGiorno = new Date(mese.getFullYear(), mese.getMonth() + 1, 0).getDate();
  const al = `${mese.getFullYear()}-${String(mese.getMonth() + 1).padStart(2, '0')}-${String(ultimoGiorno).padStart(2, '0')}`;

  useEffect(() => {
    const periodo = dal;
    classificaUpsell(dal, al)
      .then(righe => setDati({ periodo, righe }))
      .catch(() => setDati({ periodo, righe: [] }));
  }, [dal, al]);

  // Dati del mese mostrato: se non sono ancora arrivati, si vede il caricamento
  const righe = dati?.periodo === dal ? dati.righe : null;
  const titoloMese = mese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-base font-display font-semibold text-text-primary">Classifica upsell</h3>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button onClick={() => setMese(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-text-primary capitalize min-w-[130px] text-center">{titoloMese}</span>
          <button onClick={() => setMese(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="text-xs text-text-secondary mt-0.5 mb-4 leading-relaxed">
        Tutto quello che le estetiste vendono in più: trattamenti aggiunti quando la cliente era già in cabina
        (dall&apos;agenda, dopo il check-in) e prodotti battuti in cassa — creme, kit, cosmetici.
      </p>

      {righe === null ? (
        <div className="flex items-center py-8 text-text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calcolo…</div>
      ) : righe.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nessun upsell registrato in questo mese. Quando un&apos;estetista aggiunge un trattamento a una cliente già in cabina, compare qui.
        </p>
      ) : (
        <div className="space-y-2">
          {righe.map((r, i) => (
            <div key={r.operatorId} className="rounded-2xl border border-border overflow-hidden">
              <button onClick={() => setAperta(a => a === r.operatorId ? '' : r.operatorId)}
                className="w-full flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors text-left">
                <span className="text-xl w-8 text-center flex-shrink-0">{MEDAGLIE[i] || `${i + 1}°`}</span>
                <span className="flex-1 font-bold text-text-primary">{r.nome}</span>
                <span className="text-sm text-text-secondary"><b className="text-text-primary">{r.numero}</b> upsell</span>
                <span className="text-sm font-bold text-accent min-w-[90px] text-right">{eur(r.valore)}</span>
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${aperta === r.operatorId ? 'rotate-180' : ''}`} />
              </button>
              {aperta === r.operatorId && (
                <div className="px-4 pb-4 space-y-1.5">
                  {r.voci.map((v, j) => (
                    <div key={j} className="flex items-center gap-3 text-xs text-text-secondary rounded-lg bg-bg-tertiary/40 px-3 py-2">
                      <span className="text-text-muted">{new Date(v.data + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                      <span className="flex-shrink-0">{v.tipo === 'prodotto' ? '🧴' : '💆'}</span>
                      <span className="flex-1 truncate"><b className="text-text-primary">{v.cliente}</b> · {v.trattamento}</span>
                      <span className="font-semibold text-text-primary">{eur(v.prezzo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
