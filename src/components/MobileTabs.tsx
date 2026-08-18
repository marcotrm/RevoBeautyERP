'use client';

/**
 * La barra in fondo, quella che sul telefono si usa col pollice.
 *
 * Le pagine per il telefono c'erano già ma erano isole: ci si arrivava solo da
 * un link dentro il gestionale grande, e da una non si passava all'altra. Da
 * qui invece si gira, come in una qualsiasi app.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Euro, Users, Home } from 'lucide-react';

const VOCI = [
  { href: '/m', label: 'Casa', icona: Home },
  { href: '/agenda-mobile', label: 'Agenda', icona: CalendarDays },
  { href: '/dashboard-mobile', label: 'Incassi', icona: Euro },
  { href: '/clienti-mobile', label: 'Clienti', icona: Users },
];

export default function MobileTabs() {
  const percorso = usePathname();
  return (
    <>
      {/* Spazio sotto al contenuto: se no la barra copre l'ultima riga. */}
      <div className="h-[76px]" />
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-bg-secondary/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {VOCI.map(v => {
            const Icona = v.icona;
            const attiva = percorso === v.href || (v.href !== '/m' && percorso.startsWith(v.href));
            return (
              <Link key={v.href} href={v.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${attiva ? 'text-accent' : 'text-text-muted'}`}>
                <Icona className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{v.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
