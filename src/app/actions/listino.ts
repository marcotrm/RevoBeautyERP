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
import { sendWhatsAppTemplate } from '@/lib/whatsapp';
import { listD360Templates, createD360Template } from '@/lib/whatsapp360';
import { WA_TEMPLATES, resolveButtonUrl } from '@/lib/wa-templates';

export async function urlListino(): Promise<string> {
  // Stessa origine dei QR degli affiliati: un indirizzo pubblico solo.
  return `${publicOrigin() || 'https://erp.revobeauty.it'}/listino`;
}

export async function mandaListino(params: {
  phone: string;
  nome?: string;
}): Promise<{ ok: boolean; error?: string; testo?: string; conTemplate?: boolean }> {
  const link = await urlListino();
  const nome = (params.nome || '').trim().split(' ')[0];
  const testo = [
    nome ? `Ciao ${nome}!` : 'Ciao!',
    `Ecco il nostro listino aggiornato: ${link}`,
    `Se ti serve un consiglio o vuoi prenotare, rispondi pure a questo messaggio. ${CENTRO.nome}`,
  ].join('\n');

  // Prima si prova il testo libero: dentro le 24 ore non costa niente e arriva
  // col link scritto per esteso, che si legge meglio di un bottone.
  const libero = await sendManualReply(params.phone, testo);
  if (libero.ok) return { ok: true, testo };

  /*
    Fuori dalle 24 ore comanda Meta: si può scrivere solo con un template
    approvato. È il caso normale al banco — la cliente non ha mai scritto — e
    prima qui ci si fermava con un errore che sembrava un guasto del
    gestionale.
  */
  const tpl = WA_TEMPLATES.listino;
  const stato = await statoTemplateListino();
  if (stato.stato !== 'APPROVED') {
    return {
      ok: false,
      testo,
      error: stato.stato === 'ASSENTE'
        ? 'Fuori dalle 24 ore serve un template approvato, e non è ancora stato creato. Mandalo in approvazione da Automazioni.'
        : `Fuori dalle 24 ore serve il template, che Meta non ha ancora approvato (${stato.stato}). Intanto fagli inquadrare il QR.`,
    };
  }

  const res = await sendWhatsAppTemplate(params.phone, 'listino', {
    bodyParams: [nome || 'ciao'],
    fallbackText: testo,
    source: 'manual',
  });
  return res.ok
    ? { ok: true, testo: `${tpl.body.replace('{{1}}', nome || '')}\n[${tpl.buttons?.[0]?.text}] ${resolveButtonUrl('listino')}`, conTemplate: true }
    : { ok: false, error: res.error || 'Invio fallito', testo };
}

/** Se il template del listino esiste su Meta e a che punto è. */
export async function statoTemplateListino(): Promise<{ stato: string }> {
  const tpl = WA_TEMPLATES.listino;
  const remote = await listD360Templates();
  if (!remote.ok) return { stato: 'SCONOSCIUTO' };
  const trovato = remote.templates.find(t => t.name === tpl.name && t.language.toLowerCase().startsWith('it'));
  return { stato: trovato ? trovato.status.toUpperCase() : 'ASSENTE' };
}

/**
 * Manda il template in approvazione a Meta.
 *
 * Si fa una volta sola: se esiste già si torna indietro col suo stato, perché
 * un template approvato non si può riscrivere e ricrearlo con lo stesso nome
 * è vietato per trenta giorni.
 */
export async function creaTemplateListino(): Promise<{ ok: boolean; stato?: string; nota?: string; error?: string }> {
  const tpl = WA_TEMPLATES.listino;
  const gia = await statoTemplateListino();
  if (gia.stato !== 'ASSENTE' && gia.stato !== 'SCONOSCIUTO') {
    return { ok: true, stato: gia.stato, nota: gia.stato === 'APPROVED' ? 'pronto' : 'in attesa di Meta' };
  }
  const res = await createD360Template({
    name: tpl.name,
    category: tpl.category,
    language: tpl.language,
    body: tpl.body,
    example: ['Maria'],
    buttons: [{ type: 'URL', text: tpl.buttons![0].text, url: resolveButtonUrl('listino') }],
  });
  return res.ok
    ? { ok: true, stato: res.status || 'PENDING', nota: 'mandato a Meta' }
    : { ok: false, error: res.error };
}
