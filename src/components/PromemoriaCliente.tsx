'use client';

/**
 * Le cose da chiedere alla cliente quando è qui.
 *
 * Stessa lista in due posti: nel pannello dell'appuntamento (dove la si legge
 * mentre la persona è al banco) e nella scheda cliente (dove ci si ricorda di
 * scriverla, magari giorni prima). Un solo componente, così le due viste non
 * possono divergere.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  promemoriaDi, aggiungiPromemoria, segnaPromemoriaFatto, eliminaPromemoria,
  type Promemoria,
} from '@/app/actions/promemoria';

interface Props {
  clientId: string;
  /** Mostra anche quelli già segnati fatti: serve alla scheda, non al banco. */
  conStorico?: boolean;
  /** La scheda cliente ha già il suo riquadro: qui il titolo sarebbe doppio. */
  senzaTitolo?: boolean;
  /** Chiamata dopo ogni modifica, per chi tiene un contatore fuori. */
  onCambio?: () => void;
}

export default function PromemoriaCliente({ clientId, conStorico = false, senzaTitolo = false, onCambio }: Props) {
  const [lista, setLista] = useState<Promemoria[]>([]);
  const [testo, setTesto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ricarica = useCallback(async () => {
    if (!clientId) { setLista([]); return; }
    setLista(await promemoriaDi(clientId, conStorico).catch(() => []));
  }, [clientId, conStorico]);

  useEffect(() => { void ricarica(); }, [ricarica]);

  const chiSono = () => {
    const io = useAuthStore.getState().user;
    return [io?.firstName, io?.lastName].filter(Boolean).join(' ').trim();
  };

  const salva = async () => {
    if (!clientId || !testo.trim()) return;
    setSalvando(true);
    try {
      await aggiungiPromemoria({ clientId, testo, creatoDa: chiSono() });
      setTesto('');
      await ricarica();
      onCambio?.();
    } finally { setSalvando(false); }
  };

  const aperti = lista.filter(pm => !pm.fattoIl);
  const fatti = lista.filter(pm => pm.fattoIl);

  return (
    <div className="space-y-2">
      {!senzaTitolo && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> Da chiedere quando è qui
        </p>
      )}

      {aperti.map(pm => (
        <div key={pm.id} className="flex items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30">
          <p className="flex-1 text-sm text-text-primary leading-snug">
            {pm.testo}
            <span className="block text-[10px] text-text-muted mt-0.5">
              scritto {pm.createdAt.slice(8, 10)}/{pm.createdAt.slice(5, 7)}{pm.creatoDa ? ` da ${pm.creatoDa}` : ''}
            </span>
          </p>
          <button
            onClick={async () => { await segnaPromemoriaFatto(pm.id, chiSono()); await ricarica(); onCambio?.(); }}
            className="px-2 py-1 rounded-lg bg-success/15 text-success text-[11px] font-semibold hover:bg-success/25 flex-shrink-0">
            Fatto
          </button>
          {conStorico && (
            <button
              title="Cancella (scritto per sbaglio)"
              onClick={async () => { await eliminaPromemoria(pm.id); await ricarica(); onCambio?.(); }}
              className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 flex-shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <input type="text" value={testo} {...NO_AUTOFILL}
          onChange={e => setTesto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void salva(); }}
          placeholder="Es. chiedile se il rossore è passato"
          className="flex-1 px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted" />
        <button onClick={salva} disabled={salvando || !testo.trim()}
          className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold disabled:opacity-40 flex-shrink-0">
          {salvando ? '…' : 'Aggiungi'}
        </button>
      </div>

      {aperti.length === 0 && (
        <p className="text-[11px] text-text-muted/70">
          Quello che scrivi qui ricompare da solo al check-in, finché non lo segni fatto.
        </p>
      )}

      {conStorico && fatti.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Già chiesti</p>
          {fatti.map(pm => (
            <p key={pm.id} className="text-[11px] text-text-muted flex items-start gap-1.5">
              <Check className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
              <span className="line-through">{pm.testo}</span>
              <span className="ml-auto flex-shrink-0">
                {pm.fattoIl?.slice(8, 10)}/{pm.fattoIl?.slice(5, 7)}{pm.fattoDa ? ` · ${pm.fattoDa}` : ''}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
