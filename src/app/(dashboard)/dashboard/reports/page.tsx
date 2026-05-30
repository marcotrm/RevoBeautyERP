'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, Euro, Calendar,
  Download, Filter, ArrowUpDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const revenueByMonth = [
  { month: 'Gen', revenue: 18500 }, { month: 'Feb', revenue: 21200 },
  { month: 'Mar', revenue: 24800 }, { month: 'Apr', revenue: 22100 },
  { month: 'Mag', revenue: 26500 },
];

const treatmentDistribution = [
  { name: 'Viso', value: 32, color: '#8B5CF6' },
  { name: 'Corpo', value: 24, color: '#EC4899' },
  { name: 'Laser', value: 18, color: '#F59E0B' },
  { name: 'Massaggi', value: 15, color: '#22C55E' },
  { name: 'Unghie', value: 8, color: '#3B82F6' },
  { name: 'Altro', value: 3, color: '#6366F1' },
];

const operatorPerformance = [
  { name: 'Sara R.', revenue: 5200, clients: 42, avgTicket: 78, occupancy: 88 },
  { name: 'Valentina B.', revenue: 4800, clients: 38, avgTicket: 82, occupancy: 85 },
  { name: 'Chiara M.', revenue: 4100, clients: 35, avgTicket: 72, occupancy: 78 },
  { name: 'Francesca R.', revenue: 3200, clients: 48, avgTicket: 38, occupancy: 82 },
  { name: 'Alessia C.', revenue: 3850, clients: 30, avgTicket: 85, occupancy: 74 },
];

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-xs text-text-secondary">€ {payload[0]?.value?.toLocaleString('it-IT')}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Report & Analytics</h2>
          <p className="text-sm text-text-secondary">Analisi performance e business intelligence</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-sm font-medium ${
              showFilters ? 'bg-accent/10 border-accent/20 text-accent' : 'border-border hover:bg-bg-hover text-text-secondary'
            }`}
          >
            <Filter className="w-4 h-4" /> Filtra
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-bg-hover text-sm text-text-secondary transition-colors">
            <Download className="w-4 h-4" /> Esporta
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-secondary border border-border rounded-2xl p-4"
        >
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Periodo</label>
            <select className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
              <option>Questo Mese</option>
              <option>Mese Scorso</option>
              <option>Ultimi 3 Mesi</option>
              <option>Quest'Anno</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Operatrice</label>
            <select className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
              <option>Tutte le operatrici</option>
              <option>Sara R.</option>
              <option>Valentina B.</option>
              <option>Chiara M.</option>
              <option>Francesca R.</option>
              <option>Alessia C.</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Categoria</label>
            <select className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
              <option>Tutte le categorie</option>
              <option>Viso</option>
              <option>Corpo</option>
              <option>Laser</option>
              <option>Massaggi</option>
              <option>Unghie</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Fatturato Mese</p>
          <p className="text-2xl font-display font-bold text-text-primary mt-1">€ 26.500</p>
          <p className="text-xs text-success mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +19.9% vs mese scorso</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Clienti Unici</p>
          <p className="text-2xl font-display font-bold text-text-primary mt-1">156</p>
          <p className="text-xs text-success mt-1">+12 nuovi</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Appuntamenti</p>
          <p className="text-2xl font-display font-bold text-text-primary mt-1">342</p>
          <p className="text-xs text-text-muted mt-1">questo mese</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <p className="text-sm text-text-secondary">Margine Netto</p>
          <p className="text-2xl font-display font-bold text-success mt-1">68%</p>
          <p className="text-xs text-text-muted mt-1">€ 18.020</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Fatturato Mensile</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="revenue" fill="#A855F7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Treatment Distribution Pie */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Trattamenti per Categoria</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={treatmentDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {treatmentDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {treatmentDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-text-secondary">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operator Performance Table */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-display font-semibold text-text-primary">Performance Operatrici</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Operatrice</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Fatturato</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Clienti</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Scontrino Medio</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Occupazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {operatorPerformance.map((op, i) => (
                <tr key={i} className="hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-text-primary">{op.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-text-primary">€ {op.revenue.toLocaleString('it-IT')}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-text-primary">{op.clients}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    <span className="text-sm text-text-primary">€ {op.avgTicket}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center hidden md:table-cell">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${op.occupancy}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">{op.occupancy}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
