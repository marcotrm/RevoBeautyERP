'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, UserMinus, UserX, Crown } from 'lucide-react';
import type { Analytics } from '@/app/actions/analytics';
import { formatCurrency } from '@/lib/helpers';

export default function ClientsTab({ data }: { data: Analytics }) {
  const CLIENTS_DATA = data.clients;
  const maxSeg = Math.max(1, ...CLIENTS_DATA.segments.map(s => s.count));
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Nuovi', value: CLIENTS_DATA.newClients, icon: Users, color: 'text-accent' },
          { label: 'Attivi', value: CLIENTS_DATA.activeClients, icon: UserCheck, color: 'text-success' },
          { label: 'Inattivi (30g+)', value: CLIENTS_DATA.inactiveClients, icon: UserMinus, color: 'text-warning' },
          { label: 'Persi (90g+)', value: CLIENTS_DATA.lostClients, icon: UserX, color: 'text-error' },
          { label: 'Clienti VIP', value: CLIENTS_DATA.vipClients, icon: Crown, color: 'text-pink-500' },
        ].map((kpi, i) => (
          <div key={i} className="bg-bg-secondary border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-border-light transition-colors">
            <kpi.icon className={`w-6 h-6 mb-2 ${kpi.color}`} />
            <p className="text-2xl font-display font-bold text-text-primary">{kpi.value}</p>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Clients Table */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Migliori Clienti (per spesa)</h3>
          </div>
          <div className="overflow-x-auto">
            {CLIENTS_DATA.topSpenders.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-10">Nessun dato cliente ancora disponibile.</p>
            ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Spesa Totale</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Appuntamenti</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider hidden md:table-cell">Tratt. Preferito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {CLIENTS_DATA.topSpenders.map((c, i) => (
                  <tr key={c.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-text-muted w-4">{i + 1}.</span>
                        <p className="text-sm font-bold text-text-primary">{c.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-text-primary text-right">{formatCurrency(c.totalSpent)}</td>
                    <td className="px-5 py-4 text-sm text-text-secondary text-right">{c.appointments}</td>
                    <td className="px-5 py-4 text-sm text-text-secondary hidden md:table-cell truncate max-w-[150px]">{c.favorite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {/* Segmenti clienti (reali) */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border bg-bg-tertiary/30">
            <h3 className="text-base font-display font-bold text-text-primary">Segmenti Clientela</h3>
          </div>
          <div className="p-5 space-y-4">
            {CLIENTS_DATA.segments.map(seg => (
              <div key={seg.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                    {seg.name}
                  </span>
                  <span className="text-xs font-bold text-text-secondary">{seg.count} clienti</span>
                </div>
                <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ backgroundColor: seg.color, width: `${(seg.count / maxSeg) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
