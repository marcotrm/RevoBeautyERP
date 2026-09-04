'use client';

/**
 * Il credito della cliente, nella sua scheda.
 *
 * Si carica qui e si spende da solo in cassa. Sotto ci sono i movimenti, e
 * ci sono apposta: quando una cliente dice «ma io avevo lasciato cinquanta
 * euro», l'unica risposta che chiude il discorso e' una riga con la data,
 * l'importo e chi l'ha segnata.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Undo2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { useAuthStore } from '@/stores/useAuthStore';
import { caricaCredito, creditoDi, stornaMovimentoCredito, type CreditoCliente } from '@/app/actions/credito';

const METODI = ['Contanti', 'Carta', 'Satispay', 'Bonifico'] as const;

export function Credito({ clientId }: { clientId: string }) {
  const [dati, setDati] = useState<CreditoCliente | null>(null);
  const [apri, setApri] = useState(false);
  const [importo, setImporto] = useState('');
  const [motivo, setMotivo] = useState('');
  /*
    Da dove arrivano questi soldi: tre casi, non due.

    Prima si sceglieva fra «ha pagato adesso» e «glielo regaliamo», e il caso
    piu' frequente non era nessuno dei due: la cliente aveva gia' pagato — di
    piu' del dovuto, o una seduta poi non fatta. Quei soldi in cassa ci sono
    gia' entrati il giorno del pagamento, quindi non devono rientrarci oggi,
    ma chiamarli «regalo» e' falso: non e' un omaggio, e' un debito.

    Nei conti «gia' incassato» e «omaggio» si comportano uguale — in cassa non
    entra niente — ma restano scritti diversi nello storico, perche' fra sei
    mesi la differenza fra «gli dovevamo 15 euro» e «gliel'abbiamo regalato»
    e' l'unica cosa che conta davvero.
  */
  const [natura, setNatura] = useState<'ora' | 'gia' | 'omaggio'>('ora');
  const incassaOra = natura === 'ora';
  const [metodo, setMetodo] = useState<string>('Contanti');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    let vivo = true;
    creditoDi(clientId)
      .then(d => { if (vivo) setDati(d); })
      .catch(() => { if (vivo) setDati({ saldo: 0, movimenti: [] }); });
    return () => { vivo = false; };
  }, [clientId, versione]);

  const ricarica = useCallback(() => setVersione(v => v + 1), []);

  const chi = () => {
    const io = useAuthStore.getState().user;
    return [io?.firstName, io?.lastName].filter(Boolean).join(' ').trim() || 'Staff';
  };

  const salva = async () => {
    setErrore('');
    setOccupato(true);
    try {
      const r = await caricaCredito({
        clientId,
        importo: Number(importo.replace(',', '.')),
        motivo: natura === 'gia' ? `${motivo} · soldi già incassati`
          : natura === 'omaggio' ? `${motivo} · omaggio del centro`
            : motivo,
        incassaOra,
        metodo,
        operatore: chi(),
      });
      if (!r.ok) { setErrore(r.error || 'Non sono riuscito a caricarlo'); return; }
      setImporto(''); setMotivo(''); setApri(false);
      ricarica();
    } finally { setOccupato(false); }
  };

  const storna = async (id: string) => {
    if (!confirm('Annullare questo movimento? Resta nello storico, con accanto lo storno.')) return;
    setOccupato(true);
    try {
      await stornaMovimentoCredito(id, chi());
      ricarica();
    } finally { setOccupato(false); }
  };

  const saldo = dati?.saldo ?? 0;

  return (
    <div className={`border rounded-2xl p-6 space-y-4 ${saldo > 0 ? 'bg-success/5 border-success/30' : 'bg-bg-secondary border-border'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className={`w-5 h-5 ${saldo > 0 ? 'text-success' : 'text-accent'}`} />
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Credito</h3>
            <p className="text-xs text-text-muted">
              {saldo > 0
                ? 'Si scala da solo alla prossima vendita in cassa.'
                : 'Soldi che le dobbiamo: anticipi, sedute non fatte, rimborsi lasciati sul conto.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dati && (
            <span className={`text-2xl font-display font-bold ${saldo > 0 ? 'text-success' : 'text-text-muted'}`}>
              {formatCurrency(saldo)}
            </span>
          )}
          <button onClick={() => setApri(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover">
            <Plus className="w-4 h-4" /> Carica
          </button>
        </div>
      </div>

      {apri && (
        <div className="rounded-xl border border-border bg-bg-tertiary/40 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Quanto</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={importo} onChange={e => setImporto(e.target.value)} placeholder="50,00"
                  className="w-full pl-3 pr-7 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Da dove arriva</label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="es. ha pagato 75 invece di 60"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
            </div>
          </div>

          {/*
            Le due cose non sono uguali e vanno separate qui, non dopo.

            Se ha pagato, quei soldi entrano in cassa OGGI e quando li
            spendera' non entrera' niente. Se glielo regaliamo, in cassa non
            entra niente ne' oggi ne' domani — e quel trattamento nei conti
            deve risultare gratis, perche' lo e'.
          */}
          <div className="space-y-2">
            {([
              ['ora', 'Ha pagato adesso', 'entra in cassa oggi'],
              ['gia', 'Aveva già pagato', 'in cassa non entra niente: quei soldi ci sono entrati il giorno del pagamento. È il caso di chi ha pagato più del dovuto o di una seduta pagata e mai fatta.'],
              ['omaggio', 'Glielo regaliamo', 'non entra niente in cassa, né oggi né quando lo userà: quel trattamento nei conti sarà gratis'],
            ] as const).map(([valore, titolo, sotto]) => (
              <button key={valore} onClick={() => setNatura(valore)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                  natura === valore ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-hover'}`}>
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${natura === valore ? 'border-accent bg-accent' : 'border-border'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{titolo}</span>
                  <span className="block text-[11px] text-text-muted">{sotto}</span>
                </span>
              </button>
            ))}
          </div>

          {incassaOra && (
            <div className="flex flex-wrap gap-2">
              {METODI.map(m => (
                <button key={m} onClick={() => setMetodo(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    metodo === m ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {errore && <p className="text-[11px] text-error">{errore}</p>}

          <div className="flex gap-2">
            <button onClick={() => setApri(false)}
              className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
              Annulla
            </button>
            <button onClick={salva} disabled={occupato || !importo.trim() || !motivo.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg gradient-accent text-white text-xs font-bold disabled:opacity-40">
              {occupato ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Carica il credito
            </button>
          </div>
        </div>
      )}

      {dati === null ? (
        <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Carico…</p>
      ) : dati.movimenti.length === 0 ? (
        <p className="text-sm text-text-muted">Nessun movimento.</p>
      ) : (
        <div className="space-y-1.5">
          {dati.movimenti.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-bg-tertiary/40">
              <span className={`text-sm font-semibold flex-shrink-0 w-20 text-right ${m.importo > 0 ? 'text-success' : 'text-text-primary'}`}>
                {m.importo > 0 ? '+' : ''}{formatCurrency(m.importo)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-primary truncate">{m.motivo}</p>
                <p className="text-[10px] text-text-muted">
                  {new Date(m.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {m.operatore ? ` · ${m.operatore}` : ''}
                  {m.inCassa ? ' · passato dalla cassa' : ''}
                </p>
              </div>
              <button onClick={() => storna(m.id)} disabled={occupato}
                title="Annulla questo movimento"
                className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 flex-shrink-0 disabled:opacity-40">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
