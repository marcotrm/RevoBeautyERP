'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/useUIStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  Calendar, Users, ShoppingBag, Package, BarChart3,
  Megaphone, Settings, ChevronLeft, ChevronRight,
  LayoutDashboard, UserCog, Sun, Moon, LogOut,
  Warehouse, Sparkles, X, Landmark, Gift, PartyPopper,
} from 'lucide-react';
import { getInitials } from '@/lib/helpers';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, href: '/dashboard/agenda' },
  { id: 'clients', label: 'Clienti', icon: Users, href: '/dashboard/clients' },
  { id: 'pos', label: 'Cassa', icon: ShoppingBag, href: '/dashboard/pos', badge: 0 },
  { id: 'packages', label: 'Trattamenti e Pacchetti', icon: Package, href: '/dashboard/packages' },
  { id: 'gift-cards', label: 'Buoni Regalo', icon: Gift, href: '/dashboard/packages/gift-cards' },
  { id: 'inventory', label: 'Magazzino', icon: Warehouse, href: '/dashboard/inventory' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, href: '/dashboard/marketing' },
  { id: 'reports', label: 'Report', icon: BarChart3, href: '/dashboard/reports' },
  { id: 'admin', label: 'Amministrazione', icon: Landmark, href: '/dashboard/admin' },
  { id: 'staff', label: 'Staff', icon: UserCog, href: '/dashboard/staff' },
  { id: 'settings', label: 'Impostazioni', icon: Settings, href: '/dashboard/settings' },
  { id: 'inaugurazione', label: 'Inaugurazione', icon: PartyPopper, href: '/dashboard/settings/inaugurazione' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore();
  const { isDark, toggleTheme, logoUrl } = useThemeStore();
  const { user, logout } = useAuthStore();

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

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {menuItems.map((item) => {
            const activeItem = [...menuItems]
              .sort((a, b) => b.href.length - a.href.length)
              .find(mi => pathname === mi.href || (mi.href !== '/dashboard' && pathname?.startsWith(mi.href + '/')));
            
            const isActive = activeItem?.id === item.id || (item.href === '/dashboard' && pathname === '/dashboard');
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarMobileOpen(false)}
                className={`
                  group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
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
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-accent' : ''}`} />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-error text-white">
                    {item.badge}
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

        {/* Footer */}
        <div className="p-2 border-t border-border space-y-1">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-text-secondary hover:text-text-primary hover:bg-bg-hover
              transition-all duration-200
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">{isDark ? 'Tema Chiaro' : 'Tema Scuro'}</span>
            )}
          </button>

          {/* Collapse Toggle (Desktop) */}
          <button
            onClick={toggleSidebar}
            className={`
              hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl
              text-text-secondary hover:text-text-primary hover:bg-bg-hover
              transition-all duration-200
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="text-sm font-medium">Comprimi</span>}
          </button>

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
                  <p className="text-xs text-text-muted truncate capitalize">{user.role}</p>
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
