'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Bell, Mail, Smartphone, MessageSquare, Clock, AlertTriangle, TrendingDown, Wallet, FileText, Calendar } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  description: string;
  channel: 'email' | 'push' | 'whatsapp';
  frequency: string;
  defaultActive: boolean;
  icon: typeof Bell;
}

const automations: Automation[] = [
  { id: 'a1', name: 'Reminder Scadenze Pagamenti', description: 'Notifica 3 giorni prima della scadenza di ogni pagamento', channel: 'push', frequency: 'Quando necessario', defaultActive: true, icon: Calendar },
  { id: 'a2', name: 'Reminder Stipendi', description: 'Promemoria preparazione stipendi il 25 del mese', channel: 'push', frequency: '25 del mese', defaultActive: true, icon: Wallet },
  { id: 'a3', name: 'Reminder Tasse e Contributi', description: 'Avviso scadenze fiscali INPS, INAIL, IVA, F24', channel: 'email', frequency: '5gg prima scadenza', defaultActive: true, icon: FileText },
  { id: 'a4', name: 'Alert Calo Margini', description: 'Avviso se il margine operativo scende sotto il 20%', channel: 'push', frequency: 'Giornaliero', defaultActive: true, icon: TrendingDown },
  { id: 'a5', name: 'Alert Costi Anomali', description: 'Segnalazione se un costo supera il +30% della media', channel: 'push', frequency: 'Quando necessario', defaultActive: false, icon: AlertTriangle },
  { id: 'a6', name: 'Alert Superamento Budget', description: 'Notifica se i costi mensili superano il budget impostato', channel: 'email', frequency: 'Settimanale', defaultActive: true, icon: AlertTriangle },
  { id: 'a7', name: 'Notifiche Cash Flow Negativo', description: 'Avviso se il saldo previsto diventa negativo', channel: 'push', frequency: 'Quando necessario', defaultActive: true, icon: Wallet },
  { id: 'a8', name: 'Report Automatico Settimanale', description: 'Riepilogo economico inviato ogni lunedì mattina', channel: 'email', frequency: 'Ogni lunedì', defaultActive: false, icon: FileText },
  { id: 'a9', name: 'Report Automatico Mensile', description: 'Report completo con analisi e confronti', channel: 'email', frequency: '1° del mese', defaultActive: true, icon: FileText },
];

const CHANNEL_CONFIG: Record<string, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: 'Email', color: '#3B82F6' },
  push: { icon: Smartphone, label: 'Push', color: '#A855F7' },
  whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: '#22C55E' },
};

const recentNotifications = [
  { id: 'n1', title: 'Scadenza INPS Q2', description: 'Pagamento INPS in scadenza tra 5 giorni (€2.850)', time: '2 ore fa', type: 'warning' },
  { id: 'n2', title: 'Budget marketing superato', description: 'Spesa Meta Ads superata del 12% rispetto al budget', time: '1 giorno fa', type: 'danger' },
  { id: 'n3', title: 'Report settimanale generato', description: 'Il report della settimana 21 è disponibile', time: '2 giorni fa', type: 'info' },
  { id: 'n4', title: 'Margine in miglioramento', description: 'Il margine operativo è salito al 30.2% (+2.1%)', time: '3 giorni fa', type: 'success' },
  { id: 'n5', title: 'Stipendi in preparazione', description: 'Preparare i bonifici stipendio entro il 27', time: '4 giorni fa', type: 'warning' },
];

export default function AutomationsPage() {
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>(
    Object.fromEntries(automations.map(a => [a.id, a.defaultActive]))
  );

  const toggle = (id: string) => setActiveMap(prev => ({ ...prev, [id]: !prev[id] }));

  const TYPE_STYLES: Record<string, string> = {
    warning: 'border-l-warning bg-warning/5',
    danger: 'border-l-error bg-error/5',
    info: 'border-l-info bg-info/5',
    success: 'border-l-success bg-success/5',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Automazioni</h2>
        <p className="text-sm text-text-secondary">Reminder, alert e notifiche automatiche</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-success">{Object.values(activeMap).filter(Boolean).length}</p>
          <p className="text-xs text-text-muted mt-1">Attive</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-text-muted">{Object.values(activeMap).filter(v => !v).length}</p>
          <p className="text-xs text-text-muted mt-1">Disattive</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 text-center">
          <p className="text-3xl font-display font-bold text-accent">{automations.length}</p>
          <p className="text-xs text-text-muted mt-1">Totale</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Automations List */}
        <div className="lg:col-span-2 space-y-3">
          {automations.map(auto => {
            const isActive = activeMap[auto.id];
            const channel = CHANNEL_CONFIG[auto.channel];
            const ChannelIcon = channel.icon;
            const Icon = auto.icon;
            return (
              <div key={auto.id} className={`bg-bg-secondary border border-border rounded-2xl p-4 transition-all ${isActive ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-text-primary">{auto.name}</h4>
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${channel.color}15`, color: channel.color }}>
                        <ChannelIcon className="w-3 h-3" />{channel.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{auto.description}</p>
                    <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{auto.frequency}</p>
                  </div>
                  <button onClick={() => toggle(auto.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Notifications */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden h-fit sticky top-4">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="text-base font-display font-semibold text-text-primary">Notifiche Recenti</h3>
          </div>
          <div className="divide-y divide-border/30">
            {recentNotifications.map(n => (
              <div key={n.id} className={`px-5 py-3 border-l-2 ${TYPE_STYLES[n.type]}`}>
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{n.description}</p>
                <p className="text-[10px] text-text-muted mt-1">{n.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
