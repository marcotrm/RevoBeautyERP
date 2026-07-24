'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { useUIStore } from '@/stores/useUIStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRolesStore } from '@/stores/useRolesStore';
import { permissionForPath, roleHasPermission } from '@/lib/permissions';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const roles = useRolesStore(s => s.roles);
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const unsubHydrate = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    setIsHydrated(useAuthStore.persist.hasHydrated());
    return () => {
      unsubHydrate();
    };
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated || !isAuthenticated) return null;

  const role = roles.find(r => r.id === user?.role);
  const requiredPerm = permissionForPath(pathname);
  const allowed = roleHasPermission(role, requiredPerm);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'
        }`}
      >
        <Topbar />
        <main className="p-4 lg:p-6 page-enter">
          {allowed ? children : (
            <div className="flex flex-col items-center justify-center text-center py-24 px-4">
              <div className="w-16 h-16 rounded-2xl bg-error/10 text-error flex items-center justify-center mb-5">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-display font-bold text-text-primary">Accesso non consentito</h2>
              <p className="text-sm text-text-secondary mt-2 max-w-md">
                Il tuo ruolo non dispone dei permessi per accedere a questa sezione.
                Contatta un amministratore se pensi si tratti di un errore.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:scale-105 transition-all"
                >
                  Torna alla Dashboard
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm font-medium hover:bg-bg-hover transition-colors"
                >
                  Esci
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
