'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Bot, Phone, MessageSquare, Zap, Gift, Star } from 'lucide-react';
import TelegramAgentConfig from '../settings/TelegramAgentConfig';

interface AgentDef { id: string; name: string; description: string; icon: typeof Bot; color: string; status: 'active' | 'setup' | 'soon' }

const AI_AGENTS: AgentDef[] = [
  { id: 'federica', name: 'Federica — Assistente vocale', description: 'Risponde alle chiamate, dà info su trattamenti e prezzi e fissa appuntamenti in autonomia (ElevenLabs).', icon: Phone, color: '#A855F7', status: 'setup' },
  { id: 'reminder', name: 'Promemoria Appuntamenti', description: 'Invia un WhatsApp al cliente 24h prima dell\'appuntamento per ridurre i no-show.', icon: MessageSquare, color: '#22C55E', status: 'soon' },
  { id: 'recall', name: 'Recupero Clienti', description: 'Contatta automaticamente i clienti che non tornano da oltre 60 giorni con un messaggio di richiamo.', icon: Zap, color: '#F59E0B', status: 'soon' },
  { id: 'birthday', name: 'Auguri Compleanno', description: 'Manda gli auguri (ed eventuale sconto) ai clienti il giorno del loro compleanno.', icon: Gift, color: '#EC4899', status: 'soon' },
  { id: 'review', name: 'Richiesta Recensioni', description: 'Dopo la visita chiede al cliente una recensione su Google per far crescere la reputazione online.', icon: Star, color: '#3B82F6', status: 'soon' },
];

const AGENT_STATUS: Record<AgentDef['status'], { label: string; cls: string }> = {
  active: { label: 'Attivo', cls: 'bg-success/10 text-success' },
  setup: { label: 'Da configurare', cls: 'bg-warning/10 text-warning' },
  soon: { label: 'Prossimamente', cls: 'bg-bg-tertiary text-text-muted' },
};

export default function AutomazioniPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Automazioni & Agenti IA</h2>
        <p className="text-sm text-text-secondary">Assistenti intelligenti che lavorano per te: notifiche, report e promemoria automatici.</p>
      </div>

      {/* Intro */}
      <div className="bg-gradient-to-r from-accent/15 via-pink-500/10 to-transparent border border-accent/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-3 bg-accent/20 rounded-xl text-accent flex-shrink-0"><Sparkles className="w-6 h-6" /></div>
        <div>
          <h3 className="text-base font-display font-bold text-text-primary">Le tue automazioni</h3>
          <p className="text-sm text-text-secondary mt-0.5">Attiva e configura da qui gli agenti. Quello Telegram è già pronto: notifiche ad ogni incasso e report serali automatici.</p>
        </div>
      </div>

      {/* Telegram (attivo) */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Notifiche & Report</h3>
        <TelegramAgentConfig />
      </div>

      {/* Altri agenti */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Altri agenti</h3>
        <div className="space-y-3">
          {AI_AGENTS.map(agent => {
            const Icon = agent.icon;
            const st = AGENT_STATUS[agent.status];
            return (
              <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl bg-bg-secondary border border-border">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${agent.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary">{agent.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{agent.description}</p>
                </div>
                <button disabled={agent.status === 'soon'}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                    agent.status === 'soon' ? 'bg-bg-tertiary text-text-muted cursor-not-allowed' : 'bg-accent/10 text-accent hover:bg-accent/20'
                  }`}>
                  {agent.status === 'setup' ? 'Configura' : agent.status === 'active' ? 'Gestisci' : 'In arrivo'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automazioni finanziarie */}
      <a href="/dashboard/admin/automations" className="flex items-center gap-3 p-4 rounded-xl bg-bg-secondary border border-border hover:border-accent/40 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5" /></div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">Automazioni finanziarie</p>
          <p className="text-xs text-text-muted mt-0.5">Promemoria scadenze, stipendi, tasse e alert su costi/margini.</p>
        </div>
        <span className="text-xs text-accent font-medium">Apri →</span>
      </a>
    </motion.div>
  );
}
