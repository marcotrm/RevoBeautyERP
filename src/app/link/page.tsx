/**
 * La pagina da mettere nella bio di Instagram.
 *
 * Su Instagram si puo' mettere un link solo, e finora quel link non c'era: chi
 * vedeva un video e voleva prenotare doveva scrivere in privato e aspettare
 * che qualcuno rispondesse. Meta' di quelle persone non scrivono proprio.
 *
 * Qui c'e' tutto quello che una cliente cerca in quel momento, in ordine di
 * quanto serve: prenota, listino, dove siamo, scrivici, lasciaci una
 * recensione. Niente javascript, niente immagini pesanti: si apre subito
 * anche con una tacca di segnale.
 */

import type { Metadata } from 'next';
import { CENTRO, leggiCentro, type Centro } from '@/lib/centro';
import { linkMappa } from '@/app/actions/posizione';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Se il database non risponde, meglio i dati di partenza che una pagina rotta. */
async function centroSicuro(): Promise<Centro> {
  try {
    return await leggiCentro();
  } catch {
    return CENTRO;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const c = await centroSicuro();
  return {
    title: `${c.nome} — prenota online`,
    description: `Prenota il tuo trattamento da ${c.nome}${c.indirizzo ? `, ${c.indirizzo}` : ''}. Agenda sempre aggiornata, disponibilità in tempo reale.`,
    openGraph: {
      title: `${c.nome} — prenota online`,
      description: 'Scegli il trattamento, l’operatrice e l’orario. In un minuto.',
      type: 'website',
    },
  };
}

const P = '#A855F7';

/** Il link Google per lasciare una recensione, se e' stato collegato il posto. */
async function linkRecensione(): Promise<string | null> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: 'recensioni:google' } });
    const d = (r?.data || {}) as { placeId?: string; link?: string };
    if (d.link) return d.link;
    if (d.placeId) return `https://search.google.com/local/writereview?placeid=${d.placeId}`;
    return null;
  } catch {
    return null;
  }
}

export default async function LinkInBio() {
  const centro = await centroSicuro();
  const [mappa, recensione] = await Promise.all([linkMappa(), linkRecensione()]);
  const telefono = (centro.telefono || '').replace(/\s/g, '');
  const whatsapp = telefono ? `https://wa.me/${telefono.replace(/\D/g, '').replace(/^0+/, '39')}` : null;

  const oggi = new Date().getDay() === 0 ? '7' : String(new Date().getDay());
  const orarioOggi = centro.orari?.[oggi];

  const voci: { href: string; titolo: string; sotto: string; icona: string; forte?: boolean }[] = [
    { href: '/prenota', titolo: 'Prenota online', sotto: 'scegli trattamento, operatrice e orario', icona: '📅', forte: true },
    { href: '/listino', titolo: 'Il listino', sotto: 'tutti i trattamenti e i prezzi', icona: '💅' },
    { href: '/shop', titolo: 'I prodotti', sotto: 'ordina qui, ritiri e paghi in centro', icona: '🧴' },
    ...(whatsapp ? [{ href: whatsapp, titolo: 'Scrivici su WhatsApp', sotto: 'rispondiamo anche la sera', icona: '💬' }] : []),
    ...(mappa ? [{ href: mappa, titolo: 'Dove siamo', sotto: centro.indirizzo || 'apri le mappe', icona: '📍' }] : []),
    ...(telefono ? [{ href: `tel:${telefono}`, titolo: 'Chiamaci', sotto: telefono, icona: '📞' }] : []),
    ...(recensione ? [{ href: recensione, titolo: 'Lasciaci una recensione', sotto: 'ci vuole un minuto e ci aiuta tanto', icona: '⭐' }] : []),
  ];

  return (
    <main style={{
      minHeight: '100vh', margin: 0, padding: '32px 18px 48px',
      background: 'linear-gradient(180deg,#faf7fd 0%,#f4edfb 100%)',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{
            width: 74, height: 74, borderRadius: 24, margin: '0 auto 14px',
            background: `linear-gradient(135deg,${P},#EC4899)`, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 800, boxShadow: '0 10px 30px rgba(168,85,247,.28)',
          }}>
            {centro.nome.charAt(0)}
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 25, color: '#241f2b' }}>{centro.nome}</h1>
          {centro.indirizzo && <p style={{ margin: 0, fontSize: 14, color: '#7c7488' }}>{centro.indirizzo}</p>}
          <p style={{ margin: '10px 0 0', fontSize: 13, color: orarioOggi ? '#16a34a' : '#9a94a3', fontWeight: 600 }}>
            {orarioOggi ? `Oggi aperto ${orarioOggi.apre}–${orarioOggi.chiude}` : 'Oggi chiuso'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {voci.map(v => (
            <a key={v.href} href={v.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
                borderRadius: 16, textDecoration: 'none',
                background: v.forte ? `linear-gradient(90deg,${P},#EC4899)` : '#fff',
                color: v.forte ? '#fff' : '#241f2b',
                border: v.forte ? 'none' : '1px solid #ece6f4',
                boxShadow: v.forte ? '0 8px 24px rgba(168,85,247,.25)' : '0 2px 10px rgba(36,31,43,.04)',
              }}>
              <span style={{ fontSize: 24 }}>{v.icona}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{v.titolo}</span>
                <span style={{ display: 'block', fontSize: 12.5, opacity: v.forte ? 0.92 : 0.6, marginTop: 2 }}>{v.sotto}</span>
              </span>
            </a>
          ))}
        </div>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: '#a49dae' }}>
          {centro.sito || ''}
        </p>
      </div>
    </main>
  );
}
