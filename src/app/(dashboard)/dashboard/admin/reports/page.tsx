'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Users, Scissors } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FIXED_COST_CATEGORY_LABELS, getFixedCostsByCategory, FIXED_COST_CATEGORY_COLORS } from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useFixedCostStore } from '@/stores/useFixedCostStore';
import { useFinancialStore } from '@/stores/useFinancialStore';
import { getAnalytics, type Analytics } from '@/app/actions/analytics';

const PERIODS = ['Mensile', 'Trimestrale', 'Annuale'];

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('Mensile');
  const { fixedCosts: mockFixedCosts } = useFixedCostStore();
  const { monthlyFinancials: mockMonthlyFinancials } = useFinancialStore();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => { getAnalytics().then(setAnalytics).catch(() => {}); }, []);

  const topTreatments = (analytics?.treatments.topSold || []).map(t => ({ name: t.name, revenue: t.revenue, count: t.count }));
  const topStaff = (analytics?.staff || []).filter(s => s.revenue > 0 || s.appointments > 0).map(s => ({ name: s.name, revenue: s.revenue, treatments: s.completed }));

  const byCategory = getFixedCostsByCategory(mockFixedCosts);
  const costRanking = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => ({
    name: FIXED_COST_CATEGORY_LABELS[cat], value: Math.round(val), color: FIXED_COST_CATEGORY_COLORS[cat],
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Report e Analisi</h2>
          <p className="text-sm text-text-secondary">Analisi dettagliate e classifiche</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-bg-secondary text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
            <Download className="w-4 h-4" /> Esporta PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" /> Esporta Excel
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Ranking */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Classifica Costi più Alti</h3>
          <div className="space-y-3">
            {costRanking.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-muted w-5">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{item.name}</span>
                    <span className="text-sm font-bold text-text-primary">{formatCurrency(item.value)}/mese</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(item.value / costRanking[0].value) * 100}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Month Chart */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Andamento Fatturato</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockMonthlyFinancials}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="monthShort" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#1A1D27', border: '1px solid #2E3348', borderRadius: 12, fontSize: 12 }} formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenue" name="Fatturato" fill="#A855F7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Treatments */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Scissors className="w-4 h-4 text-accent" />
            <h3 className="text-base font-display font-semibold text-text-primary">Trattamenti più Redditizi</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-text-muted uppercase">Trattamento</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-muted uppercase">Fatturato</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-text-muted uppercase">N°</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {topTreatments.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-text-muted">Nessun dato ancora</td></tr>
              ) : topTreatments.map(t => (
                <tr key={t.name} className="hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-text-primary">{t.name}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-text-primary text-right">{formatCurrency(t.revenue)}</td>
                  <td className="px-5 py-3 text-sm text-text-secondary text-right">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Staff */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="text-base font-display font-semibold text-text-primary">Dipendente più Produttivo</h3>
          </div>
          <div className="divide-y divide-border/30">
            {topStaff.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">Nessun dato ancora</div>}
            {topStaff.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-hover transition-colors">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-accent' : 'bg-bg-tertiary text-text-muted'}`}>{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{s.name}</p>
                  <p className="text-xs text-text-muted">{s.treatments} trattamenti</p>
                </div>
                <span className="text-sm font-bold text-text-primary">{formatCurrency(s.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
