'use server';

import { prisma } from '@/lib/prisma';
import { emettiScontrinoElettronico } from '@/lib/scontrino';
import { notifyIncasso } from '@/lib/telegram';
import { sendBuonoRegalo } from '@/lib/wa-buoni';
import { sendWhatsAppTemplate, normalizePhone } from '@/lib/whatsapp';
import { sanitizeParam, WA_TEMPLATES } from '@/lib/wa-templates';
import type { GiftCard, GiftCardTransaction } from '@/stores/useGiftCardStore';
import { eMisto } from '@/lib/pagamenti';

function toGiftCard(gc: {
  id: string; code: string; purchasedBy: string; recipientName: string; recipientPhone: string | null;
  amount: number; remainingBalance: number; purchaseDate: string; expiryDate: string; paymentMethod: string;
  purchaseOperator: string; status: string; message: string | null; transactions: unknown;
  cardCode?: string | null;
}): GiftCard {
  return {
    ...gc,
    cardCode: gc.cardCode ?? undefined,
    recipientPhone: gc.recipientPhone ?? undefined,
    message: gc.message ?? undefined,
    paymentMethod: gc.paymentMethod as GiftCard['paymentMethod'],
    status: gc.status as GiftCard['status'],
    transactions: (gc.transactions as unknown as GiftCardTransaction[]) ?? [],
  };
}

/**
 * Il codice della card, ripulito.
 *
 * La pistola aggiunge spazi e a volte un a-capo, e la stessa tessera letta
 * due volte deve risultare la stessa: maiuscolo e senza spazi. Se il centro
 * lo scrive a mano invece di sparare, arriva comunque uguale.
 */
// Niente `export`: in un file 'use server' tutto quello che esce dev'essere
// una funzione async, e questa e' solo una ripulita di stringa.
function normalizzaCard(codice?: string | null): string {
  return (codice || '').replace(/\s+/g, '').toUpperCase();
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `RB-${new Date().getFullYear()}-${code}`;
}

export async function getGiftCards() {
  const giftCards = await prisma.giftCard.findMany({ orderBy: { purchaseDate: 'desc' } });
  return giftCards.map(toGiftCard);
}

export async function createGiftCard(data: {
  purchasedBy: string;
  recipientName: string;
  recipientPhone?: string;
  /** Il codice a barre della card plastificata, sparato con la pistola. */
  cardCode?: string;
  amount: number;
  paymentMethod: GiftCard['paymentMethod'];
  operator: string;
  validityMonths: number;
  message?: string;
}) {
  const now = new Date();
  const exp = new Date(now);
  exp.setMonth(exp.getMonth() + data.validityMonths);

  /*
    Una tessera, un buono.

    Il controllo sta qui e non nel database: un vincolo unico a schema fa
    fermare il `prisma db push` che gira all'avvio su Railway, e il
    gestionale non parte proprio — successo, il 4 settembre. Qui invece si
    puo' anche dire a chi sta al banco di che card si tratta, che e' l'unica
    cosa che gli serve per risolverla.
  */
  const card = normalizzaCard(data.cardCode);
  if (card) {
    const giaUsata = await prisma.giftCard.findFirst({
      where: { cardCode: card },
      select: { recipientName: true, remainingBalance: true },
    });
    if (giaUsata) {
      throw new Error(
        `Questa card e' gia' legata al buono di ${giaUsata.recipientName} (${giaUsata.remainingBalance.toFixed(2)} € residui). Usane un'altra.`
      );
    }
  }

  const created = await prisma.giftCard.create({
    data: {
      code: generateCode(),
      cardCode: card || null,
      purchasedBy: data.purchasedBy,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone ?? null,
      amount: data.amount,
      remainingBalance: data.amount,
      purchaseDate: now.toISOString().split('T')[0],
      expiryDate: exp.toISOString().split('T')[0],
      paymentMethod: data.paymentMethod,
      purchaseOperator: data.operator,
      status: 'active',
      message: data.message ?? null,
      transactions: [],
    },
  });

  /*
    Il buono è un incasso vero, e va in cassa adesso.

    Chi compra un buono regalo paga in quel momento: i soldi entrano nel
    cassetto la sera stessa. Finora la vendita non lasciava traccia in cassa, e
    alla chiusura ci si ritrovava con più contanti di quelli registrati —
    niente da riconciliare, solo un buco. Anche lo scontrino fiscale va emesso
    qui: il pagamento avviene alla vendita del buono, non il giorno in cui
    qualcun altro lo spende.
  */
  await registraVenditaInCassa(created);

  /*
    L'avviso a chi riceve il regalo, se al banco hanno scritto il suo numero.
    Non blocca la vendita: se WhatsApp non parte, il buono è comunque emesso e
    il codice si consegna come sempre.
  */
  sendBuonoRegalo(created.id).catch(() => {});

  return toGiftCard(created);
}

