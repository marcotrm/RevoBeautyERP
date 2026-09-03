'use client';

/**
 * Gli ordini arrivati dallo shop, e cosa farci.
 *
 * Tre gesti: metto da parte (pronto), la cliente passa e paga (ritirato),
 * oppure non se ne fa niente (annullato). Il magazzino si scarica solo al
 * ritiro: finche' il prodotto sta sullo scaffale col bigliettino, non e'
 * uscito.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Package, ShoppingBag, X } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { useAuthStore } from '@/stores/useAuthStore';
import { cambiaStatoOrdine, elencoOrdini, ritiraOrdine, type Ordine } from '@/app/actions/ordini';

const ETICHETTE: Record<string, { testo: string; classe: string }> = {
  nuovo: { testo: 'nuovo', classe: 'bg-warning/15 text-warning' },
  pronto: { testo: 'pronto da ritirare', classe: 'bg-accent/15 text-accent' },
  ritirato: { testo: 'ritirato', classe: 'bg-success/15 text-success' },
  annullato: { testo: 'annullato', classe: 'bg-bg-hover text-text-muted' },
};

export default function Ordini() {
  const [lista, setLista] = useState<Ordine[] | null>(null);
  const [tutti, setTutti] = useState(false);
  const [occupato, setOccupato] = useState('');
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let vivo = true;
    elencoOrdini(!tutti)
      .then(l => { if (vivo) setLista(l); })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [tutti, versione]);

  const ricarica = useCallback(() => setVersione(v => v + 1), []);

  const azione = async (id: string, fn: () => Promise<unknown>) => {
    setOccupato(id);
    try { await fn(); ricarica(); } finally { setOccupato(''); }
  };

  if (lista === null) {
    return <div className="flex items-center gap-2 text-sm text-text-muted p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carico gli ordini…</div>;
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-base font-display font-semibold text-text-primary">Ordini dallo shop</h3>
            <p className="text-xs text-text-muted">Ordinati online, si ritirano e si pagano in centro</p>
          </div>
        </div>
        <button onClick={() => { setLista(null); setTutti(t => !t); }}
          className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
          {tutti ? 'Mostra solo quelli aperti' : 'Mostra anche i chiusi'}
        </button>
      </div>

      {lista.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-9 h-9 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Nessun ordine {tutti ? '' : 'aperto'} per ora.</p>
          <p className="text-[11px] text-text-muted mt-1">
            Il link dello shop sta in Marketing, fra i canali di prenotazione.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {lista.map(o => {
          const e = ETICHETTE[o.stato] || ETICHETTE.nuovo;
          return (
            <div key={o.id} className="p-4 rounded-xl border border-border bg-bg-tertiary/40">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">#{o.numero} · {o.clientName}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.classe}`}>{e.testo}</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {o.phone} · {new Date(o.createdAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {o.righe.map((r, i) => (
                      <p key={i} className="text-xs text-text-secondary">
                        🧴 {r.nome}{r.qty > 1 ? ` ×${r.qty}` : ''} — {formatCurrency(r.prezzo * r.qty)}
                      </p>
                    ))}
                  </div>
                  {o.note && <p className="text-[11px] text-text-muted mt-1.5 italic">«{o.note}»</p>}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-display font-bold text-text-primary">{formatCurrency(o.totale)}</p>
                </div>
              </div>

              {(o.stato === 'nuovo' || o.stato === 'pronto') && (
                <div className="flex gap-2 mt-3">
                  {o.stato === 'nuovo' && (
                    <button disabled={occupato === o.id}
                      onClick={() => azione(o.id, () => cambiaStatoOrdine(o.id, 'pronto'))}
                      className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50">
                      L’ho messo da parte
                    </button>
                  )}
                  <button disabled={occupato === o.id}
                    onClick={() => azione(o.id, () => {
                      const io = useAuthStore.getState().user;
                      return ritiraOrdine(o.id, { operatore: [io?.firstName, io?.lastName].filter(Boolean).join(' ') || 'Staff' });
                    })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg gradient-accent text-white text-xs font-bold disabled:opacity-50">
                    {occupato === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Ritirato e pagato
                  </button>
                  <button disabled={occupato === o.id}
                    onClick={() => { if (confirm('Annullare questo ordine?')) azione(o.id, () => cambiaStatoOrdine(o.id, 'annullato')); }}
                    className="p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/40 disabled:opacity-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted">
        Il magazzino si scarica al ritiro, non all’ordine: finché il prodotto è sullo scaffale col bigliettino, non è
        uscito. «Ritirato e pagato» crea la riga in cassa con lo scarico, come una vendita al banco.
      </p>
    </div>
  );
}
