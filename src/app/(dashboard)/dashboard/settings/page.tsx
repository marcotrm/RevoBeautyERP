'use client';

import React, { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Building2, Clock, Palette, Shield,
  Bell, Globe, CreditCard,
  ChevronRight, Save, Plus, Search, X, CheckCircle,
} from 'lucide-react';
import { useThemeStore } from '@/stores/useThemeStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { formatCurrency, getCategoryLabel } from '@/lib/helpers';
import { Treatment, TreatmentCategory } from '@/types';

const settingSections = [
  { id: 'general', label: 'Centro', icon: Building2, description: 'Nome, indirizzo, contatti' },
  { id: 'hours', label: 'Orari', icon: Clock, description: 'Orari apertura e chiusura' },
  { id: 'appearance', label: 'Aspetto', icon: Palette, description: 'Tema, colori, logo' },
  { id: 'notifications', label: 'Notifiche', icon: Bell, description: 'Email, SMS, push' },
  { id: 'roles', label: 'Ruoli e Permessi', icon: Shield, description: 'Accessi e autorizzazioni' },
  { id: 'billing', label: 'Fatturazione', icon: CreditCard, description: 'Dati fiscali, scontrini' },
  { id: 'integrations', label: 'Integrazioni', icon: Globe, description: 'API, webhook, servizi' },
];

const weekDays = [
  { day: 'Lunedì', open: '09:00', close: '20:00', isOpen: true },
  { day: 'Martedì', open: '09:00', close: '20:00', isOpen: true },
  { day: 'Mercoledì', open: '09:00', close: '20:00', isOpen: true },
  { day: 'Giovedì', open: '10:00', close: '21:00', isOpen: true },
  { day: 'Venerdì', open: '09:00', close: '20:00', isOpen: true },
  { day: 'Sabato', open: '09:00', close: '18:00', isOpen: true },
  { day: 'Domenica', open: '', close: '', isOpen: false },
];




const notifications = [
  { name: 'Reminder appuntamento (24h)', channel: 'WhatsApp', active: true },
  { name: 'Reminder appuntamento (2h)', channel: 'SMS', active: true },
  { name: 'Conferma prenotazione', channel: 'Email', active: true },
  { name: 'Cancellazione appuntamento', channel: 'Email', active: true },
  { name: 'Auguri compleanno', channel: 'WhatsApp', active: true },
  { name: 'Recall cliente dormiente', channel: 'WhatsApp', active: false },
  { name: 'Scorta prodotto bassa', channel: 'Email (staff)', active: true },
  { name: 'Nuovo appuntamento online', channel: 'Push + Email', active: true },
  { name: 'Pagamento ricevuto', channel: 'Email', active: false },
  { name: 'Report giornaliero', channel: 'Email (titolare)', active: true },
];

