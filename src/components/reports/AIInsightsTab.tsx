'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Users, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AI_INSIGHTS } from '@/lib/reports-mock-data';

export default function AIInsightsTab() {
  const [actionStates, setActionStates] = useState<Record<number, 'idle' | 'loading' | 'done'>>({});

  const handleAction = (index: number) => {
    if (actionStates[index] === 'done') return;
    setActionStates(prev => ({ ...prev, [index]: 'loading' }));
    setTimeout(() => {
      setActionStates(prev => ({ ...prev, [index]: 'done' }));
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-gradient-to-r from-accent/20 via-pink-500/10 to-accent/5 border border-accent/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="p-3 bg-accent/20 rounded-xl text-accent shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-text-primary mb-1">Revo AI Business Intelligence</h3>
            <p className="text-sm text-text-secondary max-w-2xl">
              L'Intelligenza Artificiale analizza costantemente i dati del tuo centro. Ecco le scoperte più importanti di oggi per massimizzare i profitti e ridurre gli sprechi.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h4 className="flex items-center gap-2 text-base font-bold text-success mb-4">
            <ShieldCheck className="w-5 h-5" /> Punti di Forza
          </h4>
          <ul className="space-y-3">
            {AI_INSIGHTS.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary bg-success/5 p-3 rounded-xl border border-success/10">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h4 className="flex items-center gap-2 text-base font-bold text-error mb-4">
            <AlertTriangle className="w-5 h-5" /> Problemi da Correggere
          </h4>
          <ul className="space-y-3">
            {AI_INSIGHTS.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary bg-error/5 p-3 rounded-xl border border-error/10">
                <div className="w-1.5 h-1.5 rounded-full bg-error mt-1.5 flex-shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="text-lg font-display font-bold text-text-primary mt-8 mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-accent" /> Piani d'Azione Consigliati
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AI_INSIGHTS.actions.map((action, i) => {
          let color = '';
          let Icon = Info;
          if (action.type === 'warning') { color = 'warning'; Icon = AlertTriangle; }
          if (action.type === 'success') { color = 'success'; Icon = TrendingUp; }
          if (action.type === 'info') { color = 'accent'; Icon = Users; }

          return (
            <div key={i} className={`bg-bg-secondary border border-${color}/20 rounded-2xl p-5 relative overflow-hidden group hover:border-${color}/40 transition-colors`}>
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}/5 rounded-full blur-[40px] pointer-events-none translate-x-1/3 -translate-y-1/3 group-hover:bg-${color}/10 transition-colors`} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 text-${color}`} />
                  <h4 className="text-sm font-bold text-text-primary">{action.title}</h4>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{action.message}</p>
                <button 
                  onClick={() => handleAction(i)}
                  disabled={actionStates[i] === 'loading' || actionStates[i] === 'done'}
                  className={`mt-4 text-xs font-bold ${actionStates[i] === 'done' ? 'text-success' : `text-${color}`} flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {actionStates[i] === 'loading' ? (
                    <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Esecuzione AI in corso...</>
                  ) : actionStates[i] === 'done' ? (
                    <><CheckCircle2 className="w-4 h-4" /> Azione Applicata</>
                  ) : (
                    <>Applica Azione Ora &rarr;</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
