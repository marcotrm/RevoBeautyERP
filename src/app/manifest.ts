import type { MetadataRoute } from 'next';

/**
 * Il biglietto da visita per il telefono.
 *
 * Con questo, "Aggiungi alla schermata Home" non crea una scorciatoia del
 * browser ma un'icona che apre il gestionale a schermo intero, senza barra
 * degli indirizzi: sul telefono si comporta come un'app.
 *
 * Si parte da /m e non da /dashboard: chi apre dal telefono vuole la giornata,
 * non la scrivania.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Revobeauty',
    short_name: 'Revobeauty',
    description: 'Agenda, incassi e clienti del centro, dal telefono.',
    start_url: '/m',
    display: 'standalone',
    background_color: '#0F1117',
    theme_color: '#0F1117',
    lang: 'it',
    icons: [
      { src: '/icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
