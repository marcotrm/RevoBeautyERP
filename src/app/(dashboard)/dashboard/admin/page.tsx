'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Euro, TrendingUp, Receipt, Target,
  Users, ShoppingCart, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, Trash2
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import {
  getTotalFixedCostsMonthly, getFixedCostsByCategory,
  FIXED_COST_CATEGORY_LABELS, FIXED_COST_CATEGORY_COLORS,
} from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useFixedCostStore } from '@/stores/useFixedCostStore';
import { useVariableCostStore } from '@/stores/useVariableCostStore';
import { useCashFlowStore } from '@/stores/useCashFlowStore';
import { useFinancialStore } from '@/stores/useFinancialStore';
import { useInvestmentStore } from '@/stores/useInvestmentStore';
import { useGoalStore } from '@/stores/useGoalStore';

type Period = 'oggi' | 'settimana' | 'mese' | 'anno';

export default function AdminDashboardPage() {
  const { fixedCosts } = useFixedCostStore();
  const { variableCosts } = useVariableCostStore();
  const { cashFlowEntries } = useCashFlowStore();
  const [period, setPeriod] = useState<Period>('mese');

  const today = new Date();
  
  // Helpers to check if a date falls into the selected period
  const isDateInPeriod = (dateStr: string, p: Period) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    
    if (p === 'oggi') {
      return d.toDateString() === today.toDateString();
    }
    if (p === 'settimana') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1));
      const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 7));
      return d >= firstDay && d <= lastDay;
    }
    if (p === 'mese') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }
    if (p === 'anno') {
      return d.getFullYear() === today.getFullYear();
    }
    return true;
  };

  const daysInPeriod = useMemo(() => {
    if (period === 'oggi') return 1;
    if (period === 'settimana') return 7;
    if (period === 'mese') return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if (period === 'anno') return 365;
    return 30;
  }, [period]);

  // CALCOLO DINAMICO
  const revenue = useMemo(() => 
    cashFlowEntries.filter(e => e.type === 'entrata' && e.status === 'completato' && isDateInPeriod(e.date, period))
                   .reduce((sum, e) => sum + e.amount, 0)
  , [cashFlowEntries, period]);

  const varCosts = useMemo(() => 
    variableCosts.filter(c => isDateInPeriod(c.date, period))
                 .reduce((sum, c) => sum + c.amount, 0)
  , [variableCosts, period]);

  const totalFixedMonthly = getTotalFixedCostsMonthly(fixedCosts);
  const fixedCostsProRata = (totalFixedMonthly / 30) * daysInPeriod;

  const netProfit = revenue - (varCosts + fixedCostsProRata);
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  
  // Dummy values for avg ticket etc since we don't track clients daily yet
  const avgTicket = 0; 

  const costsByCategory = getFixedCostsByCategory(fixedCosts);
  const pieData = useMemo(() =>
    Object.entries(costsByCategory).map(([cat, val]) => ({
      name: FIXED_COST_CATEGORY_LABELS[cat] || cat,
      value: Math.round(val),
      color: FIXED_COST_CATEGORY_COLORS[cat] || '#666',
    })),
  [costsByCategory]);

  const kpis = [
    { label: 'Fatturato', value: formatCurrency(revenue), icon: Euro, color: '#22C55E' },
    { label: 'Utile Netto', value: formatCurrency(netProfit), icon: TrendingUp, color: '#A855F7' },
    { label: 'Totale Costi', value: formatCurrency(fixedCostsProRata + varCosts), icon: Receipt, color: '#EF4444' },
    { label: 'Margine Operativo', value: `${margin.toFixed(1)}%`, icon: Target, color: '#3B82F6' },
    { label: 'Costi Fissi (Pro-rata)', value: formatCurrency(fixedCostsProRata), icon: Wallet, color: '#F59E0B' },
    { label: 'Costi Variabili', value: formatCurrency(varCosts), icon: ShoppingCart, color: '#EC4899' },
    { label: 'Incasso Medio/Giorno', value: formatCurrency(Math.round(revenue / (period === 'oggi' ? 1 : period === 'settimana' ? 6 : 26))), icon: BarChart3, color: '#14B8A6' },
    { label: 'Ticket Medio', value: formatCurrency(avgTicket), icon: Users, color: '#6366F1' },
  ];

  const costRatio = revenue > 0 ? ((fixedCostsProRata + varCosts) / revenue) * 100 : 0;
  const alerts = [];
  if (costRatio > 70 && revenue > 0) alerts.push({ type: 'danger', text: `Costi al ${costRatio.toFixed(0)}% del fatturato — soglia critica superata` });
  else if (costRatio > 60 && revenue > 0) alerts.push({ type: 'warning', text: `Costi al ${costRatio.toFixed(0)}% del fatturato — attenzione` });
  if (netProfit < 0 && revenue > 0) alerts.push({ type: 'danger', text: 'Utile netto negativo — intervento immediato necessario' });

  const resetAllData = () => {
    if (window.confirm("Sei sicuro di voler azzerare TUTTI i dati? L'operazione è irreversibile e pulirà la cache del tuo browser.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Dashboard Amministrativa</h2>
          <p className="text-sm text-text-secondary">Visione d'insieme calcolata in tempo reale</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-bg-secondary p-1 rounded-xl border border-border">
            {(['oggi', 'settimana', 'mese', 'anno'] as Period[]).map((p) => (
              <button 
                key={p} 
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${period === p ? 'bg-accent text-white shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={resetAllData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error/10 text-error hover:bg-error/20 text-xs font-semibold transition-all">
            <Trash2 className="w-4 h-4" />
            Azzera Dati
          </button>
        </div>
      </div>

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
              </div>
              <p className="text-lg font-display font-bold text-text-primary">{kpi.value}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Distribution Pie */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 lg:col-span-1">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Incidenza Costi Fissi</h3>
          {pieData.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-text-muted text-sm">
              Nessun costo fisso presente.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
