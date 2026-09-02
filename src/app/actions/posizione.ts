'use server';

/**
 * «Dove siete?» — la domanda piu' frequente dopo «quanto viene».
 *
 * La risposta giusta non e' l'indirizzo scritto: chi la fa e' quasi sempre gia'
 * in macchina, e una via da ricopiare a mano nel navigatore non serve. Serve il
 * cartoncino con la mappa, quello che si tocca e apre le indicazioni.
 *
 * Due strade, in ordine di bellezza. Se in Impostazioni c'e' il link di Google
 * Maps del centro si mandano le coordinate vere, e su WhatsApp esce la mappa.
 * Se non c'e', si manda il link — che apre lo stesso il navigatore, ma e' una
 * riga di testo invece di un riquadro.
 */

import { leggiCentro, coordinateDa } from '@/lib/centro';
import { sendWhatsAppLocation } from '@/lib/whatsapp';
import { sendManualReply } from '@/app/actions/whatsapp';

/** Il link da mandare quando le coordinate non ci sono: la ricerca dell'indirizzo. */
export async function linkMappa(): Promise<string> {
  const c = await leggiCentro().catch(() => null);
  if (c?.mappa) return c.mappa;
  const indirizzo = [c?.nome, c?.indirizzo].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo || 'RevoBeauty Maddaloni')}`;
}

export async function mandaPosizione(phone: string): Promise<{ ok: boolean; conMappa?: boolean; errore?: string }> {
  const c = await leggiCentro().catch(() => null);
  const coord = coordinateDa(c?.mappa);

  if (coord) {
    const res = await sendWhatsAppLocation(phone, {
      lat: coord.lat,
      lng: coord.lng,
      nome: c?.nome || 'RevoBeauty',
      indirizzo: c?.indirizzo || '',
    });
    if (res.ok) return { ok: true, conMappa: true };
    // Fuori dalle 24 ore la mappa non passa: meglio il link che niente.
    const testo = await messaggioConLink(c?.indirizzo);
    const rip = await sendManualReply(phone, testo);
    return rip.ok ? { ok: true, conMappa: false } : { ok: false, errore: rip.error || res.error };
  }

  const testo = await messaggioConLink(c?.indirizzo);
  const res = await sendManualReply(phone, testo);
  return res.ok ? { ok: true, conMappa: false } : { ok: false, errore: res.error };
}

async function messaggioConLink(indirizzo?: string): Promise<string> {
  const link = await linkMappa();
  return [
    indirizzo ? `Siamo in ${indirizzo}.` : 'Ecco dove siamo.',
    `Qui trovi la mappa: ${link}`,
  ].join('\n');
}
