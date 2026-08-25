'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Filter, Sparkles, Euro, Users, Activity, Briefcase } from 'lucide-react';
import AIInsightsTab from '@/components/reports/AIInsightsTab';
import RevenueTab from '@/components/reports/RevenueTab';
import TreatmentsTab from '@/components/reports/TreatmentsTab';
import ClientsTab from '@/components/reports/ClientsTab';
import StaffAgendaTab from '@/components/reports/StaffAgendaTab';
import { getAnalytics, type Analytics, type PeriodoReport } from '@/app/actions/analytics';

type TabId = 'ai' | 'revenue' | 'clients' | 'treatments' | 'staff';

const TABS = [
  { id: 'ai', label: 'AI Insights', icon: Sparkles },
  { id: 'revenue', label: 'Fatturato & Finanza', icon: Euro },
  { id: 'clients', label: 'Clienti & Marketing', icon: Users },
  { id: 'treatments', label: 'Trattamenti & Pacchetti', icon: Activity },
  { id: 'staff', label: 'Staff & Agenda', icon: Briefcase },
] as const;

/* Il giorno di oggi in Italia: i report si leggono di qua, non a Greenwich. */
function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function piu(ymd: string, giorni: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

type ChiaveP = 'tutto' | 'oggi' | 'ieri' | 'settimana' | 'mese' | 'trimestre' | 'scelto';

/** I sei tasti in alto, con il periodo che ognuno vuol dire. */
const PERIODI: { chiave: ChiaveP; label: string; calcola?: () => PeriodoReport }[] = [
  { chiave: 'tutto', label: 'Sempre' },
  { chiave: 'oggi', label: 'Oggi', calcola: () => ({ dal: oggiRoma(), al: oggiRoma() }) },
  { chiave: 'ieri', label: 'Ieri', calcola: () => ({ dal: piu(oggiRoma(), -1), al: piu(oggiRoma(), -1) }) },
  { chiave: 'settimana', label: 'Questa Settimana', calcola: () => {
    const oggi = oggiRoma();
    const g = new Date(`${oggi}T12:00:00Z`).getUTCDay(); // 0=Dom
    const lunedi = piu(oggi, g === 0 ? -6 : 1 - g);
    return { dal: lunedi, al: oggi };
  } },
  { chiave: 'mese', label: 'Questo Mese', calcola: () => ({ dal: `${oggiRoma().slice(0, 7)}-01`, al: oggiRoma() }) },
  { chiave: 'trimestre', label: 'Ultimi 3 Mesi', calcola: () => ({ dal: piu(oggiRoma(), -90), al: oggiRoma() }) },
  { chiave: 'scelto', label: 'Periodo Personalizzato' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('ai');
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  /*
    Il filtro del periodo: prima erano sei tasti senza niente sotto.

    Si premevano, si coloravano un istante e i numeri non si muovevano di un
    euro — e chi guardava il report credeva che "Oggi" avesse incassato quanto
    tutto lo storico del centro.
  */
  const [chiave, setChiave] = useState<ChiaveP>('tutto');
  const [dal, setDal] = useState(() => `${oggiRoma().slice(0, 7)}-01`);
  const [al, setAl] = useState(oggiRoma);

  const periodo: PeriodoReport | null =
    chiave === 'tutto' ? null
      : chiave === 'scelto' ? { dal, al }
      : PERIODI.find(p => p.chiave === chiave)?.calcola?.() || null;

  useEffect(() => {
    let vivo = true;
    // Il "sto calcolando" si accende fuori dal disegno: dentro l'effetto
    // scriverebbe nello stato mentre React sta ancora componendo la pagina.
    const avvio = setTimeout(() => {
      if (!vivo) return;
      setLoading(true);
      getAnalytics(periodo)
        .then(d => { if (vivo) { setData(d); setLoading(false); } })
        .catch(() => { if (vivo) setLoading(false); });
    }, 0);
    return () => { vivo = false; clearTimeout(avvio); };
    // Le date sono già dentro `periodo`, ma come oggetto nuovo a ogni giro:
    // si dipende dai valori, se no il caricamento ripartirebbe all'infinito.
  }, [chiave, dal, al]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary">Business Intelligence</h2>
          <p className="text-sm text-text-secondary mt-1">
            Dati reali del tuo centro, aggiornati in tempo reale.
            {periodo && (
              <span className="text-accent font-medium">
                {' '}· {periodo.dal === periodo.al
                  ? periodo.dal.split('-').reverse().join('/')
                  : `dal ${periodo.dal.split('-').reverse().join('/')} al ${periodo.al.split('-').reverse().join('/')}`}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium ${
              showFilters ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-bg-secondary border-border hover:bg-bg-hover text-text-secondary'
            }`}
          >
            <Filter className="w-4 h-4" /> Filtra Periodo
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white shadow-lg shadow-accent/20 text-sm font-bold hover:shadow-accent/40 transition-all hover:-translate-y-0.5">
            <Download className="w-4 h-4" /> Esporta
          </button>
        </div>
      </div>

      {/* Global Filters Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-bg-secondary border border-border rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {PERIODI.map(p => (
                  <button key={p.chiave} onClick={() => setChiave(p.chiave)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      chiave === p.chiave
                        ? 'bg-accent text-white border-accent'
                        : 'text-text-secondary border-border hover:bg-bg-hover hover:text-text-primary'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {chiave === 'scelto' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-text-secondary">Dal</label>
                  <input type="date" value={dal} max={al} onChange={e => e.target.value && setDal(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
                  <label className="text-xs text-text-secondary">al</label>
                  <input type="date" value={al} min={dal} onChange={e => e.target.value && setAl(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
                </div>
              )}
              {/* Cosa resta fuori dal filtro, detto prima che qualcuno se lo
                  chieda guardando un grafico che non si muove. */}
              <p className="text-[11px] text-text-muted">
                Il periodo taglia incassi, appuntamenti, trattamenti e classifica dello staff.
                Restano su tutto lo storico il grafico degli ultimi sei mesi, il confronto col mese scorso,
                i pacchetti in scadenza e da quanto tempo una cliente non si vede.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto hide-scrollbar pb-2 border-b border-border">
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold whitespace-nowrap transition-colors relative ${
                activeTab === tab.id
                  ? 'text-accent bg-accent/5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-accent' : 'text-text-muted'}`} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="reports-active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {loading || !data ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Calcolo dei dati reali in corso...</p>
          </div>
        ) : (
          <>
            {activeTab === 'ai' && <AIInsightsTab data={data} />}
            {activeTab === 'revenue' && <RevenueTab data={data} />}
            {activeTab === 'clients' && <ClientsTab data={data} />}
            {activeTab === 'treatments' && <TreatmentsTab data={data} />}
            {activeTab === 'staff' && <StaffAgendaTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}
