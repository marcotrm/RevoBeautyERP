'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Package, Activity, Search } from 'lucide-react';
import type { Analytics } from '@/app/actions/analytics';
import { formatCurrency } from '@/lib/helpers';

export default function TreatmentsTab({ data }: { data: Analytics }) {
  const PACKAGES_DATA = data.packages;
  const classifica = data.treatments.classifica;
  const [cerca, setCerca] = useState('');
  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return q ? classifica.filter(t => t.name.toLowerCase().includes(q)) : classifica;
  }, [classifica, cerca]);
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

      {/*
        La classifica intera, non le prime cinque.

        Cinque righe dicono quali vanno forte e cinque quali no; in mezzo
        c'era il resto del listino — cioè quasi tutto — e per sapere dove
        stava un trattamento bisognava fidarsi a memoria. Qui ci sono tutti,
        in ordine, con la ricerca per arrivarci subito.
      */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border bg-bg-tertiary/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-display font-bold text-text-primary">Classifica trattamenti</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {classifica.length} trattamenti fatti nel periodo, dal più richiesto all&apos;ultimo
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca un trattamento…"
              className="pl-9 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 w-56" />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-bg-secondary z-10">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider">Trattamento</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Sedute</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Fatturato</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right hidden sm:table-cell">Prezzo medio</th>
                <th className="px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtrati.map((t, i) => {
                const posizione = classifica.findIndex(x => x.id === t.id) + 1;
                return (
                  <tr key={t.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-text-muted tabular-nums">{posizione}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-text-primary">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right tabular-nums">{t.count}</td>
                    <td className="px-4 py-3 text-sm font-bold text-text-primary text-right tabular-nums">{formatCurrency(t.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary text-right tabular-nums hidden sm:table-cell">{formatCurrency(t.avgPrice)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      <span className={t.trend === '—' ? 'text-text-muted' : t.trend.startsWith('+') ? 'text-success' : 'text-error'}>{t.trend}</span>
                    </td>
                  </tr>
                );
              })}
              {filtrati.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                  {classifica.length === 0 ? 'Nessun trattamento fatto nel periodo scelto.' : 'Nessun trattamento con questo nome.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </motion.div>
  );
}
