/**
 * Le pagine del telefono stanno tutte qui dentro.
 *
 * È un gruppo di rotte fra parentesi: gli indirizzi restano quelli di prima
 * (/agenda-mobile, /dashboard-mobile…), cambia solo che adesso condividono la
 * barra in fondo.
 */

import MobileTabs from '@/components/MobileTabs';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {children}
      <MobileTabs />
    </div>
  );
}
