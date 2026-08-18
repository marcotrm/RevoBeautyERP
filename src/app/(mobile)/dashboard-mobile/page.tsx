'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Euro, CalendarDays, Users, ShoppingBag, Receipt, ChevronRight, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAppointments } from '@/app/actions/agenda';
import { getTodayTransactions } from '@/app/actions/pos';
import { getClients } from '@/app/actions/clients';

function fmtEuro(n: number) { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export default function DashboardMobilePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ revenueToday: 0, txCount: 0, avgTicket: 0, aptsToday: 0, newClients: 0, txs: [] as { id: string; client: string; items: string; total: number; time: string }[] });

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    setIsHydrated(useAuthStore.persist.hasHydrated());
    return () => unsub();
  }, []);
  useEffect(() => { if (isHydrated && !isAuthenticated) router.push('/login'); }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    const t = todayStr(); const ym = t.slice(0, 7);
    Promise.all([getTodayTransactions(), getAppointments(), getClients()]).then(([txs, apts, clients]) => {
      const revenueToday = txs.reduce((s, x) => s + x.total, 0);
      setData({
        revenueToday,
        txCount: txs.length,
        avgTicket: txs.length ? revenueToday / txs.length : 0,
        aptsToday: apts.filter(a => a.date === t).length,
        newClients: clients.filter(c => (c.createdAt || '').slice(0, 7) === ym).length,
        txs: txs.slice(0, 8),
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!isHydrated || !isAuthenticated) return null;

  const kpis = [
    { label: 'Incasso Oggi', value: fmtEuro(data.revenueToday), icon: Euro, color: '#22C55E' },
    { label: 'Appuntamenti Oggi', value: String(data.aptsToday), icon: CalendarDays, color: '#A855F7' },
    { label: 'Transazioni Oggi', value: String(data.txCount), icon: Receipt, color: '#3B82F6' },
    { label: 'Scontrino Medio', value: fmtEuro(data.avgTicket), icon: TrendingUp, color: '#F59E0B' },
    { label: 'Nuovi Clienti (mese)', value: String(data.newClients), icon: Users, color: '#EC4899' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-display font-bold">Riepilogo</h1>
          <span className="ml-auto text-xs text-text-muted">{new Date().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {loading ? (
          <p className="text-center text-text-muted py-16 text-sm">Caricamento...</p>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3">
              {kpis.map(k => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className="bg-bg-secondary border border-border rounded-2xl p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                    <p className="text-lg font-display font-bold">{k.value}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{k.label}</p>
                  </div>
                );
              })}
              <Link href="/agenda-mobile" className="bg-accent/10 border border-accent/25 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
                <CalendarDays className="w-5 h-5 text-accent mb-1" />
                <p className="text-sm font-semibold text-accent">Apri Agenda</p>
                <p className="text-[11px] text-text-muted">vista giornaliera</p>
              </Link>
            </div>

            {/* Ultime transazioni cassa */}
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Receipt className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold">Ultimi incassi</h3>
              </div>
              {data.txs.length === 0 ? (
                <p className="text-center text-text-muted py-8 text-sm">Nessun incasso oggi</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {data.txs.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.client || 'Cliente'}</p>
                        <p className="text-[11px] text-text-muted truncate">{t.items} • {t.time}</p>
                      </div>
                      <span className={`text-sm font-semibold ${t.total < 0 ? 'text-error' : 'text-success'}`}>{fmtEuro(t.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link href="/agenda-mobile" className="flex items-center justify-between px-4 py-3 rounded-2xl bg-bg-secondary border border-border">
              <span className="text-sm font-medium">Vai all&apos;Agenda mobile</span>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
