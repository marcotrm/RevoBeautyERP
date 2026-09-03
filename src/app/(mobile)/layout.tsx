'use client';

/**
 * Le pagine del telefono stanno tutte qui dentro.
 *
 * È un gruppo di rotte fra parentesi: gli indirizzi restano quelli di prima
 * (/agenda-mobile, /dashboard-mobile…), cambia solo che adesso condividono la
 * barra in fondo e — soprattutto — lo stesso controllo dei permessi del
 * gestionale grande. Prima queste pagine stavano fuori da quel controllo:
 * bastava conoscere l'indirizzo per aprire la cassaforte con qualunque
 * account.
 */

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import MobileTabs from '@/components/MobileTabs';
import VersioneNuova from '@/components/VersioneNuova';
import Presenza from '@/components/Presenza';
import Trillo from '@/components/Trillo';
import PopupImmondizia from '@/components/PopupImmondizia';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRolesStore } from '@/stores/useRolesStore';
import { permissionForPath, roleHasPermission } from '@/lib/permissions';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const refreshSession = useAuthStore(s => s.refreshSession);
  const roles = useRolesStore(s => s.roles);
  const rolesLoaded = useRolesStore(s => s.loaded);
  const fetchRoles = useRolesStore(s => s.fetchRoles);
  const router = useRouter();
  const percorso = usePathname();
  const [idratato, setIdratato] = useState(false);

  useEffect(() => {
    const stop = useAuthStore.persist.onFinishHydration(() => setIdratato(true));
    setIdratato(useAuthStore.persist.hasHydrated());
    return () => stop();
  }, []);

  useEffect(() => { if (idratato && !isAuthenticated) router.push('/login'); }, [idratato, isAuthenticated, router]);

  useEffect(() => {
    if (idratato && isAuthenticated) { fetchRoles(); refreshSession(); }
  }, [idratato, isAuthenticated, fetchRoles, refreshSession]);

  if (!idratato || !isAuthenticated) return null;

  // Finché i permessi non sono arrivati non si decide: un "negato" lampeggiato
  // per sbaglio fa credere che il gestionale sia rotto.
  if (!rolesLoaded) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const ruolo = roles.find(r => r.id === user?.role);
  const permesso = roleHasPermission(ruolo, permissionForPath(percorso));

  return (
    <div className="min-h-screen bg-bg-primary">
      {permesso ? children : (
        <div className="flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">Accesso non consentito</h2>
          <p className="text-sm text-text-secondary mt-1">Questa parte non è prevista per il tuo profilo.</p>
        </div>
      )}
      <VersioneNuova />
      <Presenza />
      <Trillo />
      <PopupImmondizia />
      <MobileTabs />
    </div>
  );
}
