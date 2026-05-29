'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Users, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';
import {
  mockFixedCosts, mockMonthlyFinancials,
  getTotalFixedCostsMonthly, getBreakEvenData,
} from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';

export default function BreakevenPage() {
  const [costAdjust, setCostAdjust] = useState(0);
  const [staffAdjust, setStaffAdjust] = useState(0);
  const [priceAdjust, setPriceAdjust] = useState(0);

  const current = mockMonthlyFinancials[4]; // Maggio
  const fixedCosts = getTotalFixedCostsMonthly(mockFixedCosts);
  const variableRatio = current.variableCosts / current.revenue;

  const adjustedFixed = fixedCosts * (1 + costAdjust / 100) + (staffAdjust * 1500);
  const adjustedTicket = current.avgTicket * (1 + priceAdjust / 100);

  const be = useMemo(() => getBreakEvenData(adjustedFixed, variableRatio, adjustedTicket), [adjustedFixed, variableRatio, adjustedTicket]);
  const progress = Math.min(100, (current.revenue / be.breakEvenRevenue) * 100);
  const isAbove = current.revenue >= be.breakEvenRevenue;
  const profitProjection = current.revenue - (adjustedFixed + current.variableCosts);

  const trafficLight = progress >= 100 ? 'green' : progress >= 80 ? 'yellow' : 'red';
  const trafficColors = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Punto di Pareggio</h2>
        <p className="text-sm text-text-secondary">Break-even analysis e simulatori</p>
      </div>

      {/* Traffic Light + Main KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="flex gap-2 mb-2">
            {(['red', 'yellow', 'green'] as const).map(c => (
              <div key={c} className={`w-6 h-6 rounded-full transition-all ${trafficLight === c ? 'scale-125 shadow-lg' : 'opacity-30'}`}
                style={{ backgroundColor: trafficColors[c], boxShadow: trafficLight === c ? `0 0 12px ${trafficColors[c]}60` : 'none' }} />
            ))}
          </div>
          <p className="text-xs font-semibold" style={{ color: trafficColors[trafficLight] }}>
            {trafficLight === 'green' ? 'Superato' : trafficLight === 'yellow' ? 'Quasi raggiunto' : 'Sotto soglia'}
          </p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Fatturato Minimo</p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{formatCurrency(Math.round(be.breakEvenRevenue))}</p>
          <p className="text-[11px] text-text-muted">per coprire i costi</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Clienti Necessari</p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{be.breakEvenClients}</p>
          <p className="text-[11px] text-text-muted">al mese</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Trattamenti Necessari</p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{be.breakEvenTreatments}</p>
          <p className="text-[11px] text-text-muted">al mese</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Previsione Utile</p>
          <p className={`text-xl font-display font-bold mt-1 ${profitProjection >= 0 ? 'text-success' : 'text-error'}`}>
            {formatCurrency(Math.round(profitProjection))}
          </p>
          <p className="text-[11px] text-text-muted">fine mese</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-display font-semibold text-text-primary">Andamento Reale vs Obiettivo</h3>
          <span className="text-sm font-bold" style={{ color: trafficColors[trafficLight] }}>{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-4 rounded-full bg-bg-tertiary overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: trafficColors[trafficLight] }}
          />
          <div className="absolute right-2 top-0 h-full flex items-center">
            <div className="w-0.5 h-3 bg-text-muted rounded" />
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-text-muted">
          <span>€ 0</span>
          <span>Break-even: {formatCurrency(Math.round(be.breakEvenRevenue))}</span>
          <span>Attuale: {formatCurrency(current.revenue)}</span>
        </div>
      </div>

      {/* Simulators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Variazione Costi</h4>
          <input type="range" min={-15} max={15} value={costAdjust} onChange={e => setCostAdjust(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>-15%</span>
            <span className={`font-bold ${costAdjust > 0 ? 'text-error' : costAdjust < 0 ? 'text-success' : 'text-text-primary'}`}>
              {costAdjust > 0 ? '+' : ''}{costAdjust}%
            </span>
            <span>+15%</span>
          </div>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Nuove Assunzioni</h4>
          <input type="range" min={0} max={3} value={staffAdjust} onChange={e => setStaffAdjust(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>0</span>
            <span className="font-bold text-text-primary">+{staffAdjust} staff</span>
            <span>+3</span>
          </div>
          {staffAdjust > 0 && <p className="text-[10px] text-text-muted mt-1">+{formatCurrency(staffAdjust * 1500)}/mese</p>}
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Variazione Prezzi</h4>
          <input type="range" min={-10} max={20} value={priceAdjust} onChange={e => setPriceAdjust(Number(e.target.value))}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>-10%</span>
            <span className={`font-bold ${priceAdjust > 0 ? 'text-success' : priceAdjust < 0 ? 'text-error' : 'text-text-primary'}`}>
              {priceAdjust > 0 ? '+' : ''}{priceAdjust}%
            </span>
            <span>+20%</span>
          </div>
          <p className="text-[10px] text-text-muted mt-1">Ticket: {formatCurrency(Math.round(adjustedTicket))}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 flex flex-col justify-center items-center text-center">
          <p className="text-[10px] text-text-muted mb-1">Nuovo Break-even</p>
          <p className="text-lg font-display font-bold text-accent">{formatCurrency(Math.round(be.breakEvenRevenue))}</p>
          <p className="text-[10px] text-text-muted mt-1">{be.breakEvenClients} clienti necessari</p>
          <p className="text-[10px] text-text-muted">{be.breakEvenDays} giorni lavorativi</p>
        </div>
      </div>
    </motion.div>
  );
}
