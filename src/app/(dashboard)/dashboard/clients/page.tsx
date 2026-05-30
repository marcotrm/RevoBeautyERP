'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClientStore } from '@/stores/useClientStore';
import { Client } from '@/types';
import Link from 'next/link';
import {
  Search, Plus, Users, Crown,
  UserPlus, Clock, Phone, Mail,
  ChevronRight, Heart, Download, X, CheckCircle, BarChart3,
} from 'lucide-react';
import { formatCurrency, getInitials } from '@/lib/helpers';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const filtersList = [
  { id: 'all', label: 'Tutti', icon: Users },
  { id: 'vip', label: 'VIP', icon: Crown },
  { id: 'active', label: 'Attivi', icon: Heart },
  { id: 'dormant', label: 'Dormienti', icon: Clock },
  { id: 'new', label: 'Nuovi', icon: UserPlus },
];

function VIPBadge({ level }: { level: number }) {
  if (level === 0) return null;
  const colors = ['', '#F59E0B', '#A855F7', '#EC4899'];
  const labels = ['', '⭐', '⭐⭐', '👑 VIP'];
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${colors[level]}15`, color: colors[level] }}>{labels[level]}</span>;
}

function ClientRow({ client }: { client: Client }) {
  const daysSinceVisit = client.lastVisit ? Math.floor((Date.now() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <motion.div variants={item}>
      <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-bg-hover border border-transparent hover:border-border transition-all duration-200 group">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ background: client.vipLevel >= 2 ? 'linear-gradient(135deg, #A855F7, #EC4899)' : '#3B82F6' }}>
          {getInitials(client.firstName, client.lastName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">{client.firstName} {client.lastName}</p>
            <VIPBadge level={client.vipLevel} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-text-secondary"><Phone className="w-3 h-3" /> {client.phone}</span>
            {client.email && <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted"><Mail className="w-3 h-3" /> {client.email}</span>}
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-1.5">
          {client.tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary">{tag}</span>)}
        </div>
        <div className="hidden md:block text-right min-w-[80px]">
          <p className="text-sm font-semibold text-text-primary">{formatCurrency(client.totalSpent)}</p>
          <p className="text-[11px] text-text-muted">{client.visitCount} visite</p>
        </div>
        <div className="hidden sm:block text-right min-w-[90px]">
          {daysSinceVisit !== null ? (
            <p className={`text-xs font-medium ${daysSinceVisit <= 14 ? 'text-success' : daysSinceVisit <= 60 ? 'text-warning' : 'text-error'}`}>
              {daysSinceVisit === 0 ? 'Oggi' : daysSinceVisit === 1 ? 'Ieri' : `${daysSinceVisit}g fa`}
            </p>
          ) : <p className="text-xs text-text-muted">Mai visitato</p>}
          <p className="text-[11px] text-text-muted">Ultima visita</p>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </motion.div>
  );
}

function AddClientModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Omit<Client, 'id' | 'createdAt' | 'totalSpent' | 'visitCount' | 'avgTicket' | 'loyaltyPoints' | 'cashback'>) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'F' | 'M' | 'other'>('F');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [tags, setTags] = useState('');

  const canSave = firstName.trim() && lastName.trim() && phone.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      birthDate: birthDate || undefined,
      gender,
      address: address || undefined,
      city: city || undefined,
      notes: notes || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      vipLevel: 0,
      gdprConsent,
      marketingConsent,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-lg font-display font-semibold text-text-primary">Nuovo Cliente</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* Nome + Cognome */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Cognome *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Cognome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Telefono + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.it" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Data nascita + Genere */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Data di Nascita</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Genere</label>
                <div className="flex gap-2">
                  {([['F', 'Donna'], ['M', 'Uomo'], ['other', 'Altro']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setGender(val)} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${gender === val ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>{label}</button>
                  ))}
                </div></div>
            </div>
            {/* Indirizzo + Città */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Indirizzo</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Via..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Città</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Milano..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Tags */}
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Tag <span className="font-normal text-text-muted">(separati da virgola)</span></label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="Es. Sensibile, Allergica, VIP..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            {/* Note */}
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Note sul cliente..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" /></div>
            {/* Consensi */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setGdprConsent(!gdprConsent)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${gdprConsent ? 'border-accent bg-accent' : 'border-border bg-bg-tertiary'}`}>
                  {gdprConsent && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm text-text-secondary">Consenso GDPR (trattamento dati)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setMarketingConsent(!marketingConsent)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${marketingConsent ? 'border-accent bg-accent' : 'border-border bg-bg-tertiary'}`}>
                  {marketingConsent && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm text-text-secondary">Consenso Marketing (promozioni, SMS, email)</span>
              </label>
            </div>
            {/* Preview */}
            {canSave && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center text-white text-sm font-bold">{getInitials(firstName, lastName)}</div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{firstName} {lastName}</p>
                  <p className="text-xs text-text-muted">{phone}{email ? ` • ${email}` : ''}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <CheckCircle className="w-4 h-4" /> Crea Cliente
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function ClientsPage() {
  const { searchQuery, setSearchQuery, activeFilter, setActiveFilter, getFilteredClients, clients, addClient } = useClientStore();
  const filteredClients = useMemo(() => getFilteredClients(), [searchQuery, activeFilter, clients]);
  const [showModal, setShowModal] = useState(false);

  const totalClients = clients.length;
  const vipClients = clients.filter(c => c.vipLevel >= 2).length;
  const totalRevenue = clients.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Clienti</h2>
          <p className="text-sm text-text-secondary">{totalClients} clienti registrati • {vipClients} VIP</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/clients/analytics" className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-105 transition-all">
            <BarChart3 className="w-4 h-4" /> Dashboard Clienti
          </Link>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-bg-hover text-sm text-text-secondary transition-colors">
            <Download className="w-4 h-4" /> Esporta
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
            <Plus className="w-4 h-4" /> Nuovo Cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" placeholder="Cerca per nome, telefono, email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {filtersList.map(f => {
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === f.id ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-transparent'
                }`}>
                <Icon className="w-3.5 h-3.5" />{f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-bg-secondary border border-border rounded-xl p-3"><p className="text-xl font-display font-bold text-text-primary">{totalClients}</p><p className="text-xs text-text-secondary">Clienti Totali</p></div>
        <div className="bg-bg-secondary border border-border rounded-xl p-3"><p className="text-xl font-display font-bold text-accent">{vipClients}</p><p className="text-xs text-text-secondary">Clienti VIP</p></div>
        <div className="bg-bg-secondary border border-border rounded-xl p-3"><p className="text-xl font-display font-bold text-text-primary">{formatCurrency(totalRevenue)}</p><p className="text-xs text-text-secondary">Revenue Totale</p></div>
        <div className="bg-bg-secondary border border-border rounded-xl p-3"><p className="text-xl font-display font-bold text-text-primary">{formatCurrency(totalRevenue / Math.max(totalClients, 1))}</p><p className="text-xs text-text-secondary">LTV Medio</p></div>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="hidden md:flex items-center gap-4 px-3.5 py-3 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
          <div className="w-10" /><div className="flex-1">Cliente</div><div className="hidden lg:block w-[150px]">Tag</div><div className="w-[80px] text-right">Spesa</div><div className="w-[90px] text-right">Ultima Visita</div><div className="w-4" />
        </div>
        <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/30">
          {filteredClients.map(client => <ClientRow key={client.id} client={client} />)}
        </motion.div>
        {filteredClients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-12 h-12 text-text-muted mb-3" />
            <p className="text-text-secondary font-medium">Nessun cliente trovato</p>
            <p className="text-sm text-text-muted mt-1">Prova a cambiare i filtri di ricerca</p>
          </div>
        )}
      </div>
      <p className="text-xs text-text-muted text-center">{filteredClients.length} risultati su {totalClients} clienti</p>

      <AnimatePresence>{showModal && <AddClientModal onClose={() => setShowModal(false)} onSave={data => { addClient(data); setShowModal(false); }} />}</AnimatePresence>
    </div>
  );
}
