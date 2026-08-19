'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/useUIStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRolesStore } from '@/stores/useRolesStore';
import { useWaInboxStore } from '@/stores/useWaInboxStore';
import { MENU_PERMISSIONS, roleHasPermission } from '@/lib/permissions';
import {
  Calendar, Users, ShoppingBag, Package, BarChart3,
  Megaphone, Settings, ChevronLeft, ChevronRight,
  LayoutDashboard, UserCog, LogOut,
  Warehouse, Sparkles, X, Landmark, Radio, Gift, PartyPopper, CheckSquare, Zap, TrendingUp, Banknote, Receipt, MessageSquare, QrCode,
  Smartphone, BookOpen,
} from 'lucide-react';
import { getInitials } from '@/lib/helpers';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, href: '/dashboard/agenda' },
  { id: 'clients', label: 'Clienti', icon: Users, href: '/dashboard/clients' },
  // Cassa unica: vendite e contanti stanno nella stessa schermata, divisi in schede
  { id: 'pos', label: 'Cassa', icon: ShoppingBag, href: '/dashboard/pos', badge: 0 },
  { id: 'scontrini', label: 'Scontrini Fiscali', icon: Receipt, href: '/dashboard/scontrini' },
  { id: 'packages', label: 'Trattamenti e Pacchetti', icon: Package, href: '/dashboard/packages' },
  { id: 'gift-cards', label: 'Buoni Regalo', icon: Gift, href: '/dashboard/packages/gift-cards' },
  { id: 'inventory', label: 'Magazzino', icon: Warehouse, href: '/dashboard/inventory' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, href: '/dashboard/marketing' },
  { id: 'copri-buchi', label: 'Copri buchi', icon: Radio, href: '/dashboard/copri-buchi' },
  { id: 'affiliati', label: 'Affiliazione', icon: QrCode, href: '/dashboard/affiliati' },
  { id: 'reports', label: 'Report', icon: BarChart3, href: '/dashboard/reports' },
  { id: 'statistiche', label: 'Statistiche', icon: TrendingUp, href: '/dashboard/statistiche' },
  { id: 'admin', label: 'Amministrazione', icon: Landmark, href: '/dashboard/admin' },
  { id: 'staff', label: 'Staff', icon: UserCog, href: '/dashboard/staff' },
  { id: 'settings', label: 'Impostazioni', icon: Settings, href: '/dashboard/settings' },
  { id: 'app-clienti', label: 'App Clienti', icon: Smartphone, href: '/dashboard/app-clienti' },
  { id: 'inaugurazione', label: 'Inaugurazione', icon: PartyPopper, href: '/dashboard/settings/inaugurazione' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, href: '/dashboard/whatsapp' },
  { id: 'automazioni', label: 'Automazioni', icon: Zap, href: '/dashboard/automazioni' },
  // La guida sta in fondo e la vedono tutte: non c'è niente da proteggere,
  // ed è la voce che si cerca quando non si sa dove cercare.
  { id: 'guida', label: 'Guida', icon: BookOpen, href: '/dashboard/guida' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore();
  // Il tema si cambia in Impostazioni → Aspetto, dove ci sono le due
  // anteprime: qui rubava una riga al menu e faceva comparire la barra
  // di scorrimento. Qui serve solo il logo del centro.
  const { logoUrl } = useThemeStore();
  const { user, logout } = useAuthStore();
  const roles = useRolesStore(s => s.roles);
  const role = roles.find(r => r.id === user?.role);
  const roleName = role?.name ?? user?.role;
  // CONVERSAZIONI WhatsApp da leggere: il numero sul menu conta le chat da
  // aprire, non i messaggi dentro (scelta di Dino: una cliente che scrive
  // tre volte è comunque UNA chat da leggere).
  const waUnread = useWaInboxStore(s => s.chats.length);
  // Il lampeggio è l'escalation, non l'arrivo: si accende solo quando qualcuno
  // aspetta da più di un quarto d'ora. Il numerino invece compare subito.
  const waInAttesa = useWaInboxStore(s => s.inAttesa);

  // Mostra solo le voci per cui il ruolo dell'utente ha il permesso
  const visibleMenuItems = menuItems.filter(item =>
    roleHasPermission(role, MENU_PERMISSIONS[item.id] ?? null)
  );

  // Su schermi bassi le ultime voci restano sotto. Senza la barra di
  // scorrimento non si vedrebbe che c'è dell'altro, così sfuma il bordo:
  // niente striscia grigia, ma neanche voci nascoste di nascosto.
  const navRef = React.useRef<HTMLElement>(null);
  const [altroSotto, setAltroSotto] = React.useState(false);
  React.useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const calcola = () => setAltroSotto(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    calcola();
    el.addEventListener('scroll', calcola);
    window.addEventListener('resize', calcola);
    return () => {
      el.removeEventListener('scroll', calcola);
      window.removeEventListener('resize', calcola);
    };
  }, [visibleMenuItems.length, sidebarCollapsed]);

  const LogoIcon = () => logoUrl ? (
    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
  ) : (
    <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`
          fixed top-0 left-0 h-full z-50
          bg-bg-secondary border-r border-border
          flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}
          ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center h-16 px-4 border-b border-border ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {logoUrl ? (
            <Link href="/dashboard" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <img src={logoUrl} alt="Logo" className={`object-contain ${sidebarCollapsed ? 'h-9 w-9 rounded-lg' : 'h-10 max-w-[180px]'}`} />
            </Link>
          ) : (
            <>
              {!sidebarCollapsed && (
                <Link href="/dashboard" className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-display font-bold text-lg gradient-accent-text">
                    Revobeauty
                  </span>
                </Link>
              )}
              {sidebarCollapsed && (
                <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
            </>
          )}
          {/* Mobile close */}
          <button
            onClick={() => setSidebarMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restringi/allarga: un bottoncino sul bordo, all'altezza del logo.
            Prima era una riga in fondo al menu e occupava spazio come una
            voce vera, pur non essendolo. */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Allarga il menu' : 'Restringi il menu'}
          className="hidden lg:flex absolute top-[52px] -right-3 w-6 h-6 items-center justify-center
            rounded-full bg-bg-secondary border border-border text-text-secondary
            hover:text-accent hover:border-accent/50 shadow-sm transition-colors z-[60]"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Nav — tutte le voci in un elenco solo. Righe più compatte e barra
            di scorrimento nascosta: quella striscia grigia che si muoveva a
            lato dava fastidio e ora l'elenco ci sta tutto senza. */}
        <div className="relative flex-1 min-h-0">
        <nav ref={navRef} className="h-full py-2 px-2 overflow-y-auto hide-scrollbar">
          {visibleMenuItems.map((item) => {
            const activeItem = [...visibleMenuItems]
              .sort((a, b) => b.href.length - a.href.length)
              .find(mi => pathname === mi.href || (mi.href !== '/dashboard' && pathname?.startsWith(mi.href + '/')));
            
            const isActive = activeItem?.id === item.id || (item.href === '/dashboard' && pathname === '/dashboard');
            const Icon = item.icon;
            // WhatsApp lampeggia finché c'è un messaggio del cliente da leggere
            const blinking = item.id === 'whatsapp' && waInAttesa > 0;
            const badgeCount = item.id === 'whatsapp' ? waUnread : (item.badge ?? 0);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarMobileOpen(false)}
                className={`
                  group relative flex items-center gap-3 px-3 py-2 rounded-xl
                  transition-all duration-200
                  ${isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full gradient-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative flex-shrink-0">
                  <Icon className={`w-5 h-5 ${blinking ? 'text-error' : isActive ? 'text-accent' : ''}`} />
                  {blinking && (
                    <>
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-error animate-ping" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-error" />
                    </>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-sm font-medium truncate ${blinking ? 'text-error font-bold' : ''}`}>{item.label}</span>
                )}
                {!sidebarCollapsed && badgeCount > 0 && (
                  <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-error text-white ${blinking ? 'animate-pulse' : ''}`}>
                    {badgeCount}
                  </span>
                )}
                {/* Tooltip for collapsed */}
                {sidebarCollapsed && (
                  <div className="
                    absolute left-full ml-2 px-2.5 py-1.5 rounded-lg
                    bg-bg-tertiary text-text-primary text-sm font-medium
                    shadow-lg border border-border
                    opacity-0 group-hover:opacity-100 pointer-events-none
                    transition-opacity whitespace-nowrap z-[60]
                  ">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
        {altroSotto && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bg-secondary to-transparent" />
        )}
        </div>

        {/* Footer: solo chi è collegato. Tema e Comprimi non stanno più qui. */}
        <div className="p-2 border-t border-border">
          {/* User Profile */}
          {user && (
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {getInitials(user.firstName, user.lastName)}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-text-muted truncate">{roleName}</p>
                </div>
              )}
              {!sidebarCollapsed && (
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-error transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
