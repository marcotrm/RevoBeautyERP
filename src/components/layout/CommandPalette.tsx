'use client';

/**
 * La ricerca di tutto il gestionale (il tasto "Cerca…" in alto, o ⌘K).
 *
 * Cerca fra le pagine, le clienti in anagrafica, le ragazze dello staff e i
 * trattamenti a listino. Scegliendo una cliente si apre l'anagrafica già
 * filtrata su di lei: è la cosa che si cerca più spesso.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUIStore } from '@/stores/useUIStore';
import {
  Search, LayoutDashboard, Calendar, Users, ShoppingBag,
  Package, Warehouse, Megaphone, BarChart3, UserCog, Settings,
  Landmark, ArrowRight, Scissors, User, Receipt, Gift, QrCode,
  TrendingUp, Smartphone, MessageSquare, Zap, CheckSquare,
} from 'lucide-react';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { useClientStore } from '@/stores/useClientStore';
import { NO_AUTOFILL } from '@/lib/noAutofill';

interface SearchItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;
  href?: string;
  /** Cosa fare prima di andare alla pagina (es. filtrare l'anagrafica). */
  prima?: () => void;
}

const NAV_ITEMS: SearchItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', description: 'KPI, grafici, attività recenti', icon: LayoutDashboard, href: '/dashboard', group: 'Pagine', keywords: 'home principale' },
  { id: 'nav-agenda', label: 'Agenda', description: 'Appuntamenti, calendario, prenotazioni', icon: Calendar, href: '/dashboard/agenda', group: 'Pagine', keywords: 'appuntamenti calendario prenotazioni' },
  { id: 'nav-clients', label: 'Clienti', description: 'Anagrafica, schede, storico', icon: Users, href: '/dashboard/clients', group: 'Pagine', keywords: 'crm anagrafica contatti' },
  { id: 'nav-pos', label: 'Cassa', description: 'Incassi, pagamenti, chiusura', icon: ShoppingBag, href: '/dashboard/pos', group: 'Pagine', keywords: 'pagamenti vendita incasso' },
  { id: 'nav-scontrini', label: 'Scontrini Fiscali', description: 'Documenti commerciali emessi', icon: Receipt, href: '/dashboard/scontrini', group: 'Pagine', keywords: 'fiscale registratore c95' },
  { id: 'nav-packages', label: 'Trattamenti e Pacchetti', description: 'Listino, abbonamenti, pacchetti', icon: Package, href: '/dashboard/packages', group: 'Pagine', keywords: 'listino prezzi abbonamenti bundle' },
  { id: 'nav-gift', label: 'Buoni Regalo', description: 'Gift card emesse e usate', icon: Gift, href: '/dashboard/packages/gift-cards', group: 'Pagine', keywords: 'gift card regalo voucher' },
  { id: 'nav-inventory', label: 'Magazzino', description: 'Prodotti, scorte, ordini', icon: Warehouse, href: '/dashboard/inventory', group: 'Pagine', keywords: 'prodotti scorte inventario' },
  { id: 'nav-marketing', label: 'Marketing', description: 'Campagne, promozioni, recensioni', icon: Megaphone, href: '/dashboard/marketing', group: 'Pagine', keywords: 'campagne promozioni recensioni google' },
  { id: 'nav-whatsapp', label: 'WhatsApp', description: 'Chat con le clienti', icon: MessageSquare, href: '/dashboard/whatsapp', group: 'Pagine', keywords: 'messaggi chat conversazioni' },
  { id: 'nav-affiliati', label: 'Affiliazione', description: 'Codici, QR, portale affiliati', icon: QrCode, href: '/dashboard/affiliati', group: 'Pagine', keywords: 'affiliati qr codice porta un amico' },
  { id: 'nav-todo', label: 'To-Do', description: 'Cose da fare', icon: CheckSquare, href: '/dashboard/todo', group: 'Pagine', keywords: 'attività promemoria lista' },
  { id: 'nav-reports', label: 'Report', description: 'Analisi e classifiche', icon: BarChart3, href: '/dashboard/reports', group: 'Pagine', keywords: 'analytics analisi' },
  { id: 'nav-statistiche', label: 'Statistiche', description: 'Andamento del centro', icon: TrendingUp, href: '/dashboard/statistiche', group: 'Pagine', keywords: 'grafici andamento numeri' },
  { id: 'nav-staff', label: 'Staff', description: 'Operatrici, turni, commissioni', icon: UserCog, href: '/dashboard/staff', group: 'Pagine', keywords: 'dipendenti operatrici turni' },
  { id: 'nav-automazioni', label: 'Automazioni', description: 'Promemoria e messaggi automatici', icon: Zap, href: '/dashboard/automazioni', group: 'Pagine', keywords: 'automatico reminder promemoria' },
  { id: 'nav-app-clienti', label: 'App Clienti', description: 'Configurazione dell\'app e delle prenotazioni', icon: Smartphone, href: '/dashboard/app-clienti', group: 'Pagine', keywords: 'app telefono prenotazione online' },
  { id: 'nav-settings', label: 'Impostazioni', description: 'Centro, orari, tema, ruoli', icon: Settings, href: '/dashboard/settings', group: 'Pagine', keywords: 'centro tema ruoli permessi configurazione' },
  { id: 'nav-admin', label: 'Amministrazione', description: 'Costi, investimenti, cash flow', icon: Landmark, href: '/dashboard/admin', group: 'Pagine', keywords: 'costi fatturato utile' },
  { id: 'nav-admin-fixed', label: 'Costi Fissi', description: 'Affitto, utenze, stipendi', icon: Landmark, href: '/dashboard/admin/fixed-costs', group: 'Amministrazione' },
  { id: 'nav-admin-var', label: 'Costi Variabili', description: 'Consumi e materiali', icon: Landmark, href: '/dashboard/admin/variable-costs', group: 'Amministrazione' },
  { id: 'nav-admin-inv', label: 'Investimenti', description: 'Macchinari, ritorno', icon: Landmark, href: '/dashboard/admin/investments', group: 'Amministrazione' },
  { id: 'nav-admin-be', label: 'Punto di Pareggio', description: 'Quanto serve per andare in pari', icon: Landmark, href: '/dashboard/admin/breakeven', group: 'Amministrazione', keywords: 'breakeven pareggio' },
  { id: 'nav-admin-cf', label: 'Cash Flow', description: 'Entrate e uscite nel tempo', icon: Landmark, href: '/dashboard/admin/cashflow', group: 'Amministrazione', keywords: 'flussi liquidità cassa' },
  { id: 'nav-admin-goals', label: 'Obiettivi', description: 'Traguardi del centro', icon: Landmark, href: '/dashboard/admin/goals', group: 'Amministrazione' },
  { id: 'nav-admin-rep', label: 'Report Amministrativi', description: 'Classifiche e analisi', icon: Landmark, href: '/dashboard/admin/reports', group: 'Amministrazione' },
  { id: 'nav-admin-auto', label: 'Automazioni Admin', description: 'Avvisi su costi e scadenze', icon: Landmark, href: '/dashboard/admin/automations', group: 'Amministrazione' },
];

