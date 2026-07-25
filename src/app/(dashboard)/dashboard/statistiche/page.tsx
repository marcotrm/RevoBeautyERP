'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Euro, Users, Calendar, Package, Gift, UserCog, Loader2, Info, BarChart3 } from 'lucide-react';
import { getBusinessKPIs, type KpiGroup, type Kpi } from '@/app/actions/businessStats';

const ICONS: Record<string, React.ElementType> = {
  euro: Euro, users: Users, calendar: Calendar, package: Package, gift: Gift, staff: UserCog,
};

const TONE: Record<string, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-error',
  neutral: 'text-text-primary',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative bg-bg-secondary border border-border rounded-2xl p-4 hover:border-accent/40 transition-all group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{kpi.label}</p>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-text-muted hover:text-accent transition-colors flex-shrink-0"
          aria-label="Cosa significa"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className={`text-2xl font-display font-bold mt-1.5 ${TONE[kpi.tone || 'neutral']}`}>{kpi.value}</p>
      {kpi.sub && <p className="text-xs text-text-muted mt-0.5">{kpi.sub}</p>}

      {/* Legenda / spiegazione */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 p-3 rounded-xl bg-bg-primary border border-border shadow-2xl">
          <p className="text-xs text-text-secondary leading-relaxed">{kpi.hint}</p>
        </div>
      )}
    </div>
  );
}

export default function StatistichePage() {
  const [groups, setGroups] = useState<KpiGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getBusinessKPIs()
      .then(setGroups)
      .catch(e => { console.error(e); setError('Impossibile caricare le statistiche.'); });
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Statistiche</h2>
          <p className="text-sm text-text-secondary">Tutti i numeri del centro, calcolati sui dati reali. Passa sopra una scheda (o tocca ⓘ) per la spiegazione.</p>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{error}</div>}

      {!groups && !error && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo delle statistiche...
        </div>
      )}

      {groups?.map(group => {
        const Icon = ICONS[group.icon] || BarChart3;
        return (
          <div key={group.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-accent" />
              <h3 className="text-base font-display font-semibold text-text-primary">{group.title}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {group.kpis.map(k => <KpiCard key={k.key} kpi={k} />)}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
