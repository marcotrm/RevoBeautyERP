'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Filter, Sparkles, Euro, Users, Activity, Briefcase } from 'lucide-react';
import AIInsightsTab from '@/components/reports/AIInsightsTab';
import RevenueTab from '@/components/reports/RevenueTab';
import TreatmentsTab from '@/components/reports/TreatmentsTab';
import ClientsTab from '@/components/reports/ClientsTab';
import StaffAgendaTab from '@/components/reports/StaffAgendaTab';

type TabId = 'ai' | 'revenue' | 'clients' | 'treatments' | 'staff';

const TABS = [
  { id: 'ai', label: 'AI Insights', icon: Sparkles },
  { id: 'revenue', label: 'Fatturato & Finanza', icon: Euro },
  { id: 'clients', label: 'Clienti & Marketing', icon: Users },
  { id: 'treatments', label: 'Trattamenti & Pacchetti', icon: Activity },
  { id: 'staff', label: 'Staff & Agenda', icon: Briefcase },
] as const;

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('ai');
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary">Business Intelligence</h2>
          <p className="text-sm text-text-secondary mt-1">Dati, statistiche e suggerimenti AI per far crescere il tuo centro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm font-medium text-text-primary focus:outline-none focus:border-accent/50 appearance-none">
            <option>Tutta la catena RevoBeauty</option>
            <option>Milano Centro</option>
            <option>Roma Eur</option>
          </select>
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
            <div className="bg-bg-secondary border border-border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {['Oggi', 'Ieri', 'Questa Settimana', 'Questo Mese', 'Ultimi 3 Mesi', 'Periodo Personalizzato'].map(p => (
                <button key={p} className="px-3 py-2 text-xs font-semibold text-text-secondary border border-border rounded-xl hover:bg-bg-hover hover:text-text-primary transition-colors focus:bg-accent focus:text-white focus:border-accent">
                  {p}
                </button>
              ))}
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
        {activeTab === 'ai' && <AIInsightsTab />}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'clients' && <ClientsTab />}
        {activeTab === 'treatments' && <TreatmentsTab />}
        {activeTab === 'staff' && <StaffAgendaTab />}
      </div>
    </div>
  );
}
