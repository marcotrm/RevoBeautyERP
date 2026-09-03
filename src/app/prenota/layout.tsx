/**
 * Quello che Google legge della pagina di prenotazione.
 *
 * "Prenota con Google" vero e proprio e' un accordo fra Google e le
 * piattaforme di prenotazione, e non si puo' attivare da qui. Quello che si
 * puo' fare — e che copre il 90% del vantaggio — e' dire a Google in modo
 * comprensibile chi siamo, dove siamo, quando siamo aperti e che da questa
 * pagina si prenota: cosi' la scheda del centro puo' mostrare il link giusto
 * invece di far cercare il numero.
 *
 * I dati arrivano da Impostazioni → Centro: se cambia l'indirizzo o l'orario,
 * cambia anche quello che legge Google, senza toccare niente qui.
 */

import type { Metadata } from 'next';
import { leggiCentro } from '@/lib/centro';

export async function generateMetadata(): Promise<Metadata> {
  const c = await leggiCentro();
  const titolo = `Prenota online — ${c.nome}`;
  const descrizione = `Prenota il tuo trattamento da ${c.nome}${c.indirizzo ? ` (${c.indirizzo})` : ''}: scegli trattamento, operatrice e orario. Disponibilità in tempo reale.`;
  return {
    title: titolo,
    description: descrizione,
    alternates: { canonical: '/prenota' },
    openGraph: { title: titolo, description: descrizione, type: 'website' },
    robots: { index: true, follow: true },
  };
}

const GIORNI = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default async function PrenotaLayout({ children }: { children: React.ReactNode }) {
  const c = await leggiCentro();

  const apertura = Object.entries(c.orari || {})
    .filter(([, o]) => !!o)
    .map(([giorno, o]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: GIORNI[Number(giorno) - 1],
      opens: o?.apre,
      closes: o?.chiude,
    }));

  const [via, citta] = (c.indirizzo || '').split('·').map(s => s.trim());

  const dati = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: c.nome,
    ...(c.telefono ? { telephone: c.telefono } : {}),
    ...(c.sito ? { url: c.sito.startsWith('http') ? c.sito : `https://${c.sito}` } : {}),
    ...(c.mappa ? { hasMap: c.mappa } : {}),
    ...(via ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: via,
        ...(citta ? { addressLocality: citta } : {}),
        addressCountry: 'IT',
      },
    } : {}),
    ...(apertura.length ? { openingHoursSpecification: apertura } : {}),
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://erp.revobeauty.it/prenota',
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: { '@type': 'Reservation', name: 'Prenotazione trattamento' },
    },
  };

  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dati) }} />
      {children}
    </>
  );
}
