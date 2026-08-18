'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Vault, Lock, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getCassaforte, CassaMovementRecord } from '@/app/actions/cassaforte';

function fmtEuro(n: number) { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }

export default function CassaforteMobilePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState<CassaMovementRecord[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    setIsHydrated(useAuthStore.persist.hasHydrated());
    return () => unsub();
  }, []);
  useEffect(() => { if (isHydrated && !isAuthenticated) router.push('/login'); }, [isHydrated, isAuthenticated, router]);

  const load = useCallback(async () => {
    try {
      const s = await getCassaforte();
      setBalance(s.balance);
      setMovements(s.movements);
      setUpdatedAt(new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  // Live: primo caricamento + refresh automatico ogni 15s
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Vault className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-display font-bold flex items-center gap-1.5">Cassaforte <Lock className="w-3.5 h-3.5 text-text-muted" /></h1>
          <button onClick={load} className="ml-auto p-2 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover transition-colors" title="Aggiorna ora">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Saldo grande */}
        <div className="rounded-2xl p-6 text-center bg-gradient-to-b from-accent/15 to-accent/5 border border-accent/25">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Contanti in cassaforte</p>
          <p className="text-5xl font-display font-bold text-accent">{fmtEuro(balance)}</p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Live {updatedAt && `• aggiornato ${updatedAt}`}
          </div>
        </div>

        {/* Storico movimenti */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Movimenti</h3>
          </div>
          {loading && movements.length === 0 ? (
            <p className="text-center text-text-muted py-10 text-sm">Caricamento...</p>
          ) : movements.length === 0 ? (
            <p className="text-center text-text-muted py-10 text-sm">Nessun movimento</p>
          ) : (
            <div className="divide-y divide-border/30">
              {movements.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`p-2 rounded-lg ${m.type === 'withdraw' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    {m.type === 'withdraw' ? <ArrowDownToLine className="w-4 h-4" /> : <Vault className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.type === 'withdraw' ? 'Prelievo' : 'Chiusura cassa'}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {m.date.split('-').reverse().join('/')}
                      {m.type === 'deposit' ? ` • ${m.txCount} transazioni` : (m.note ? ` • ${m.note}` : '')}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${m.type === 'withdraw' ? 'text-warning' : 'text-success'}`}>
                    {m.type === 'withdraw' ? '−' : '+'} {fmtEuro(m.cash)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-text-muted">Si aggiorna da solo ogni 15 secondi</p>
      </div>
    </div>
  );
}
