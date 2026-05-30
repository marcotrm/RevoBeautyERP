'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Package, Activity } from 'lucide-react';
import { TREATMENTS_DATA, PACKAGES_DATA } from '@/lib/reports-mock-data';
import { formatCurrency } from '@/lib/helpers';

export default function TreatmentsTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pacchetti Venduti', value: PACKAGES_DATA.sold, icon: Package },
          { label: 'Sedute Erogate', value: PACKAGES_DATA.usedSessions, icon: Activity },
          { label: 'Pacchetti in Scadenza', value: PACKAGES_DATA.expiring, icon: TrendingDown, color: 'text-warning' },
          { label: 'Valore da Erogare', value: formatCurrency(PACKAGES_DATA.residualValue), icon: TrendingUp, color: 'text-accent' },
        ].map((kpi, i) => (
          <div key={i} className="bg-bg-secondary border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-3 bg-bg-tertiary rounded-xl ${kpi.color || 'text-text-primary'}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-xl font-display font-bold mt-1 ${kpi.color || 'text-text-primary'}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sold Treatments */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Top 5 Trattamenti (Più Venduti)</h3>
          </div>
          <div className="p-2 flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Trattamento</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Sedute</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Fatturato</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {TREATMENTS_DATA.topSold.map(t => (
                  <tr key={t.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right">{t.count}</td>
                    <td className="px-4 py-3 text-sm font-bold text-text-primary text-right">{formatCurrency(t.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      <span className={t.trend.startsWith('+') ? 'text-success' : 'text-error'}>{t.trend}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Least Sold Treatments */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Trattamenti Meno Richiesti</h3>
          </div>
          <div className="p-2 flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Trattamento</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Sedute</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Fatturato</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {TREATMENTS_DATA.leastSold.map(t => (
                  <tr key={t.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right">{t.count}</td>
                    <td className="px-4 py-3 text-sm font-bold text-text-primary text-right">{formatCurrency(t.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-error">{t.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
