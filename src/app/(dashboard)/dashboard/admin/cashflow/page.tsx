'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ArrowUpRight, ArrowDownRight, Calendar, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency } from '@/lib/helpers';
import { useCashFlowStore } from '@/stores/useCashFlowStore';

export default function CashFlowPage() {
  const { cashFlowEntries: entries } = useCashFlowStore();
  const totalIn = entries.filter(e => e.type === 'entrata' && e.status === 'completato').reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter(e => e.type === 'uscita' && e.status === 'completato').reduce((s, e) => s + e.amount, 0);
  const saldo = 12450;
  const previstoIn = entries.filter(e => e.type === 'entrata' && e.status === 'previsto').reduce((s, e) => s + e.amount, 0);
  const previstoOut = entries.filter(e => e.type === 'uscita' && e.status === 'previsto').reduce((s, e) => s + e.amount, 0);
  const saldoPrevisto = saldo + previstoIn - previstoOut;

  const weeklyData = [
    { week: 'Sett 1', entrate: 8200, uscite: 4500 },
    { week: 'Sett 2', entrate: 7800, uscite: 6200 },
    { week: 'Sett 3', entrate: 8500, uscite: 3800 },
    { week: 'Sett 4', entrate: 9100, uscite: 7700 },
  ];

  const projectionData = Array.from({ length: 30 }, (_, i) => {
    const daily = (previstoIn - previstoOut) / 30;
    return { day: i + 1, saldo: Math.round(saldo + daily * (i + 1)) };
  });

  const upcoming = entries.filter(e => e.status === 'previsto').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Cash Flow</h2>
        <p className="text-sm text-text-secondary">Flussi finanziari, previsioni e liquidità</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Entrate Mese</p>
          <p className="text-2xl font-display font-bold text-success mt-1">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Uscite Mese</p>
          <p className="text-2xl font-display font-bold text-error mt-1">{formatCurrency(totalOut)}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Saldo Disponibile</p>
          <p className="text-2xl font-display font-bold text-accent mt-1">{formatCurrency(saldo)}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Saldo Previsto</p>
          <p className={`text-2xl font-display font-bold mt-1 ${saldoPrevisto >= 0 ? 'text-success' : 'text-error'}`}>{formatCurrency(saldoPrevisto)}</p>
          <p className="text-[10px] text-text-muted">fine mese</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Flow */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Flussi Settimanali</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#1A1D27', border: '1px solid #2E3348', borderRadius: 12, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="entrate" name="Entrate" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="uscite" name="Uscite" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Projection */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Previsione Liquidità (30gg)</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#1A1D27', border: '1px solid #2E3348', borderRadius: 12, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#A855F7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Upcoming Payments + Transaction List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h3 className="text-base font-display font-semibold text-text-primary">Calendario Pagamenti</h3>
          </div>
          <div className="divide-y divide-border/30">
            {upcoming.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-hover transition-colors">
                <div className={`w-2 h-8 rounded-full ${entry.type === 'entrata' ? 'bg-success' : 'bg-error'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{entry.description}</p>
                  <p className="text-xs text-text-muted">{entry.category} • {entry.date}</p>
                </div>
                <span className={`text-sm font-bold ${entry.type === 'entrata' ? 'text-success' : 'text-error'}`}>
                  {entry.type === 'entrata' ? '+' : '-'}{formatCurrency(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <h3 className="text-base font-display font-semibold text-text-primary">Movimenti Recenti</h3>
          </div>
          <div className="divide-y divide-border/30">
            {entries.filter(e => e.status === 'completato').map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-hover transition-colors">
                <div className={`p-1.5 rounded-lg ${entry.type === 'entrata' ? 'bg-success/10' : 'bg-error/10'}`}>
                  {entry.type === 'entrata' ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-error" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{entry.description}</p>
                  <p className="text-xs text-text-muted">{entry.date}</p>
                </div>
                <span className={`text-sm font-bold ${entry.type === 'entrata' ? 'text-success' : 'text-error'}`}>
                  {entry.type === 'entrata' ? '+' : '-'}{formatCurrency(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
