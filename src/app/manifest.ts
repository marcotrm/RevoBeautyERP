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
    /*
      I colori del marchio, non piu' il grigio-blu di partenza: sono quelli
      che il telefono usa per la schermata di avvio e per la barra di stato,
      e con l'icona crema e oro un fondo bluastro stonava.
    */
    background_color: '#F7F3E9',
    theme_color: '#0A0A0A',
    lang: 'it',
    icons: [
      { src: '/icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      /*
        Android ritaglia l'icona nella forma che ha deciso il telefono —
        cerchio, goccia, quadrato stondato — e lo fa sul disegno intero. Con
        la sola icona "any" il marchio ci va a sbattere e si vedono le lettere
        tagliate: questa ha lo stesso marchio piu' piccolo, dentro la zona che
        nessun ritaglio tocca.
      */
      { src: '/icona-mascherabile-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
