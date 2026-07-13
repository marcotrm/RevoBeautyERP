'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, UserCheck, XCircle, Percent, Ban } from 'lucide-react';
import type { Analytics } from '@/app/actions/analytics';
import { formatCurrency } from '@/lib/helpers';

export default function StaffAgendaTab({ data }: { data: Analytics }) {
  const STAFF_DATA = data.staff;
  const AGENDA = data.agenda;
  const STAFF_HOURS = data.staffHours;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Totali', value: AGENDA.totalAppointments, icon: Calendar },
          { label: 'Completati', value: AGENDA.completed, icon: UserCheck, color: 'text-success' },
          { label: 'Annullati', value: AGENDA.cancelled, icon: XCircle, color: 'text-error' },
          { label: 'No-Show', value: AGENDA.noShow, icon: Ban, color: 'text-error' },
          { label: 'Tasso Canc.', value: `${AGENDA.cancelRate}%`, icon: Percent, color: 'text-error' },
          { label: 'Completamento', value: `${AGENDA.completionRate}%`, icon: Percent, color: 'text-accent' },
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
                {STAFF_DATA.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">Nessuna operatrice registrata</td></tr>
                ) : STAFF_DATA.map(staff => (
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

        {/* Ore lavorate vs contratto */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Ore erogate vs contratto</h3>
            <p className="text-xs text-text-muted mt-0.5">Ore di trattamenti completati sul totale ore da contratto</p>
          </div>
          <div className="p-5 space-y-5">
            {STAFF_HOURS.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">Nessuna operatrice registrata</p>
            ) : STAFF_HOURS.map((s, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-text-primary">{s.name}</span>
                  <span className="text-xs font-bold text-text-secondary">
                    {s.workedHours}h {s.contract > 0 ? `/ ${s.contract}h` : ''}
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden flex">
                  <div className="h-full bg-accent" style={{ width: `${s.usePercent}%` }} />
                  <div className="h-full bg-border" style={{ width: `${100 - s.usePercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