/** Minuscole e senza accenti: al banco si scrive di fretta. */
function normalizza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

const QUANTI = 18;

export default function CommandPalette() {
  const router = useRouter();
  const treatments = useTreatmentStore(s => s.treatments);
  const fetchTreatments = useTreatmentStore(s => s.fetchTreatments);
  const operators = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);
  const clients = useClientStore(s => s.clients);
  const fetchClients = useClientStore(s => s.fetchClients);
  const setSearchQuery = useClientStore(s => s.setSearchQuery);
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo<SearchItem[]>(() => {
    // Le clienti: scegliendone una si apre l'anagrafica già filtrata su di lei.
    const clientItems: SearchItem[] = clients.map(c => {
      const nome = `${c.firstName} ${c.lastName}`.trim();
      return {
        id: `cli-${c.id}`,
        label: nome,
        description: [c.phone, c.email].filter(Boolean).join(' • ') || 'Cliente',
        icon: Users,
        group: 'Clienti',
        keywords: `${nome} ${c.phone || ''} ${c.email || ''}`,
        href: '/dashboard/clients',
        prima: () => setSearchQuery(nome),
      };
    });
    const staffItems: SearchItem[] = operators.map(op => ({
      id: `staff-${op.id}`,
      label: `${op.firstName} ${op.lastName}`.trim(),
      description: op.isResource ? 'Cabina o macchinario' : 'Operatrice',
      icon: User,
      href: '/dashboard/staff',
      group: 'Staff',
      keywords: `${op.firstName} ${op.lastName} operatrice estetista staff`,
    }));
    const treatmentItems: SearchItem[] = treatments.map(t => ({
      id: `treat-${t.id}`,
      label: t.name,
      description: `${t.duration} min • € ${t.price}`,
      icon: Scissors,
      href: '/dashboard/packages',
      group: 'Trattamenti',
      keywords: `${t.name} ${t.category} trattamento listino`,
    }));
    return [...NAV_ITEMS, ...clientItems, ...staffItems, ...treatmentItems];
  }, [clients, operators, treatments, setSearchQuery]);

  const { filtered, quantiInPiu } = useMemo(() => {
    const q = normalizza(query);
    // A vuoto si mostrano solo le pagine: un elenco di 231 clienti non aiuta.
    if (!q) return { filtered: NAV_ITEMS.slice(0, 12), quantiInPiu: 0 };
    const parole = q.split(/\s+/);
    const trovati = allItems.filter(item => {
      const campo = normalizza(`${item.label} ${item.description || ''} ${item.keywords || ''} ${item.group}`);
      return parole.every(p => campo.includes(p));
    });
    // Chi inizia con quello che si sta scrivendo viene prima.
    trovati.sort((a, b) => {
      const inizia = (i: SearchItem) => (normalizza(i.label).startsWith(parole[0]) ? 0 : 1);
      return inizia(a) - inizia(b) || a.label.localeCompare(b.label);
    });
    return { filtered: trovati.slice(0, QUANTI), quantiInPiu: Math.max(0, trovati.length - QUANTI) };
  }, [query, allItems]);

  const grouped = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    filtered.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filtered]);

  // Scorciatoia da tastiera per aprire e chiudere.
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

  // All'apertura: campo pulito, cursore dentro, e se qualche elenco non è
  // ancora stato letto lo si legge adesso — la ricerca vive in ogni pagina,
  // non può contare su chi l'ha caricato prima.
  useEffect(() => {
    if (!commandPaletteOpen) return;
    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
    if (clients.length === 0) fetchClients();
    if (operators.length === 0) fetchOperators();
    if (treatments.length === 0) fetchTreatments();
    // Volutamente solo sull'apertura: gli elenchi non vanno riletti a ogni tasto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandPaletteOpen]);

  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  const navigate = useCallback((item: SearchItem) => {
    setCommandPaletteOpen(false);
    item.prima?.();
    if (item.href) router.push(item.href);
  }, [router, setCommandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex]);
    }
  };

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
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              {...NO_AUTOFILL} placeholder="Cerca clienti, pagine, trattamenti…"
              className="flex-1 bg-transparent text-base text-text-primary placeholder-text-muted focus:outline-none"
            />
            <kbd className="flex items-center px-2 py-1 rounded-lg bg-bg-tertiary text-[10px] font-medium text-text-muted border border-border">ESC</kbd>
          </div>

          <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-text-muted">Nessun risultato per &quot;{query}&quot;</p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <p className="px-5 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">{group}</p>
                  {items.map(item => {
                    const globalIndex = filtered.indexOf(item);
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
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>{item.label}</p>
                          {item.description && <p className="text-xs text-text-muted truncate">{item.description}</p>}
                        </div>
                        {isSelected && <ArrowRight className="w-4 h-4 text-accent flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {/* Niente tagli silenziosi: se ne restano fuori, si dice. */}
            {quantiInPiu > 0 && (
              <p className="px-5 py-2 text-[11px] text-text-muted">
                e altri {quantiInPiu} — scrivi qualche lettera in più per restringere.
              </p>
            )}
          </div>

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