// =============================================
// PERMISSION MODULES — tutte le categorie 1:1
// =============================================
// =============================================
// APPEARANCE SECTION — tema e colori funzionanti
// =============================================
const ACCENT_COLORS = [
  { hex: '#A855F7', name: 'Viola' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#3B82F6', name: 'Blu' },
  { hex: '#22C55E', name: 'Verde' },
  { hex: '#F59E0B', name: 'Ambra' },
  { hex: '#EF4444', name: 'Rosso' },
  { hex: '#6366F1', name: 'Indaco' },
  { hex: '#14B8A6', name: 'Teal' },
];

function AppearanceSection() {
  const { isDark, toggleTheme, accentColor, setAccentColor, logoUrl, setLogoUrl } = useThemeStore();
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    const root = document.documentElement;
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = sizes[size];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Il file è troppo grande. Max 2MB.'); return; }
    if (!file.type.startsWith('image/')) { alert('Seleziona un file immagine (PNG, JPG).'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoUrl(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Tema Chiaro/Scuro */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-display font-semibold text-text-primary">Tema</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { if (isDark) toggleTheme(); }}
            className={`relative rounded-2xl border-2 overflow-hidden transition-all ${!isDark ? 'border-accent ring-2 ring-accent/20 scale-[1.02]' : 'border-border hover:border-border-light'}`}>
            <div className="bg-[#F8F9FC] p-4 h-28">
              <div className="w-full h-3 rounded-full bg-[#E2E5EF] mb-2" />
              <div className="w-3/4 h-3 rounded-full bg-[#E2E5EF] mb-2" />
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: accentColor }} />
                <div className="flex-1 space-y-1.5"><div className="w-full h-2 rounded bg-[#E2E5EF]" /><div className="w-2/3 h-2 rounded bg-[#E2E5EF]" /></div>
              </div>
            </div>
            <div className="px-4 py-2.5 bg-bg-secondary border-t border-border">
              <p className="text-sm font-medium text-text-primary text-center">☀️ Chiaro</p>
            </div>
          </button>
          <button onClick={() => { if (!isDark) toggleTheme(); }}
            className={`relative rounded-2xl border-2 overflow-hidden transition-all ${isDark ? 'border-accent ring-2 ring-accent/20 scale-[1.02]' : 'border-border hover:border-border-light'}`}>
            <div className="bg-[#0F1117] p-4 h-28">
              <div className="w-full h-3 rounded-full bg-[#2E3348] mb-2" />
              <div className="w-3/4 h-3 rounded-full bg-[#2E3348] mb-2" />
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: accentColor }} />
                <div className="flex-1 space-y-1.5"><div className="w-full h-2 rounded bg-[#2E3348]" /><div className="w-2/3 h-2 rounded bg-[#2E3348]" /></div>
              </div>
            </div>
            <div className="px-4 py-2.5 bg-bg-secondary border-t border-border">
              <p className="text-sm font-medium text-text-primary text-center">🌙 Scuro</p>
            </div>
          </button>
        </div>
      </div>

      {/* Colore Accent */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-display font-semibold text-text-primary">Colore Accent</h3>
          <p className="text-sm text-text-secondary mt-0.5">Il colore principale usato per bottoni, link e elementi attivi</p>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {ACCENT_COLORS.map(c => (
            <button key={c.hex} onClick={() => setAccentColor(c.hex)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                accentColor === c.hex ? 'border-current scale-105 shadow-lg' : 'border-transparent hover:bg-bg-hover'
              }`} style={accentColor === c.hex ? { borderColor: c.hex } : {}}>
              <div className={`w-10 h-10 rounded-full transition-all ${accentColor === c.hex ? 'ring-4 ring-offset-2 ring-offset-bg-secondary' : ''}`}
                style={{ backgroundColor: c.hex, ...(accentColor === c.hex ? { boxShadow: `0 0 20px ${c.hex}50`, ringColor: `${c.hex}40` } : {}) }} />
              <span className={`text-[10px] font-medium ${accentColor === c.hex ? 'text-text-primary' : 'text-text-muted'}`}>{c.name}</span>
            </button>
          ))}
        </div>
        {/* Live Preview */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Anteprima</p>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}>Bottone Primario</button>
            <button className="px-4 py-2 rounded-xl text-sm font-medium border-2" style={{ borderColor: accentColor, color: accentColor }}>Bottone Secondario</button>
            <span className="text-sm font-medium" style={{ color: accentColor }}>Link di esempio</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
            <div className="h-2 rounded-full w-32" style={{ backgroundColor: `${accentColor}30` }}>
              <div className="h-2 rounded-full w-20" style={{ backgroundColor: accentColor }} />
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>Badge</span>
          </div>
        </div>
      </div>

      {/* Dimensione Testo */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-display font-semibold text-text-primary">Dimensione Testo</h3>
        <div className="grid grid-cols-3 gap-3">
          {([['small', 'Piccolo', 'A', 'text-xs'], ['medium', 'Medio', 'A', 'text-base'], ['large', 'Grande', 'A', 'text-xl']] as const).map(([size, label, letter, cls]) => (
            <button key={size} onClick={() => applyFontSize(size)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                fontSize === size ? 'border-accent bg-accent/5' : 'border-border hover:border-border-light'
              }`}>
              <span className={`font-bold text-text-primary ${cls}`}>{letter}</span>
              <span className="text-xs text-text-secondary">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-display font-semibold text-text-primary">Logo</h3>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleFileChange} />
        <div onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border hover:border-accent/30 transition-colors cursor-pointer group">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` }}>R</div>
          )}
          <div className="flex-1">
            <p className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {logoUrl ? 'Clicca per cambiare il logo' : 'Clicca per caricare il logo'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">PNG, JPG, WebP, SVG • Max 2MB</p>
          </div>
          <div className="p-2 rounded-xl bg-bg-tertiary group-hover:bg-accent/10 transition-colors">
            <svg className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        {logoUrl && (
          <div className="flex items-center gap-3">
            <button onClick={() => { setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-error/30 text-error text-xs font-medium hover:bg-error/10 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Rimuovi logo
            </button>
            <span className="text-xs text-success font-medium">✓ Logo caricato</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// NOTIFICATIONS SECTION — configurazione completa
// =============================================
const CHANNELS = [
  { value: 'WhatsApp', label: 'WhatsApp', color: '#22C55E' },
  { value: 'SMS', label: 'SMS', color: '#3B82F6' },
  { value: 'Email', label: 'Email', color: '#A855F7' },
  { value: 'Push', label: 'Push', color: '#F59E0B' },
  { value: 'Email (staff)', label: 'Email Staff', color: '#EC4899' },
  { value: 'Push + Email', label: 'Push + Email', color: '#6366F1' },
  { value: 'Email (titolare)', label: 'Email Titolare', color: '#14B8A6' },
];

const NOTIF_DEFAULTS = [
  { name: 'Reminder appuntamento (24h)', channel: 'WhatsApp', active: true, timing: '24 ore prima', recipient: 'Cliente', template: 'Ciao {nome}, ti ricordiamo il tuo appuntamento domani alle {ora} presso {centro}. A presto! 💆‍♀️' },
  { name: 'Reminder appuntamento (2h)', channel: 'SMS', active: true, timing: '2 ore prima', recipient: 'Cliente', template: 'Reminder: appuntamento oggi alle {ora} presso {centro}. Ti aspettiamo!' },
  { name: 'Conferma prenotazione', channel: 'Email', active: true, timing: 'Immediatamente', recipient: 'Cliente', template: 'La tua prenotazione per {trattamento} il {data} alle {ora} è confermata. Grazie!' },
  { name: 'Cancellazione appuntamento', channel: 'Email', active: true, timing: 'Immediatamente', recipient: 'Cliente', template: 'Il tuo appuntamento del {data} alle {ora} è stato cancellato. Contattaci per riprogrammare.' },
  { name: 'Auguri compleanno', channel: 'WhatsApp', active: true, timing: 'Ore 9:00 del compleanno', recipient: 'Cliente', template: 'Buon compleanno {nome}! 🎂 Ti regaliamo uno sconto del 15% sul prossimo trattamento. Codice: BDAY{anno}' },
  { name: 'Recall cliente dormiente', channel: 'WhatsApp', active: false, timing: '30 giorni dopo ultima visita', recipient: 'Cliente', template: 'Ciao {nome}, è da un po\' che non ti vediamo! 😊 Prenota il tuo prossimo trattamento con il 10% di sconto.' },
  { name: 'Scorta prodotto bassa', channel: 'Email (staff)', active: true, timing: 'Quando sotto soglia minima', recipient: 'Staff', template: 'Attenzione: il prodotto {prodotto} è sotto la soglia minima ({quantità} rimanenti). Riordinare.' },
  { name: 'Nuovo appuntamento online', channel: 'Push + Email', active: true, timing: 'Immediatamente', recipient: 'Staff', template: 'Nuova prenotazione: {cliente} ha prenotato {trattamento} per {data} alle {ora}.' },
  { name: 'Pagamento ricevuto', channel: 'Email', active: false, timing: 'Immediatamente', recipient: 'Cliente', template: 'Pagamento di €{importo} ricevuto. Grazie per aver scelto {centro}! Ricevuta #{numero}.' },
  { name: 'Report giornaliero', channel: 'Email (titolare)', active: true, timing: 'Ore 21:00 ogni giorno', recipient: 'Titolare', template: 'Report giornaliero: {appuntamenti} appuntamenti, €{fatturato} fatturato, {nuovi_clienti} nuovi clienti.' },
];

function NotificationsSection({ toggleStates, handleToggle }: { toggleStates: Record<string, boolean>; handleToggle: (key: string) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notifData, setNotifData] = useState(NOTIF_DEFAULTS.map((n, i) => ({
    ...n, channel: n.channel, timing: n.timing, template: n.template,
  })));

  const updateField = (index: number, field: string, value: string) => {
    setNotifData(prev => prev.map((n, i) => i === index ? { ...n, [field]: value } : n));
  };

  const channelColor = (ch: string) => CHANNELS.find(c => c.value === ch)?.color || '#666';

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-display font-semibold text-text-primary">Notifiche e Comunicazioni</h3>
        <p className="text-sm text-text-secondary mt-0.5">Clicca su una notifica per configurare canale, timing e messaggio</p>
      </div>
      <div className="divide-y divide-border/30">
        {notifData.map((notif, i) => {
          const isExpanded = expanded === i;
          const isActive = toggleStates[i.toString()];
          return (
            <div key={i}>
              {/* Header Row */}
              <div className={`flex items-center gap-4 px-6 py-4 transition-colors cursor-pointer ${isExpanded ? 'bg-bg-hover/50' : 'hover:bg-bg-hover'}`}
                onClick={() => setExpanded(isExpanded ? null : i)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{notif.name}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${channelColor(notif.channel)}15`, color: channelColor(notif.channel) }}>
                      {notif.channel}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{notif.timing} • {notif.recipient}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggle(i.toString()); }}
                  className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                    isActive ? 'bg-accent' : 'bg-bg-tertiary border border-border'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <ChevronRight className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              {/* Expanded Settings */}
              {isExpanded && (
                <div className="px-6 pb-5 pt-1 space-y-4 bg-bg-tertiary/20">
                  {/* Channel */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Canale di invio</label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNELS.map(ch => (
                        <button key={ch.value} onClick={() => updateField(i, 'channel', ch.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            notif.channel === ch.value
                              ? 'border-2 shadow-sm'
                              : 'border border-border bg-bg-tertiary text-text-secondary hover:border-border-light'
                          }`}
                          style={notif.channel === ch.value ? { borderColor: ch.color, backgroundColor: `${ch.color}15`, color: ch.color } : {}}>
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timing + Recipient */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Quando inviare</label>
                      <input type="text" value={notif.timing} onChange={e => updateField(i, 'timing', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Destinatario</label>
                      <select value={notif.recipient} onChange={e => updateField(i, 'recipient', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                        <option value="Cliente">Cliente</option>
                        <option value="Staff">Staff</option>
                        <option value="Titolare">Titolare</option>
                        <option value="Tutti">Tutti</option>
                      </select>
                    </div>
                  </div>

                  {/* Template */}
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                      Modello messaggio
                      <span className="font-normal normal-case tracking-normal text-text-muted ml-2">Usa {'{nome}'}, {'{data}'}, {'{ora}'}, {'{trattamento}'}, {'{centro}'}</span>
                    </label>
                    <textarea value={notif.template} onChange={e => updateField(i, 'template', e.target.value)} rows={3}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all resize-none" />
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-bg-tertiary/50 border-b border-border">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Anteprima</span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-text-primary leading-relaxed">
                        {notif.template
                          .replace('{nome}', 'Maria Rossi')
                          .replace('{data}', '28/05/2026')
                          .replace('{ora}', '14:30')
                          .replace('{trattamento}', 'Pulizia viso')
                          .replace('{centro}', 'Revobeauty Milano')
                          .replace('{prodotto}', 'Crema viso SPF50')
                          .replace('{quantità}', '3')
                          .replace('{importo}', '85')
                          .replace('{numero}', '00234')
                          .replace('{cliente}', 'Maria Rossi')
                          .replace('{appuntamenti}', '18')
                          .replace('{fatturato}', '1.250')
                          .replace('{nuovi_clienti}', '3')
                          .replace('{anno}', '2026')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PERMISSION_MODULES = [
  { id: 'dashboard', label: 'Dashboard', group: 'Principale' },
  { id: 'agenda_view', label: 'Agenda (Visualizza)', group: 'Principale' },
  { id: 'agenda_edit', label: 'Agenda (Modifica)', group: 'Principale' },
  { id: 'clients_view', label: 'Clienti (Visualizza)', group: 'CRM' },
  { id: 'clients_edit', label: 'Clienti (Modifica)', group: 'CRM' },
  { id: 'clients_delete', label: 'Clienti (Elimina)', group: 'CRM' },
  { id: 'pos', label: 'Cassa / POS', group: 'Vendite' },
  { id: 'packages', label: 'Pacchetti', group: 'Vendite' },
  { id: 'inventory_view', label: 'Magazzino (Visualizza)', group: 'Magazzino' },
  { id: 'inventory_edit', label: 'Magazzino (Modifica)', group: 'Magazzino' },
  { id: 'marketing', label: 'Marketing', group: 'Marketing' },
  { id: 'reports', label: 'Report', group: 'Analisi' },
  { id: 'admin_dashboard', label: 'Amministrazione Dashboard', group: 'Amministrazione' },
  { id: 'admin_costs', label: 'Costi Fissi / Variabili', group: 'Amministrazione' },
  { id: 'admin_investments', label: 'Investimenti', group: 'Amministrazione' },
  { id: 'admin_breakeven', label: 'Punto di Pareggio', group: 'Amministrazione' },
  { id: 'admin_cashflow', label: 'Cash Flow', group: 'Amministrazione' },
  { id: 'admin_goals', label: 'Obiettivi', group: 'Amministrazione' },
  { id: 'admin_reports', label: 'Report Amministrativi', group: 'Amministrazione' },
  { id: 'admin_automations', label: 'Automazioni', group: 'Amministrazione' },
  { id: 'staff_view', label: 'Staff (Visualizza)', group: 'Staff' },
  { id: 'staff_edit', label: 'Staff (Modifica)', group: 'Staff' },
  { id: 'settings', label: 'Impostazioni', group: 'Sistema' },
  { id: 'roles', label: 'Ruoli e Permessi', group: 'Sistema' },
];

const PERMISSION_GROUPS = [...new Set(PERMISSION_MODULES.map(m => m.group))];

interface RoleConfig {
  id: string;
  name: string;
  color: string;
  users: number;
  isSystem: boolean; // system roles can't be deleted
  permissions: Record<string, boolean>;
}

const ALL_ON = Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, true]));

const DEFAULT_ROLES: RoleConfig[] = [
  { id: 'admin', name: 'Amministratore', color: '#EF4444', users: 1, isSystem: true, permissions: { ...ALL_ON } },
  { id: 'owner', name: 'Proprietario', color: '#A855F7', users: 1, isSystem: true, permissions: { ...ALL_ON } },
  { id: 'manager', name: 'Manager', color: '#3B82F6', users: 2, isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, !['roles', 'settings', 'clients_delete'].includes(m.id)])) },
  { id: 'reception', name: 'Reception', color: '#22C55E', users: 3, isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'agenda_view', 'agenda_edit', 'clients_view', 'clients_edit', 'pos', 'packages'].includes(m.id)])) },
  { id: 'estetista', name: 'Estetista', color: '#F59E0B', users: 5, isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'agenda_view', 'clients_view'].includes(m.id)])) },
  { id: 'warehouse', name: 'Magazziniere', color: '#EC4899', users: 1, isSystem: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, ['dashboard', 'inventory_view', 'inventory_edit'].includes(m.id)])) },
];

