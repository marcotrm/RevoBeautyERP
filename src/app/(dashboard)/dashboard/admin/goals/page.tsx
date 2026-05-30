'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Flag, TrendingUp, CheckCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { useGoalStore } from '@/stores/useGoalStore';
import { EconomicGoal } from '@/lib/admin-data';

const TYPE_ICONS: Record<string, typeof Flag> = { fatturato: TrendingUp, utile: TrendingUp, clienti: Flag, ticket_medio: Flag, marginalita: Flag, vendita_prodotti: Flag };

export default function GoalsPage() {
  const { goals: mockEconomicGoals } = useGoalStore();
  const monthly = mockEconomicGoals.filter(g => g.period === 'mensile');
  const annual = mockEconomicGoals.filter(g => g.period === 'annuale');

  const renderGoal = (goal: EconomicGoal) => {
    const progress = Math.min(100, (goal.current / goal.target) * 100);
    const status = progress >= 100 ? 'superato' : progress >= 70 ? 'in_linea' : 'a_rischio';
    const statusConfig = {
      superato: { bg: 'bg-success/10', text: 'text-success', label: 'Superato ✓', color: '#22C55E' },
      in_linea: { bg: 'bg-info/10', text: 'text-info', label: 'In Linea', color: '#3B82F6' },
      a_rischio: { bg: 'bg-warning/10', text: 'text-warning', label: 'A Rischio', color: '#F59E0B' },
    }[status];

    const formatVal = (v: number) => goal.unit === '€' ? formatCurrency(v) : goal.unit === '%' ? `${v}%` : String(v);
    const remaining = goal.target - goal.current;
    const daysInMonth = 26;
    const daysLeft = 12;
    const dailyNeeded = remaining > 0 ? remaining / daysLeft : 0;

    return (
      <div key={goal.id} className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-border-light transition-all">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-text-primary">{goal.name}</h4>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>{statusConfig.label}</span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-2xl font-display font-bold text-text-primary">{formatVal(goal.current)}</p>
            <p className="text-xs text-text-muted">su {formatVal(goal.target)}</p>
          </div>
          <span className="text-lg font-display font-bold" style={{ color: statusConfig.color }}>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-bg-tertiary overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: statusConfig.color }}
          />
        </div>
        {remaining > 0 && (
          <p className="text-[10px] text-text-muted">
            Mancano {formatVal(Math.round(remaining))} • Serve {formatVal(Math.round(dailyNeeded))}/giorno
          </p>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Obiettivi Economici</h2>
        <p className="text-sm text-text-secondary">KPI, target e previsioni di raggiungimento</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-success">{monthly.filter(g => (g.current / g.target) >= 1).length}</p>
          <p className="text-xs text-text-muted mt-1">Obiettivi Raggiunti</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-info">{monthly.filter(g => { const p = g.current / g.target; return p >= 0.7 && p < 1; }).length}</p>
          <p className="text-xs text-text-muted mt-1">In Linea</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-warning">{monthly.filter(g => (g.current / g.target) < 0.7).length}</p>
          <p className="text-xs text-text-muted mt-1">A Rischio</p>
        </div>
      </div>

      {/* Monthly Goals */}
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary mb-3">Obiettivi Mensili</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthly.map(renderGoal)}
        </div>
      </div>

      {/* Annual Goals */}
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary mb-3">Obiettivi Annuali</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {annual.map(renderGoal)}
        </div>
      </div>
    </motion.div>
  );
}
