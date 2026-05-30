'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/useUIStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { mockLocations, mockNotifications } from '@/lib/mock-data';
import {
  Search, Bell, Menu, ChevronDown,
  MapPin, Command, LogOut, User as UserIcon
} from 'lucide-react';
import { getInitials, getRelativeTime } from '@/lib/helpers';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/clients': 'Clienti',
  '/dashboard/pos': 'Punto Cassa',
  '/dashboard/packages': 'Pacchetti & Abbonamenti',
  '/dashboard/packages/gift-cards': 'Buoni Regalo',
  '/dashboard/inventory': 'Magazzino',
  '/dashboard/marketing': 'Marketing',
  '/dashboard/reports': 'Report & Analytics',
  '/dashboard/staff': 'Gestione Staff',
  '/dashboard/settings': 'Impostazioni',
};

export default function Topbar() {
  const pathname = usePathname();
  const { setSidebarMobileOpen, setCommandPaletteOpen, sidebarCollapsed } = useUIStore();
  const { user, currentLocationId, setCurrentLocation, logout } = useAuthStore();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showLocationPicker, setShowLocationPicker] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const router = useRouter();
  
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const currentLocation = mockLocations.find(l => l.id === currentLocationId);
  const unreadCount = mockNotifications.filter(n => !n.isRead).length;
  const pageTitle = pageTitles[pathname || ''] || 'Revobeauty';

  return (
    <header className="h-16 border-b border-border bg-bg-secondary/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <button
          onClick={() => setSidebarMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg font-display font-semibold text-text-primary">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        {/* Search - Desktop/Tablet */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary border border-border hover:border-border-light text-text-muted text-sm transition-all duration-200 min-w-[200px]"
        >
          <Search className="w-4 h-4" />
          <span>Cerca...</span>
          <kbd className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg-hover text-[10px] font-medium text-text-muted border border-border">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        {/* Search - Mobile */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="md:hidden p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Location Picker */}
        <div className="relative">
          <button
            onClick={() => setShowLocationPicker(!showLocationPicker)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"
          >
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">{currentLocation?.name}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <AnimatePresence>
            {showLocationPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLocationPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-12 w-64 bg-bg-secondary border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-2">
                    <p className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Seleziona Sede
                    </p>
                    {mockLocations.map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => {
                          setCurrentLocation(loc.id);
                          setShowLocationPicker(false);
                        }}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors
                          ${loc.id === currentLocationId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-hover text-text-primary'}
                        `}
                      >
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{loc.name}</p>
                          <p className="text-xs text-text-muted">{loc.address}, {loc.city}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 flex items-center justify-center rounded-full bg-error text-white text-[10px] font-bold min-w-[18px] h-[18px]">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-12 w-80 bg-bg-secondary border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-text-primary">Notifiche</h3>
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                      {unreadCount} nuove
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {mockNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          setShowNotifications(false);
                          router.push('/dashboard/admin/automations');
                        }}
                        className={`px-4 py-3 border-b border-border/50 hover:bg-bg-hover transition-colors cursor-pointer ${
                          !notif.isRead ? 'bg-accent/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notif.isRead && (
                            <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary">{notif.title}</p>
                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[11px] text-text-muted mt-1">{getRelativeTime(notif.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3">
                    <button 
                      onClick={() => {
                        setShowNotifications(false);
                        router.push('/dashboard/admin/automations');
                      }}
                      className="w-full text-center text-sm text-accent font-medium hover:underline py-1"
                    >
                      Vedi tutte le notifiche
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar */}
        {user && (
          <div className="relative hidden sm:flex items-center pl-2 ml-1 border-l border-border">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-bg-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {getInitials(user.firstName, user.lastName)}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-12 w-56 bg-bg-secondary border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-semibold text-text-primary">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-text-muted capitalize">{user.role}</p>
                    </div>
                    <div className="p-2">
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-bg-hover text-sm text-text-secondary transition-colors">
                        <UserIcon className="w-4 h-4" /> Profilo
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-error/10 text-sm text-error transition-colors mt-1"
                      >
                        <LogOut className="w-4 h-4" /> Esci
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
