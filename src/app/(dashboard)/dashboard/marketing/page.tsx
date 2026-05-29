'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Mail, MessageSquare, Phone as PhoneIcon,
  Zap, Users, Clock, Target, Plus, X, CheckCircle,
  Gift, Heart, Trash2, Send, Eye,
} from 'lucide-react';

interface Campaign {
  id: number; name: string; type: string; status: string; sent: number; opened: number; converted: number; color: string; target?: string; message?: string;
}

const defaultCampaigns: Campaign[] = [
  { id: 1, name: 'Recall Clienti Dormienti', type: 'WhatsApp', status: 'active', sent: 45, opened: 32, converted: 8, color: '#22C55E' },
  { id: 2, name: 'Promo Laser Estate 2025', type: 'Email', status: 'active', sent: 120, opened: 68, converted: 15, color: '#3B82F6' },
  { id: 3, name: 'Auguri Compleanno Maggio', type: 'SMS', status: 'completed', sent: 18, opened: 18, converted: 6, color: '#EC4899' },
  { id: 4, name: 'Lancio Membership Gold', type: 'Email', status: 'draft', sent: 0, opened: 0, converted: 0, color: '#F59E0B' },
];

interface Automation {
  name: string; trigger: string; channel: string; active: boolean; icon: React.ElementType;
}

const defaultAutomations: Automation[] = [
  { name: 'Reminder Appuntamento', trigger: '24h prima', channel: 'WhatsApp', active: true, icon: Clock },
  { name: 'Auguri Compleanno', trigger: 'Giorno del compleanno', channel: 'SMS + Email', active: true, icon: Gift },
  { name: 'Recall Dormiente', trigger: 'Dopo 60 giorni', channel: 'WhatsApp', active: true, icon: Heart },
  { name: 'Richiesta Recensione', trigger: 'Dopo visita', channel: 'WhatsApp', active: false, icon: Target },
  { name: 'Benvenuto Nuovo Cliente', trigger: 'Alla registrazione', channel: 'Email', active: true, icon: Users },
];

const CAMPAIGN_TYPES = [
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare, color: '#22C55E' },
  { value: 'Email', label: 'Email', icon: Mail, color: '#3B82F6' },
  { value: 'SMS', label: 'SMS', icon: PhoneIcon, color: '#EC4899' },
];

const TARGETS = [
  { value: 'all', label: 'Tutti i clienti' },
  { value: 'vip', label: 'Solo VIP' },
  { value: 'dormant', label: 'Clienti dormienti (60+ giorni)' },
  { value: 'new', label: 'Nuovi clienti (ultimi 30 giorni)' },
  { value: 'birthday', label: 'Compleanno questo mese' },
  { value: 'active', label: 'Clienti attivi' },
];

