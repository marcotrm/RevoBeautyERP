'use client';

import React, { useState, useTransition } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { cambiaStatoContatto, mandaPrimoMessaggio, eliminaContatto } from './actions';
import { STATI_LEAD } from '@/lib/lead';

export default function AzioniContatto({
  id, stato, giaContattato, contattabile,
}: {
  id: string;
  stato: string;
  giaContattato: boolean;
  contattabile: boolean;
}) {
  const [inCorso, start] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);

  const scrivi = () => start(async () => {
    setErrore(null);
    const r = await mandaPrimoMessaggio(id);
    if (!r.ok) setErrore(r.errore || 'Invio fallito');
  });

  const elimina = () => {
    if (!confirm('Elimini questo contatto? Non si recupera.')) return;
    start(async () => { await eliminaContatto(id); });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={stato}
          disabled={inCorso}
          onChange={e => start(async () => { await cambiaStatoContatto(id, e.target.value); })}
          className="px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-[11px] text-text-primary focus:outline-none focus:border-accent/50"
        >
          {Object.entries(STATI_LEAD).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>

        {/* Il primo messaggio si manda una volta sola: da contattato in poi il
            tasto sparisce, così nessuno lo preme due volte "per sicurezza". */}
        {!giaContattato && contattabile && (
          <button onClick={scrivi} disabled={inCorso} title="Manda il primo messaggio su WhatsApp"
            className="p-1.5 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-50">
            {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        )}

        <button onClick={elimina} disabled={inCorso} title="Elimina"
          className="p-1.5 rounded-lg bg-bg-tertiary border border-border text-text-muted hover:text-error hover:bg-bg-hover disabled:opacity-50">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {errore && <p className="text-[10px] text-error text-right max-w-[200px]">{errore}</p>}
    </div>
  );
}