const ROLE_COLORS = ['#EF4444', '#A855F7', '#3B82F6', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#F97316'];

function RolesPermissionsSection() {
  const [rolesData, setRoles] = useState<RoleConfig[]>(DEFAULT_ROLES);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const togglePermission = (roleId: string, permId: string) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      return { ...r, permissions: { ...r.permissions, [permId]: !r.permissions[permId] } };
    }));
  };

  const toggleGroupAll = (roleId: string, group: string, value: boolean) => {
    const groupIds = PERMISSION_MODULES.filter(m => m.group === group).map(m => m.id);
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      const updated = { ...r.permissions };
      groupIds.forEach(id => { updated[id] = value; });
      return { ...r, permissions: updated };
    }));
  };

  const addRole = () => {
    if (!newRoleName.trim()) return;
    const id = `role-${Date.now()}`;
    const color = ROLE_COLORS[(rolesData.length) % ROLE_COLORS.length];
    setRoles(prev => [...prev, {
      id, name: newRoleName.trim(), color, users: 0, isSystem: false,
      permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.id, false])),
    }]);
    setNewRoleName('');
    setShowNewRole(false);
    setExpandedRole(id);
  };

  const deleteRole = (roleId: string) => {
    setRoles(prev => prev.filter(r => r.id !== roleId));
    if (expandedRole === roleId) setExpandedRole(null);
  };

  const getActiveCount = (r: RoleConfig) => Object.values(r.permissions).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Ruoli e Permessi</h3>
            <p className="text-sm text-text-secondary mt-0.5">Clicca su un ruolo per gestire i permessi modulo per modulo</p>
          </div>
          <button onClick={() => setShowNewRole(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-accent text-white text-xs font-medium hover:scale-105 transition-all">
            + Nuovo Ruolo
          </button>
        </div>

        {/* New Role Input */}
        {showNewRole && (
          <div className="px-6 py-3 border-b border-border bg-accent/5 flex items-center gap-3">
            <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Nome del nuovo ruolo..."
              autoFocus onKeyDown={e => e.key === 'Enter' && addRole()}
              className="flex-1 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
            <button onClick={addRole} disabled={!newRoleName.trim()} className="px-3 py-2 rounded-xl gradient-accent text-white text-xs font-medium disabled:opacity-50">Crea</button>
            <button onClick={() => { setShowNewRole(false); setNewRoleName(''); }} className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">Annulla</button>
          </div>
        )}

        {/* Role List */}
        <div className="divide-y divide-border/30">
          {rolesData.map((role) => {
            const isExpanded = expandedRole === role.id;
            const activePerms = getActiveCount(role);
            const totalPerms = PERMISSION_MODULES.length;
            return (
              <div key={role.id}>
                {/* Role Header */}
                <div onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-bg-hover transition-colors cursor-pointer">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{role.name}</p>
                      {role.id === 'admin' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error/10 text-error">SUPER</span>}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
                        {role.users} {role.users === 1 ? 'utente' : 'utenti'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {activePerms}/{totalPerms} permessi attivi
                    </p>
                  </div>
                  {/* Progress ring */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 relative">
                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" className="text-bg-tertiary" strokeWidth="3" />
                        <circle cx="16" cy="16" r="14" fill="none" stroke={role.color} strokeWidth="3"
                          strokeDasharray={`${(activePerms / totalPerms) * 88} 88`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-text-primary">
                        {Math.round((activePerms / totalPerms) * 100)}%
                      </span>
                    </div>
                    {!role.isSystem && (
                      <button onClick={(e) => { e.stopPropagation(); deleteRole(role.id); }}
                        className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all opacity-0 group-hover:opacity-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded Permission Matrix */}
                {isExpanded && (
                  <div className="px-6 pb-5 space-y-3">
                    {role.id === 'admin' && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10 text-xs text-accent">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Amministratore — si consiglia di mantenere tutti i permessi attivi</span>
                      </div>
                    )}
                    {PERMISSION_GROUPS.map(group => {
                      const modules = PERMISSION_MODULES.filter(m => m.group === group);
                      const allOn = modules.every(m => role.permissions[m.id]);
                      const someOn = modules.some(m => role.permissions[m.id]);
                      return (
                        <div key={group} className="rounded-xl border border-border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-bg-tertiary/40">
                            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">{group}</span>
                              <button onClick={() => toggleGroupAll(role.id, group, !allOn)}
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${allOn ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'}`}>
                                {allOn ? 'Deseleziona tutto' : 'Seleziona tutto'}
                              </button>
                          </div>
                          <div className="divide-y divide-border/20">
                            {modules.map(mod => {
                              const isOn = role.permissions[mod.id];
                              return (
                                <div key={mod.id}
                                  onClick={() => togglePermission(role.id, mod.id)}
                                  className="flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer hover:bg-bg-hover">
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                    isOn ? 'border-accent bg-accent' : 'border-border bg-bg-tertiary'
                                  }`}>
                                    {isOn && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`text-sm ${isOn ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{mod.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const { isDark, toggleTheme } = useThemeStore();
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>(
    Object.fromEntries(notifications.map((n, i) => [i.toString(), n.active]))
  );

  const handleToggle = (key: string) => {
    setToggleStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Impostazioni</h2>
        <p className="text-sm text-text-secondary">Configura il tuo centro estetico</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            {settingSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/30 last:border-b-0 ${
                    activeSection === section.id
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-bg-hover text-text-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="text-[11px] text-text-muted truncate">{section.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* CENTRO */}
            {activeSection === 'general' && (
              <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
                <h3 className="text-lg font-display font-semibold text-text-primary">Informazioni Centro</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Nome Centro', value: 'Revobeauty Milano Centro' },
                    { label: 'P.IVA', value: 'IT12345678901' },
                    { label: 'Indirizzo', value: 'Via Torino 45' },
                    { label: 'Città', value: 'Milano' },
                    { label: 'Telefono', value: '+39 02 1234567' },
                    { label: 'Email', value: 'centro@revobeauty.it' },
                    { label: 'CAP', value: '20123' },
                    { label: 'Sito Web', value: 'www.revobeauty.it' },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-sm text-text-secondary mb-1.5">{field.label}</label>
                      <input
                        type="text"
                        defaultValue={field.value}
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-3 flex justify-end">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    <Save className="w-4 h-4" /> Salva Modifiche
                  </button>
                </div>
              </div>
            )}

            {/* ORARI */}
            {activeSection === 'hours' && (
              <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
                <h3 className="text-lg font-display font-semibold text-text-primary">Orari di Apertura</h3>
                <div className="space-y-3">
                  {weekDays.map((day) => (
                    <div key={day.day} className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                      <div className="w-24">
                        <span className="text-sm font-medium text-text-primary">{day.day}</span>
                      </div>
                      <button
                        className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                          day.isOpen ? 'bg-accent' : 'bg-bg-tertiary border border-border'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          day.isOpen ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                      {day.isOpen ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            defaultValue={day.open}
                            className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
                          />
                          <span className="text-text-muted text-sm">—</span>
                          <input
                            type="time"
                            defaultValue={day.close}
                            className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">Chiuso</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="pt-3 flex justify-end">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    <Save className="w-4 h-4" /> Salva Orari
                  </button>
                </div>
              </div>
            )}

            {/* ASPETTO */}
            {activeSection === 'appearance' && (
              <AppearanceSection />
            )}

            {/* NOTIFICHE */}
            {activeSection === 'notifications' && (
              <NotificationsSection toggleStates={toggleStates} handleToggle={handleToggle} />
            )}

            {/* RUOLI E PERMESSI */}
            {activeSection === 'roles' && (
              <RolesPermissionsSection />
            )}

            {/* FATTURAZIONE */}
            {activeSection === 'billing' && (
              <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
                <h3 className="text-lg font-display font-semibold text-text-primary">Dati Fatturazione</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Ragione Sociale', value: 'Revobeauty S.r.l.' },
                    { label: 'P.IVA', value: 'IT12345678901' },
                    { label: 'Codice Fiscale', value: '12345678901' },
                    { label: 'Codice SDI', value: 'M5UXCR1' },
                    { label: 'PEC', value: 'revobeauty@pec.it' },
                    { label: 'Regime Fiscale', value: 'Ordinario' },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-sm text-text-secondary mb-1.5">{field.label}</label>
                      <input
                        type="text"
                        defaultValue={field.value}
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                  <p className="text-sm font-medium text-accent">Registratore Telematico</p>
                  <p className="text-xs text-text-secondary mt-1">Matricola: RT-2024-001234 • Connesso e operativo</p>
                </div>
                <div className="pt-3 flex justify-end">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    <Save className="w-4 h-4" /> Salva Dati Fiscali
                  </button>
                </div>
              </div>
            )}

            {/* INTEGRAZIONI */}
            {activeSection === 'integrations' && (
              <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-display font-semibold text-text-primary">Integrazioni</h3>
                {[
                  { name: 'WhatsApp Business', desc: 'Invio messaggi e reminder automatici', connected: true, color: '#22C55E' },
                  { name: 'Google Calendar', desc: 'Sincronizzazione bidirezionale agenda', connected: true, color: '#3B82F6' },
                  { name: 'Stripe Payments', desc: 'Pagamenti online e ricorrenti', connected: false, color: '#6366F1' },
                  { name: 'Mailchimp', desc: 'Email marketing e newsletter', connected: false, color: '#F59E0B' },
                  { name: 'Satispay', desc: 'Pagamenti in negozio e online', connected: true, color: '#EF4444' },
                  { name: 'Klarna', desc: 'Pagamenti rateizzati', connected: false, color: '#EC4899' },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center gap-4 p-4 rounded-xl bg-bg-tertiary/50 border border-border/30">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${integration.color}15` }}>
                      <Globe className="w-5 h-5" style={{ color: integration.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                      <p className="text-xs text-text-muted mt-0.5">{integration.desc}</p>
                    </div>
                    <button className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      integration.connected
                        ? 'bg-success/10 text-success hover:bg-success/20'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'
                    }`}>
                      {integration.connected ? 'Connesso ✓' : 'Connetti'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
