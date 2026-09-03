'use client';

/**
 * Chi entra nel gestionale, e quando.
 *
 * Prima non lo sapeva nessuno: si entrava e basta, senza lasciare traccia. La
 * domanda "ma quello ha ancora accesso?" e' arrivata quando un socio e'
 * uscito, e la risposta non c'era — il passato non si ricostruisce.
 *
 * Ci sono anche i tentativi falliti, e sono la parte che dice di piu': dieci
 * password sbagliate di notte sullo stesso indirizzo non sono una distrazione.
 */

import React, { useEffect, useState } from 'react';
import { History, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { elencoAccessi, type AccessoRegistrato } from '@/app/actions/accounts';

const ETICHETTE: Record<string, { testo: string; classe: string }> = {
  ok: { testo: 'entrato', classe: 'bg-success/15 text-success' },
  password_errata: { testo: 'password sbagliata', classe: 'bg-error/15 text-error' },
  account_spento: { testo: 'account spento', classe: 'bg-warning/15 text-warning' },
  inesistente: { testo: 'email che non esiste', classe: 'bg-error/15 text-error' },
};

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export function RegistroAccessi() {
  const [righe, setRighe] = useState<AccessoRegistrato[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [caricando, setCaricando] = useState(false);

  const carica = React.useCallback(() => {
    setCaricando(true);
    elencoAccessi({ limite: 300 })
      .then(setRighe)
      .catch(() => setRighe([]))
      .finally(() => setCaricando(false));
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const mostrate = (righe || []).filter(r => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return [r.email, r.nome, r.ip, r.dispositivo].some(v => String(v || '').toLowerCase().includes(q));
  });

  const falliti = (righe || []).filter(r => r.esito !== 'ok').length;

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Registro accessi</h3>
            <p className="text-xs text-text-muted">
              Ogni entrata nel gestionale, riuscita o no. Si registra da oggi in avanti.
            </p>
          </div>
        </div>
        <button onClick={carica} disabled={caricando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50">
          {caricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
        </button>
      </div>

      <input type="text" value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="Cerca per email, nome, indirizzo IP o dispositivo"
        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />

      {righe === null ? (
        <p className="text-sm text-text-muted py-6 text-center">Carico…</p>
      ) : righe.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">
          Nessun accesso registrato per ora. Le righe compaiono dal primo accesso dopo l&apos;attivazione.
        </p>
      ) : (
        <>
          {falliti > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
              <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-text-secondary">
                {falliti === 1 ? 'C’è un tentativo non riuscito' : `Ci sono ${falliti} tentativi non riusciti`} fra questi accessi.
                Una password sbagliata capita; molte di fila, o a orari strani, no.
              </p>
            </div>
          )}

          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {mostrate.map(r => {
              const e = ETICHETTE[r.esito] || { testo: r.esito, classe: 'bg-bg-hover text-text-secondary' };
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-bg-tertiary/40">
                  {r.esito === 'ok'
                    ? <ShieldCheck className="w-4 h-4 text-success flex-shrink-0" />
                    : <ShieldAlert className="w-4 h-4 text-error flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {r.nome || r.email}
                      {r.ruolo ? <span className="text-text-muted font-normal"> · {r.ruolo}</span> : null}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {r.email}{r.dispositivo ? ` · ${r.dispositivo}` : ''}{r.ip ? ` · ${r.ip}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.classe}`}>{e.testo}</span>
                    <p className="text-[11px] text-text-muted mt-0.5">{quando(r.quando)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
