'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Euro, CreditCard } from 'lucide-react';
import { REVENUE_DATA, REVENUE_BY_MONTH, REVENUE_BY_PAYMENT } from '@/lib/reports-mock-data';
import { formatCurrency } from '@/lib/helpers';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-text-secondary">{p.name}: </span>
          <span className="text-xs font-bold text-text-primary">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Fatturato Oggi', value: REVENUE_DATA.daily, trend: '+5%', isGood: true },
          { label: 'Questa Settimana', value: REVENUE_DATA.weekly, trend: '+12%', isGood: true },
          { label: 'Questo Mese', value: REVENUE_DATA.monthly, trend: '+14%', isGood: true },
          { label: 'Ticket Medio', value: REVENUE_DATA.avgTicket, trend: '-2%', isGood: false },
        ].map((kpi, i) => (
          <div key={i} className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-accent/30 transition-colors">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{kpi.label}</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-2">{formatCurrency(kpi.value)}</p>
            <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${kpi.isGood ? 'text-success' : 'text-error'}`}>
              {kpi.isGood ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {kpi.trend}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-display font-semibold text-text-primary">Fatturato vs Costi (Ultimi 6 Mesi)</h3>
            <select className="px-3 py-1.5 bg-bg-tertiary border border-border rounded-lg text-xs text-text-primary focus:outline-none">
              <option>Fatturato Totale</option>
              <option>Per Cabina</option>
              <option>Per Operatrice</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_BY_MONTH} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} tickFormatter={(v) => `€${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" name="Fatturato" dataKey="revenue" stroke="#A855F7" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" name="Costi" dataKey="costs" stroke="#EC4899" strokeWidth={2} fillOpacity={0} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-6 flex flex-col">
          <h3 className="text-base font-display font-semibold text-text-primary mb-2">Metodi di Pagamento</h3>
          <p className="text-xs text-text-secondary mb-6">Distribuzione incassi mensili</p>
          
          <div className="h-[200px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={REVENUE_BY_PAYMENT} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {REVENUE_BY_PAYMENT.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val: any) => formatCurrency(val)} contentStyle={{ backgroundColor: '#1C1F2E', borderColor: '#2E3348', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 mt-auto">
            {REVENUE_BY_PAYMENT.map(p => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-medium text-text-primary">{p.name}</span>
                </div>
                <span className="text-xs font-bold text-text-primary">{formatCurrency(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
