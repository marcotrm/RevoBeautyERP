'use server';

/**
 * Mandare il listino alla cliente, dal banco.
 *
 * La domanda arriva sempre di persona ("quanto viene la pulizia viso?") e la
 * risposta migliore non è un foglio: è il link della pagina del listino, che
 * resta sul suo telefono e resta aggiornato.
 *
 * Il messaggio parte come testo libero, quindi solo se la cliente ha scritto
 * nelle ultime 24 ore — è Meta a comandare, non noi. Quando la finestra è
 * chiusa non si finge: si dice com'è e si propone il QR, che al banco funziona
 * meglio di qualunque messaggio.
 */

import { sendManualReply } from '@/app/actions/whatsapp';
import { CENTRO } from '@/lib/centro';
import { publicOrigin } from '@/lib/affiliazione';

export async function urlListino(): Promise<string> {
  // Stessa origine dei QR degli affiliati: un indirizzo pubblico solo.
  return `${publicOrigin() || 'https://erp.revobeauty.it'}/listino`;
}

export async function mandaListino(params: {
  phone: string;
  nome?: string;
}): Promise<{ ok: boolean; error?: string; testo?: string }> {
  const link = await urlListino();
  const nome = (params.nome || '').trim().split(' ')[0];
  const testo = [
    nome ? `Ciao ${nome}!` : 'Ciao!',
    `Ecco il nostro listino aggiornato: ${link}`,
    `Se ti serve un consiglio o vuoi prenotare, rispondi pure a questo messaggio. ${CENTRO.nome}`,
  ].join('\n');

  const res = await sendManualReply(params.phone, testo);
  return res.ok ? { ok: true, testo } : { ok: false, error: res.error, testo };
}
