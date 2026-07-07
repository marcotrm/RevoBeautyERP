'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClientStore } from '@/stores/useClientStore';
import { Client } from '@/types';
import Link from 'next/link';
import {
  Search, Plus, Users, Crown,
  UserPlus, Clock, Phone, Mail,
  ChevronRight, Heart, Download, X, CheckCircle, BarChart3, Trash2, Tag,
} from 'lucide-react';
import { formatCurrency, getInitials } from '@/lib/helpers';
import AddClientModal from '@/components/AddClientModal';

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

function ClientRow({ client, checked, onToggle }: { client: Client; checked: boolean; onToggle: (id: string) => void }) {
  const daysSinceVisit = client.lastVisit ? Math.floor((Date.now() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <motion.div variants={item} className={`flex items-center gap-2 pl-3.5 ${checked ? 'bg-accent/5' : ''}`}>
      <input type="checkbox" checked={checked} onChange={() => onToggle(client.id)}
        className="w-4 h-4 rounded border-border accent-accent cursor-pointer flex-shrink-0" />
      <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-bg-hover border border-transparent hover:border-border transition-all duration-200 group flex-1 min-w-0">
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

// AddClientModal extracted to components

export default function ClientsPage() {
  const { searchQuery, setSearchQuery, activeFilter, setActiveFilter, getFilteredClients, clients, addClient, updateClient, deleteClient, fetchClients } = useClientStore();
  const filteredClients = useMemo(() => getFilteredClients(), [searchQuery, activeFilter, clients]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Selezione singola e di massa
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allVisibleSelected = filteredClients.length > 0 && filteredClients.every(c => selected.has(c.id));
  const toggleAll = () => setSelected(prev => allVisibleSelected ? new Set() : new Set(filteredClients.map(c => c.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Eliminare ${selected.size} client${selected.size === 1 ? 'e' : 'i'}? L'operazione non è reversibile.`)) return;
    selected.forEach(id => deleteClient(id));
    clearSelection();
  };
  const bulkTag = () => {
    if (selected.size === 0) return;
    const tag = prompt('Tag da aggiungere ai clienti selezionati:')?.trim();
    if (!tag) return;
    selected.forEach(id => {
      const c = clients.find(cl => cl.id === id);
      if (c && !c.tags.includes(tag)) updateClient(id, { tags: [...c.tags, tag] });
    });
    clearSelection();
  };

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
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-3.5 py-2.5 border-b border-border bg-accent/5">
            <span className="text-xs font-semibold text-accent">{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
            <div className="flex items-center gap-2">
              <button onClick={bulkTag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-text-primary text-xs font-medium hover:bg-bg-hover transition-all">
                <Tag className="w-3.5 h-3.5" /> Aggiungi tag
              </button>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/20 text-error text-xs font-medium hover:bg-error/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </button>
              <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:bg-bg-hover transition-all">Annulla</button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4 rounded border-border accent-accent cursor-pointer flex-shrink-0" title="Seleziona tutti" />
          <div className="hidden md:flex items-center gap-4 flex-1">
            <div className="w-10" /><div className="flex-1">Cliente</div><div className="hidden lg:block w-[150px]">Tag</div><div className="w-[80px] text-right">Spesa</div><div className="w-[90px] text-right">Ultima Visita</div><div className="w-4" />
          </div>
        </div>
        <motion.div variants={container} initial="hidden" animate="show" className="divide-y divide-border/30">
          {filteredClients.map(client => <ClientRow key={client.id} client={client} checked={selected.has(client.id)} onToggle={toggleOne} />)}
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
