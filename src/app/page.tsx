'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  
  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    /*
      Da telefono si entra dalla porta del telefono.

      Non è una scelta estetica: l'agenda del gestionale è fatta di colonne per
      operatrice e su uno schermo da 375px non si legge. Chi vuole comunque
      quella ha il link "Apri il gestionale completo" dentro /m, e da lì il
      browser si ricorda dove stava.

      Il controllo è sul puntatore, non sulla larghezza: un portatile con la
      finestra stretta resta un computer, un telefono girato in orizzontale
      resta un telefono.
    */
    const telefono = typeof window !== 'undefined'
      && window.matchMedia('(pointer: coarse)').matches
      && Math.min(window.innerWidth, window.innerHeight) < 820;
    router.replace(telefono ? '/m' : '/dashboard');
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <p className="text-text-secondary text-sm">Caricamento...</p>
      </div>
    </div>
  );
}
