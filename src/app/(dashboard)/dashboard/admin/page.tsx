'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Euro, TrendingUp, TrendingDown, Receipt, Target,
  Users, ShoppingCart, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getTotalFixedCostsMonthly, getFixedCostsByCategory,
  FIXED_COST_CATEGORY_LABELS, FIXED_COST_CATEGORY_COLORS,
} from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useFixedCostStore } from '@/stores/useFixedCostStore';
import { useFinancialStore } from '@/stores/useFinancialStore';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-xl">
      <p className="text-xs font-medium text-text-primary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { fixedCosts: mockFixedCosts } = useFixedCostStore();
  const { monthlyFinancials: mockMonthlyFinancials } = useFinancialStore();

  const current = mockMonthlyFinancials[4] || mockMonthlyFinancials[mockMonthlyFinancials.length - 1]; // Maggio
  const prev = mockMonthlyFinancials[3] || mockMonthlyFinancials[Math.max(0, mockMonthlyFinancials.length - 2)]; // Aprile
  const fixedTotal = getTotalFixedCostsMonthly(mockFixedCosts);
  const costsByCategory = getFixedCostsByCategory(mockFixedCosts);

  const pieData = useMemo(() =>
    Object.entries(costsByCategory).map(([cat, val]) => ({
      name: FIXED_COST_CATEGORY_LABELS[cat] || cat,
      value: Math.round(val),
      color: FIXED_COST_CATEGORY_COLORS[cat] || '#666',
    })),
  [costsByCategory]);

  const pctChange = (curr: number, previous: number) => {
    if (previous === 0) return 0;
    return ((curr - previous) / previous) * 100;
  };

  const kpis = [
    { label: 'Fatturato Mese', value: formatCurrency(current.revenue), change: pctChange(current.revenue, prev.revenue), icon: Euro, color: '#22C55E' },
    { label: 'Utile Netto', value: formatCurrency(current.netProfit), change: pctChange(current.netProfit, prev.netProfit), icon: TrendingUp, color: '#A855F7' },
    { label: 'Totale Costi', value: formatCurrency(current.fixedCosts + current.variableCosts), change: pctChange(current.fixedCosts + current.variableCosts, prev.fixedCosts + prev.variableCosts), icon: Receipt, color: '#EF4444' },
    { label: 'Margine Operativo', value: `${((current.netProfit / current.revenue) * 100).toFixed(1)}%`, change: pctChange(current.netProfit / current.revenue, prev.netProfit / prev.revenue), icon: Target, color: '#3B82F6' },
    { label: 'Costi Fissi', value: formatCurrency(current.fixedCosts), change: 0, icon: Wallet, color: '#F59E0B' },
    { label: 'Costi Variabili', value: formatCurrency(current.variableCosts), change: pctChange(current.variableCosts, prev.variableCosts), icon: ShoppingCart, color: '#EC4899' },
    { label: 'Incasso Medio/Giorno', value: formatCurrency(Math.round(current.revenue / 26)), change: pctChange(current.revenue / 26, prev.revenue / 26), icon: BarChart3, color: '#14B8A6' },
    { label: 'Ticket Medio', value: formatCurrency(current.avgTicket), change: pctChange(current.avgTicket, prev.avgTicket), icon: Users, color: '#6366F1' },
  ];

  const costRatio = ((current.fixedCosts + current.variableCosts) / current.revenue) * 100;
  const alerts = [];
  if (costRatio > 70) alerts.push({ type: 'danger', text: `Costi al ${costRatio.toFixed(0)}% del fatturato — soglia critica superata` });
  else if (costRatio > 60) alerts.push({ type: 'warning', text: `Costi al ${costRatio.toFixed(0)}% del fatturato — attenzione` });
  if (current.netProfit < 0) alerts.push({ type: 'danger', text: 'Utile netto negativo — intervento immediato necessario' });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              alert.type === 'danger' ? 'bg-error/10 border-error/20 text-error' : 'bg-warning/10 border-warning/20 text-warning'
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-bg-secondary border border-border rounded-2xl p-4 hover:border-border-light transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${kpi.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                {kpi.change !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${kpi.change > 0 ? 'text-success' : 'text-error'}`}>
                    {kpi.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(kpi.change).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-lg font-display font-bold text-text-primary">{kpi.value}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Costs Bar Chart */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Fatturato vs Costi</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockMonthlyFinancials} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="monthShort" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Fatturato" fill="#22C55E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fixedCosts" name="Costi Fissi" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="variableCosts" name="Costi Var." fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Distribution Pie */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Incidenza Costi</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-text-secondary">{item.name}</span>
                </div>
                <span className="text-xs font-semibold text-text-primary">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Net Profit Trend */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary mb-4">Andamento Utile Netto</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockMonthlyFinancials} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
              <XAxis dataKey="monthShort" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8B92A5' }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="netProfit" name="Utile Netto" stroke="#A855F7" strokeWidth={2.5} dot={{ r: 4, fill: '#A855F7' }} />
              <Line type="monotone" dataKey="revenue" name="Fatturato" stroke="#22C55E" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