function NewCampaignModal({ onClose, onSave }: { onClose: () => void; onSave: (c: Campaign) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('WhatsApp');
  const [target, setTarget] = useState('all');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'info' | 'message' | 'review'>('info');

  const typeInfo = CAMPAIGN_TYPES.find(t => t.value === type)!;
  const canNext = step === 'info' ? name.trim() : step === 'message' ? message.trim() : true;

  const handleSave = (asDraft: boolean) => {
    onSave({
      id: Date.now(), name: name.trim(), type, status: asDraft ? 'draft' : 'active',
      sent: 0, opened: 0, converted: 0, color: typeInfo.color,
      target, message,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-display font-semibold text-text-primary">Nuova Campagna</h3>
              <div className="flex gap-1">
                {(['info', 'message', 'review'] as const).map((s, i) => (
                  <div key={s} className={`w-2 h-2 rounded-full transition-all ${step === s ? 'bg-accent w-6' : 'bg-bg-tertiary'}`} />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            {step === 'info' && (
              <>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome Campagna *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Promo Estate, Recall Clienti..."
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Canale</label>
                  <div className="grid grid-cols-3 gap-3">
                    {CAMPAIGN_TYPES.map(ct => {
                      const Icon = ct.icon;
                      return (
                        <button key={ct.value} onClick={() => setType(ct.value)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${type === ct.value ? 'border-current shadow-md' : 'border-border hover:border-border-light'}`}
                          style={type === ct.value ? { borderColor: ct.color } : {}}>
                          <Icon className="w-6 h-6" style={{ color: ct.color }} />
                          <span className={`text-xs font-medium ${type === ct.value ? 'text-text-primary' : 'text-text-secondary'}`}>{ct.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Target</label>
                  <select value={target} onChange={e => setTarget(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                    {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </>
            )}

            {step === 'message' && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-tertiary/50">
                  <typeInfo.icon className="w-4 h-4" style={{ color: typeInfo.color }} />
                  <span className="text-sm font-medium text-text-primary">{name}</span>
                  <span className="text-xs text-text-muted ml-auto">{typeInfo.label}</span>
                </div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Messaggio *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                    placeholder={type === 'SMS' ? 'Max 160 caratteri...' : 'Scrivi il contenuto della campagna...\n\nUsa {nome}, {cognome}, {centro} come variabili'}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" />
                  {type === 'SMS' && <p className={`text-xs mt-1 ${message.length > 160 ? 'text-error' : 'text-text-muted'}`}>{message.length}/160 caratteri</p>}
                </div>
                {message.trim() && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-bg-tertiary/50 border-b border-border flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Anteprima</span>
                    </div>
                    <div className="px-4 py-3"><p className="text-sm text-text-primary leading-relaxed">{message.replace('{nome}', 'Maria').replace('{cognome}', 'Rossi').replace('{centro}', 'Revobeauty Milano')}</p></div>
                  </div>
                )}
              </>
            )}

            {step === 'review' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${typeInfo.color}15` }}><typeInfo.icon className="w-5 h-5" style={{ color: typeInfo.color }} /></div>
                    <div><p className="text-base font-semibold text-text-primary">{name}</p><p className="text-xs text-text-muted">{typeInfo.label} • {TARGETS.find(t => t.value === target)?.label}</p></div>
                  </div>
                  <div className="border-t border-border pt-3"><p className="text-sm text-text-secondary leading-relaxed">{message}</p></div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/5 border border-warning/10 text-xs text-warning">
                  <Megaphone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Controlla attentamente prima di inviare. La campagna verrà inviata a tutti i destinatari selezionati.</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-bg-tertiary/30">
            {step === 'info' ? (
              <>
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
                <button onClick={() => setStep('message')} disabled={!canNext}
                  className={`px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canNext ? 'gradient-accent hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>Avanti →</button>
              </>
            ) : step === 'message' ? (
              <>
                <button onClick={() => setStep('info')} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">← Indietro</button>
                <button onClick={() => setStep('review')} disabled={!canNext}
                  className={`px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canNext ? 'gradient-accent hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>Avanti →</button>
              </>
            ) : (
              <>
                <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Salva Bozza</button>
                <button onClick={() => handleSave(false)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                  <Send className="w-4 h-4" /> Invia Campagna
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState(defaultCampaigns);
  const [automations, setAutomations] = useState(defaultAutomations);
  const [showModal, setShowModal] = useState(false);

  const toggleAutomation = (index: number) => {
    setAutomations(prev => prev.map((a, i) => i === index ? { ...a, active: !a.active } : a));
  };

  const deleteCampaign = (id: number) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalConverted = campaigns.reduce((s, c) => s + c.converted, 0);
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Marketing & Automazioni</h2>
          <p className="text-sm text-text-secondary">Campagne, recall e comunicazioni automatiche</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
          <Plus className="w-4 h-4" /> Nuova Campagna
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Messaggi Inviati</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{totalSent.toLocaleString()}</p><p className="text-xs text-text-muted mt-1">questo mese</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Tasso Apertura</p><p className="text-2xl font-display font-bold text-success mt-1">{openRate}%</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Conversioni</p><p className="text-2xl font-display font-bold text-accent mt-1">{totalConverted}</p><p className="text-xs text-text-muted mt-1">prenotazioni generate</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Campagne Attive</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{campaigns.filter(c => c.status === 'active').length}</p></div>
      </div>

      {/* Campaigns */}
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary mb-3">Campagne</h3>
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="bg-bg-secondary border border-border rounded-2xl p-4 hover:border-border-light transition-all group">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${campaign.color}15`, color: campaign.color }}>
                  {campaign.type === 'WhatsApp' ? <MessageSquare className="w-5 h-5" /> : campaign.type === 'Email' ? <Mail className="w-5 h-5" /> : <PhoneIcon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{campaign.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      campaign.status === 'active' ? 'bg-success/10 text-success' : campaign.status === 'completed' ? 'bg-bg-tertiary text-text-muted' : 'bg-warning/10 text-warning'
                    }`}>{campaign.status === 'active' ? 'Attiva' : campaign.status === 'completed' ? 'Completata' : 'Bozza'}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{campaign.type}</p>
                </div>
                {campaign.sent > 0 && (
                  <div className="hidden md:flex items-center gap-6 text-center">
                    <div><p className="text-sm font-semibold text-text-primary">{campaign.sent}</p><p className="text-[10px] text-text-muted">Inviati</p></div>
                    <div><p className="text-sm font-semibold text-text-primary">{campaign.opened}</p><p className="text-[10px] text-text-muted">Aperti</p></div>
                    <div><p className="text-sm font-semibold text-accent">{campaign.converted}</p><p className="text-[10px] text-text-muted">Convertiti</p></div>
                  </div>
                )}
                <button onClick={() => deleteCampaign(campaign.id)} className="p-2 rounded-xl hover:bg-error/10 text-text-muted hover:text-error transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="text-center py-10 bg-bg-secondary border border-border rounded-2xl">
              <Megaphone className="w-10 h-10 text-text-muted mx-auto mb-2" />
              <p className="text-text-secondary font-medium">Nessuna campagna</p>
              <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-accent font-medium hover:underline">Crea la prima campagna</button>
            </div>
          )}
        </div>
      </div>

      {/* Automations */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-warning" /><h3 className="text-base font-display font-semibold text-text-primary">Automazioni</h3></div>
          <span className="text-xs text-text-muted">{automations.filter(a => a.active).length}/{automations.length} attive</span>
        </div>
        <div className="divide-y divide-border/30">
          {automations.map((auto, i) => {
            const Icon = auto.icon;
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors">
                <div className={`p-2 rounded-lg transition-colors ${auto.active ? 'bg-accent/10 text-accent' : 'bg-bg-tertiary text-text-muted'}`}><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${auto.active ? 'text-text-primary' : 'text-text-muted'}`}>{auto.name}</p>
                  <p className="text-xs text-text-secondary">{auto.trigger} • {auto.channel}</p>
                </div>
                <button onClick={() => toggleAutomation(i)}
                  className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${auto.active ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${auto.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>{showModal && <NewCampaignModal onClose={() => setShowModal(false)} onSave={c => { setCampaigns(prev => [c, ...prev]); setShowModal(false); }} />}</AnimatePresence>
    </motion.div>
  );
}
