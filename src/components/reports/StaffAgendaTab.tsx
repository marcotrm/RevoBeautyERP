'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, UserCheck, XCircle, Clock, Percent, Euro } from 'lucide-react';
import { STAFF_DATA, AGENDA_CABIN_DATA } from '@/lib/reports-mock-data';
import { formatCurrency } from '@/lib/helpers';

export default function StaffAgendaTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Totali', value: AGENDA_CABIN_DATA.totalAppointments, icon: Calendar },
          { label: 'Completati', value: AGENDA_CABIN_DATA.completed, icon: UserCheck, color: 'text-success' },
          { label: 'Cancellati', value: AGENDA_CABIN_DATA.cancelled, icon: XCircle, color: 'text-error' },
          { label: 'Spostati', value: AGENDA_CABIN_DATA.moved, icon: Clock, color: 'text-warning' },
          { label: 'Tasso Canc.', value: AGENDA_CABIN_DATA.cancelRate, icon: Percent, color: 'text-error' },
          { label: 'Riempimento', value: AGENDA_CABIN_DATA.fillRate, icon: Percent, color: 'text-accent' },
        ].map((kpi, i) => (
          <div key={i} className="bg-bg-secondary border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center">
            <kpi.icon className={`w-5 h-5 mb-2 ${kpi.color || 'text-text-secondary'}`} />
            <p className={`text-xl font-display font-bold ${kpi.color || 'text-text-primary'}`}>{kpi.value}</p>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Performance Table */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Performance Operatrici</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Operatrice</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Fatturato</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Appuntamenti</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">Produttività</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {STAFF_DATA.map(staff => (
                  <tr key={staff.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{staff.name}</td>
                    <td className="px-4 py-3 text-sm font-bold text-text-primary text-right">{formatCurrency(staff.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right">{staff.appointments}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                          <div className={`h-full rounded-full ${staff.productivity >= 80 ? 'bg-success' : staff.productivity >= 70 ? 'bg-warning' : 'bg-error'}`} style={{ width: `${staff.productivity}%` }} />
                        </div>
                        <span className="text-xs font-bold text-text-secondary">{staff.productivity}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cabins Usage */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Utilizzo Cabine</h3>
          </div>
          <div className="p-5 space-y-5">
            {AGENDA_CABIN_DATA.cabins.map((cabin, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-text-primary">{cabin.name}</span>
                  <span className="text-xs font-bold text-text-secondary">
                    {cabin.usedHours}h occ. / {cabin.freeHours}h libere
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-text-muted font-medium">Fatturato Generato: <span className="text-text-primary font-bold">{formatCurrency(cabin.revenue)}</span></span>
                  <span className="text-accent font-bold">Sat. {cabin.usePercent}%</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden flex">
                  <div className="h-full bg-accent" style={{ width: `${cabin.usePercent}%` }} />
                  <div className="h-full bg-border" style={{ width: `${100 - cabin.usePercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
