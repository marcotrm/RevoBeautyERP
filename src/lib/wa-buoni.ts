/**
 * L'avviso a chi riceve un buono regalo.
 *
 * Finora il buono lo sapeva solo chi lo comprava: il codice restava su un
 * biglietto, o in un messaggio scritto a mano che spesso non partiva. La
 * persona regalata scopriva di avere un buono quando qualcuno si ricordava di
 * dirglielo — e un regalo che nessuno usa è un regalo perso per lei e un
 * incasso fermo per il centro.
 *
 * Il messaggio parte alla creazione del buono, una volta sola, e solo se al
 * banco è stato scritto il numero di chi riceve. Se non parte non succede
 * niente di grave: il codice si consegna a voce, come si è sempre fatto.
 */

import { prisma } from '@/lib/prisma';
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { sanitizeParam, WA_TEMPLATES } from '@/lib/wa-templates';

const KIND = 'wa_log';

function euro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function giorno(ymd: string): string {
  const [a, m, g] = (ymd || '').split('-');
  return a && m && g ? `${g}/${m}/${a}` : ymd;
}

export async function sendBuonoRegalo(giftCardId: string): Promise<{ ok: boolean; error?: string }> {
  const gc = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!gc) return { ok: false, error: 'Buono non trovato' };
  if (!gc.recipientPhone || !isSendablePhone(gc.recipientPhone)) {
    return { ok: false, error: 'Nessun numero per chi riceve il buono' };
  }

  const numero = normalizePhone(gc.recipientPhone);
  /*
    Una volta sola per buono: il codice è unico, e se qualcuno riapre la
    creazione o il server riparte a metà, il messaggio non si ripete.
  */
  const rowId = `wa:buono:${gc.code}`;
  const sentAt = new Date().toISOString();
  try {
    await prisma.adminEntry.create({
      data: {
        rowId, kind: KIND, entityId: rowId,
        data: { automation: 'buonoRegalo', phone: numero, sentAt, ok: false, inCorso: true } as unknown as object,
        createdAt: sentAt,
      },
    });
  } catch {
    // Riga già presente: l'avviso è già partito (o ci sta provando qualcun altro).
    return { ok: false, error: 'Avviso già inviato per questo buono' };
  }

  // Solo il nome di battesimo: "Ciao Maria Rossi" non lo scrive nessuno.
  const nome = sanitizeParam(gc.recipientName.trim().split(' ')[0] || gc.recipientName);
  const daParte = sanitizeParam(gc.purchasedBy.trim().split(' ')[0] || gc.purchasedBy);
  const params = [nome, daParte, euro(gc.amount), gc.code, giorno(gc.expiryDate)];

  const res = await sendWhatsAppTemplate(numero, 'buonoRegalo', {
    bodyParams: params,
    fallbackText: WA_TEMPLATES.buonoRegalo.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? ''),
  });

  await prisma.adminEntry.update({
    where: { rowId },
    data: {
      data: {
        automation: 'buonoRegalo', phone: numero, sentAt,
        messageId: res.messageId, ok: res.ok, error: res.error,
      } as unknown as object,
    },
  }).catch(() => {});

  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