/** L'incasso della vendita del buono: riga in cassa, scontrino, avviso Telegram. */
async function registraVenditaInCassa(gc: {
  id: string; code: string; amount: number; paymentMethod: string;
  purchasedBy: string; recipientName: string; purchaseOperator: string;
}): Promise<void> {
  if (!gc.amount || gc.amount <= 0) return;
  const now = new Date();
  const etichetta = `Buono regalo ${gc.code} per ${gc.recipientName}`.trim();
  // I metodi si scrivono come in cassa ("Contanti", "Carta"): la chiusura di
  // giornata li riconosce da lì, e un "contanti" minuscolo finirebbe fra gli
  // "altri metodi" senza entrare nel versamento in cassaforte.
  // Il misto porta gli importi scritti dentro: si lascia esattamente com'e'.
  const metodo = eMisto(gc.paymentMethod)
    ? gc.paymentMethod
    : gc.paymentMethod.charAt(0).toUpperCase() + gc.paymentMethod.slice(1).toLowerCase();

  const riga = await prisma.posTransaction.create({
    data: {
      date: now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }),
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
      clientName: gc.purchasedBy || 'Cliente Occasionale',
      items: [etichetta],
      total: gc.amount,
      paymentMethod: metodo,
      operator: gc.purchaseOperator,
      isRefund: false,
    },
  });

  await emettiScontrinoElettronico(riga, etichetta);
  notifyIncasso({
    amount: gc.amount, client: gc.purchasedBy, items: etichetta,
    method: metodo, operator: gc.purchaseOperator,
  }).catch(() => {});
}

export async function redeemGiftCard(gcId: string, amount: number, service: string, operator: string) {
  const gc = await prisma.giftCard.findUniqueOrThrow({ where: { id: gcId } });
  const today = new Date().toISOString().split('T')[0];
  const newBalance = Math.max(0, gc.remainingBalance - amount);
  const transactions = (gc.transactions as unknown as GiftCardTransaction[]) ?? [];

  const updated = await prisma.giftCard.update({
    where: { id: gcId },
    data: {
      remainingBalance: newBalance,
      status: newBalance <= 0 ? 'used' : 'partial',
      transactions: JSON.parse(JSON.stringify([...transactions, { id: `gct-${Date.now()}`, date: today, amount, service, operator }])),
    },
  });

  return toGiftCard(updated);
}

/**
 * Il buono trovato dal codice: quello della card o il nostro RB-.
 *
 * Si spara la tessera e basta, ma se la card si e' smagnetizzata o la cliente
 * ha solo il messaggio su WhatsApp il codice RB- deve funzionare uguale —
 * altrimenti il banco resta fermo con una cliente davanti.
 *
 * Torna sempre un motivo quando non si puo' usare: «scaduto il 12 marzo» si
 * puo' spiegare alla cliente, «non trovato» su un buono scaduto no.
 */
export async function cercaBuonoRegalo(codice: string): Promise<
  { ok: true; buono: GiftCard } | { ok: false; error: string }
> {
  const pulito = normalizzaCard(codice);
  if (!pulito) return { ok: false, error: 'Scrivi o spara un codice' };

  const gc = await prisma.giftCard.findFirst({
    where: { OR: [{ cardCode: pulito }, { code: pulito }, { code: codice.trim() }] },
  });
  if (!gc) return { ok: false, error: 'Nessun buono con questo codice' };

  if (gc.remainingBalance <= 0.005) {
    return { ok: false, error: `Buono gia' usato tutto (${gc.recipientName})` };
  }
  // La scadenza si guarda sulla data, non sullo stato: lo stato lo aggiorna
  // qualcuno, la data passa da sola.
  const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  if (gc.expiryDate && gc.expiryDate < oggi) {
    const [a, m, g] = gc.expiryDate.split('-');
    return { ok: false, error: `Buono scaduto il ${g}/${m}/${a}` };
  }

  return { ok: true, buono: toGiftCard(gc) };
}

export async function deleteGiftCard(gcId: string) {
  await prisma.giftCard.delete({ where: { id: gcId } });
  return true;
}

/**
 * Il numero di chi riceve, aggiunto dopo — e l'avviso mandato a mano.
 *
 * I buoni fatti prima che il campo esistesse non ce l'hanno, e capita anche
 * che al banco il numero arrivi il giorno dopo ("te lo mando su WhatsApp").
 * Da qui si scrive e si manda, senza rifare il buono.
 */
export async function avvisaDestinatario(gcId: string, phone?: string): Promise<{ ok: boolean; error?: string }> {
  const numero = (phone || '').trim();
  if (numero) {
    await prisma.giftCard.update({ where: { id: gcId }, data: { recipientPhone: numero } });
  }
  return sendBuonoRegalo(gcId, true);
}

/**
 * Una prova del messaggio del buono, sul numero che si vuole.
 *
 * Il messaggio parte una volta sola per buono e va a chi riceve il regalo:
 * non è una cosa che si può provare "creando un buono finto", perché poi
 * resterebbe in cassa e nei conti. Qui si manda lo stesso testo con dati di
 * esempio, senza creare niente.
 */
export async function provaBuonoRegalo(phone: string, nome?: string): Promise<{ ok: boolean; error?: string }> {
  const numero = (phone || '').trim();
  if (numero.replace(/\D/g, '').length < 9) return { ok: false, error: 'Numero non valido' };

  const params = [
    sanitizeParam(nome?.trim() || 'Maria'),
    'Giulia',
    '50,00 €',
    `RB-${new Date().getFullYear()}-PROVA`,
    new Date(Date.now() + 30 * 86_400_000).toLocaleDateString('it-IT'),
  ];
  const testo = WA_TEMPLATES.buonoRegalo.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');

  const res = await sendWhatsAppTemplate(normalizePhone(numero), 'buonoRegalo', {
    bodyParams: params,
    fallbackText: testo,
    source: 'manual',
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'Invio fallito' };
}
