'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/useUIStore';
import {
  Search, LayoutDashboard, Calendar, Users, ShoppingBag,
  Package, Warehouse, Megaphone, BarChart3, UserCog, Settings,
  Landmark, ArrowRight, Hash, Scissors, User,
} from 'lucide-react';
import { mockOperators, mockTreatments } from '@/lib/mock-data';

interface SearchItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href: string;
  group: string;
  keywords?: string;
}

const NAV_ITEMS: SearchItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', description: 'KPI, grafici, attività recenti', icon: LayoutDashboard, href: '/dashboard', group: 'Pagine', keywords: 'home principale' },
  { id: 'nav-agenda', label: 'Agenda', description: 'Appuntamenti, calendario, prenotazioni', icon: Calendar, href: '/dashboard/agenda', group: 'Pagine', keywords: 'appuntamenti calendario prenotazioni' },
  { id: 'nav-clients', label: 'Clienti', description: 'CRM, schede cliente, anagrafica', icon: Users, href: '/dashboard/clients', group: 'Pagine', keywords: 'crm anagrafica contatti' },
  { id: 'nav-pos', label: 'Cassa', description: 'Punto vendita, scontrini, pagamenti', icon: ShoppingBag, href: '/dashboard/pos', group: 'Pagine', keywords: 'pagamenti scontrini vendita' },
  { id: 'nav-packages', label: 'Pacchetti', description: 'Abbonamenti, pacchetti trattamento', icon: Package, href: '/dashboard/packages', group: 'Pagine', keywords: 'abbonamenti bundle' },
  { id: 'nav-inventory', label: 'Magazzino', description: 'Prodotti, scorte, ordini', icon: Warehouse, href: '/dashboard/inventory', group: 'Pagine', keywords: 'prodotti scorte inventario' },
  { id: 'nav-marketing', label: 'Marketing', description: 'Campagne, promozioni, recall', icon: Megaphone, href: '/dashboard/marketing', group: 'Pagine', keywords: 'campagne promozioni sms' },
  { id: 'nav-reports', label: 'Report', description: 'Statistiche, analytics, grafici', icon: BarChart3, href: '/dashboard/reports', group: 'Pagine', keywords: 'statistiche analytics' },
  { id: 'nav-admin', label: 'Amministrazione', description: 'Costi, investimenti, cash flow', icon: Landmark, href: '/dashboard/admin', group: 'Pagine', keywords: 'costi fatturato utile' },
  { id: 'nav-admin-fixed', label: 'Costi Fissi', description: 'Gestione costi fissi', icon: Landmark, href: '/dashboard/admin/fixed-costs', group: 'Amministrazione' },
  { id: 'nav-admin-var', label: 'Costi Variabili', description: 'Consumi e materiali', icon: Landmark, href: '/dashboard/admin/variable-costs', group: 'Amministrazione' },
  { id: 'nav-admin-inv', label: 'Investimenti', description: 'Macchinari, ROI', icon: Landmark, href: '/dashboard/admin/investments', group: 'Amministrazione' },
  { id: 'nav-admin-be', label: 'Punto di Pareggio', description: 'Break-even analysis', icon: Landmark, href: '/dashboard/admin/breakeven', group: 'Amministrazione', keywords: 'breakeven' },
  { id: 'nav-admin-cf', label: 'Cash Flow', description: 'Flussi finanziari', icon: Landmark, href: '/dashboard/admin/cashflow', group: 'Amministrazione', keywords: 'flussi liquidità' },
  { id: 'nav-admin-goals', label: 'Obiettivi', description: 'KPI target', icon: Landmark, href: '/dashboard/admin/goals', group: 'Amministrazione' },
  { id: 'nav-admin-rep', label: 'Report Amministrativi', description: 'Classifiche e analisi', icon: Landmark, href: '/dashboard/admin/reports', group: 'Amministrazione' },
  { id: 'nav-admin-auto', label: 'Automazioni Admin', description: 'Reminder e alert', icon: Landmark, href: '/dashboard/admin/automations', group: 'Amministrazione' },
  { id: 'nav-staff', label: 'Staff', description: 'Operatrici, turni, commissioni', icon: UserCog, href: '/dashboard/staff', group: 'Pagine', keywords: 'dipendenti operatrici' },
  { id: 'nav-settings', label: 'Impostazioni', description: 'Centro, orari, tema, ruoli', icon: Settings, href: '/dashboard/settings', group: 'Pagine', keywords: 'centro tema ruoli permessi' },
];

export default function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build full searchable items
  const allItems = useMemo<SearchItem[]>(() => {
    const staffItems: SearchItem[] = mockOperators.map(op => ({
      id: `staff-${op.id}`, label: `${op.firstName} ${op.lastName}`,
      description: `Operatrice • ${op.commission}% commissione`,
      icon: User, href: '/dashboard/staff', group: 'Staff',
      keywords: `${op.firstName} ${op.lastName} operatrice estetista`,
    }));
    const treatmentItems: SearchItem[] = mockTreatments.slice(0, 15).map(t => ({
      id: `treat-${t.id}`, label: t.name,
      description: `${t.duration}min • €${t.price}`,
      icon: Scissors, href: '/dashboard/settings', group: 'Trattamenti',
      keywords: `${t.name} ${t.category}`,
    }));
    return [...NAV_ITEMS, ...staffItems, ...treatmentItems];
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12);
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.keywords?.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [query, allItems]);

  const grouped = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    filtered.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  const flatFiltered = useMemo(() => filtered, [filtered]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input when open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Reset index when results change
  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  const navigate = useCallback((item: SearchItem) => {
    setCommandPaletteOpen(false);
    router.push(item.href);
  }, [router, setCommandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
      navigate(flatFiltered[selectedIndex]);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 500 }}
        className="fixed inset-x-0 top-[15%] z-[71] flex justify-center px-4"
      >
        <div className="w-full max-w-xl bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cerca pagine, staff, trattamenti..."
              className="flex-1 bg-transparent text-base text-text-primary placeholder-text-muted focus:outline-none"
            />
            <kbd className="flex items-center px-2 py-1 rounded-lg bg-bg-tertiary text-[10px] font-medium text-text-muted border border-border">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
            {flatFiltered.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-text-muted">Nessun risultato per &quot;{query}&quot;</p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <p className="px-5 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">{group}</p>
                  {items.map(item => {
                    const globalIndex = flatFiltered.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        data-index={globalIndex}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-accent/10' : 'hover:bg-bg-hover'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isSelected ? 'bg-accent/20' : 'bg-bg-tertiary'}`}>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}>{item.label}</p>
                          {item.description && <p className="text-xs text-text-muted truncate">{item.description}</p>}
                        </div>
                        {isSelected && <ArrowRight className="w-4 h-4 text-accent flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border">↑</kbd><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border">↓</kbd> Naviga</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border">↵</kbd> Apri</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border">ESC</kbd> Chiudi</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
