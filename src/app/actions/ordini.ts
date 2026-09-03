'use server';

/**
 * Gli ordini dei prodotti, con ritiro in centro.
 *
 * La crema si vende solo a chi passa dal banco e se la ricorda. Chi la
 * finisce di martedi' sera pensa "la prendo la prossima volta" e la prossima
 * volta la compra al supermercato.
 *
 * Qui la mette da parte quando le viene in mente e la ritira al prossimo
 * appuntamento. Niente spedizioni e niente pagamento online: nessun corriere,
 * nessun reso da gestire, nessuna carta da custodire. Si paga al banco, come
 * sempre — cambia solo che il prodotto e' li' che aspetta col suo nome sopra.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendTelegram } from '@/lib/telegram';
import { findClientByPhone } from '@/lib/voice';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RigaOrdine {
  productId: string;
  nome: string;
  prezzo: number;
  qty: number;
}

export interface Ordine {
  id: string;
  numero: number;
  clientId: string | null;
  clientName: string;
  phone: string;
  email: string | null;
  righe: RigaOrdine[];
  totale: number;
  stato: 'nuovo' | 'pronto' | 'ritirato' | 'annullato';
  note: string | null;
  txId: string | null;
  createdAt: string;
}

function vesti(r: {
  id: string; numero: number; clientId: string | null; clientName: string; phone: string;
  email: string | null; righe: unknown; totale: number; stato: string; note: string | null;
  txId: string | null; createdAt: string;
}): Ordine {
  return {
    ...r,
    righe: Array.isArray(r.righe) ? (r.righe as RigaOrdine[]) : [],
    stato: (r.stato as Ordine['stato']) || 'nuovo',
  };
}

/** I prodotti che si possono ordinare: attivi e con qualcosa in magazzino. */
export async function prodottiOrdinabili(): Promise<{
  id: string; nome: string; marca: string; categoria: string; prezzo: number; disponibili: number;
}[]> {
  const p = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 }, price: { gt: 0 } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, brand: true, category: true, price: true, stock: true },
  });
  return p.map(x => ({
    id: x.id, nome: x.name, marca: x.brand, categoria: x.category,
    prezzo: x.price, disponibili: x.stock,
  }));
}

/**
 * Una cliente ordina.
 *
 * Il magazzino non si scarica adesso: si scarica quando ritira e paga. Un
 * ordine non e' una vendita — se non passa a prenderlo, quel prodotto non e'
 * mai uscito dallo scaffale.
 */
export async function creaOrdine(dati: {
  clientName: string;
  phone: string;
  email?: string | null;
  righe: { productId: string; qty: number }[];
  note?: string;
}): Promise<{ ok: boolean; numero?: number; error?: string }> {
  const nome = dati.clientName.trim();
  const telefono = dati.phone.trim();
  if (!nome) return { ok: false, error: 'Serve il nome' };
  if (telefono.replace(/\D/g, '').length < 6) return { ok: false, error: 'Serve un numero di telefono valido' };
  if (!dati.righe?.length) return { ok: false, error: 'Non hai scelto niente' };

  const prodotti = await prisma.product.findMany({
    where: { id: { in: dati.righe.map(r => r.productId) }, isActive: true },
    select: { id: true, name: true, price: true, stock: true },
  });
  const perId = new Map(prodotti.map(p => [p.id, p]));

  const righe: RigaOrdine[] = [];
  for (const r of dati.righe) {
    const p = perId.get(r.productId);
    if (!p) continue;
    const qty = Math.max(1, Math.min(Math.floor(r.qty) || 1, p.stock));
    righe.push({ productId: p.id, nome: p.name, prezzo: p.price, qty });
  }
  if (righe.length === 0) return { ok: false, error: 'I prodotti scelti non sono più disponibili' };

  const totale = round2(righe.reduce((t, r) => t + r.prezzo * r.qty, 0));
  const cliente = await findClientByPhone(telefono).catch(() => null);
  const adesso = new Date().toISOString();

  const ordine = await prisma.productOrder.create({
    data: {
      clientId: cliente?.id || null,
      clientName: nome,
      phone: telefono,
      email: dati.email?.trim() || null,
      righe: righe as unknown as object,
      totale,
      stato: 'nuovo',
      note: dati.note?.trim() || null,
      createdAt: adesso,
      updatedAt: adesso,
    },
  });

  sendTelegram(
    `\u{1F6CD} <b>Nuovo ordine prodotti</b> #${ordine.numero}\n`
    + `${nome} · ${telefono}\n`
    + righe.map(r => `• ${r.nome}${r.qty > 1 ? ` ×${r.qty}` : ''} — ${r.prezzo.toFixed(2).replace('.', ',')} €`).join('\n')
    + `\n<b>Totale ${totale.toFixed(2).replace('.', ',')} €</b> · ritira in centro`,
  ).catch(() => {});

  return { ok: true, numero: ordine.numero };
}

export async function elencoOrdini(soloAperti = false): Promise<Ordine[]> {
  const righe = await prisma.productOrder.findMany({
    where: soloAperti ? { stato: { in: ['nuovo', 'pronto'] } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return righe.map(vesti);
}

export async function cambiaStatoOrdine(id: string, stato: Ordine['stato']): Promise<{ ok: boolean }> {
  await prisma.productOrder.update({ where: { id }, data: { stato, updatedAt: new Date().toISOString() } });
  return { ok: true };
}

/**
 * L'ordine e' stato ritirato e pagato.
 *
 * Qui diventa una vendita vera: riga in cassa con le righe di magazzino, che
 * scaricano la giacenza esattamente come una vendita al banco. Prima di
 * questo momento il prodotto era solo messo da parte.
 */
export async function ritiraOrdine(id: string, dati: { metodo?: string; operatore?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  const o = await prisma.productOrder.findUnique({ where: { id } });
  if (!o) return { ok: false, error: 'Ordine non trovato' };
  if (o.stato === 'ritirato') return { ok: false, error: 'Già ritirato' };

  const righe = Array.isArray(o.righe) ? (o.righe as unknown as RigaOrdine[]) : [];
  const now = new Date();
  const riga = await prisma.posTransaction.create({
    data: {
      date: todayRome(),
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
      clientName: o.clientName,
      items: righe.map(r => `🧴 ${r.nome}${r.qty > 1 ? ` ×${r.qty}` : ''}`),
      productLines: righe.map(r => ({ productId: r.productId, qty: r.qty })) as unknown as object,
      total: o.totale,
      paymentMethod: dati.metodo || 'Carta',
      operator: dati.operatore || 'Staff',
      isRefund: false,
    },
  });

  // La giacenza scala adesso, non quando l'ordine e' arrivato.
  for (const r of righe) {
    await prisma.product.update({
      where: { id: r.productId },
      data: { stock: { decrement: r.qty } },
    }).catch(() => {});
  }

  await prisma.productOrder.update({
    where: { id },
    data: { stato: 'ritirato', txId: riga.id, updatedAt: new Date().toISOString() },
  });
  return { ok: true };
}

/** Quanti ne aspettano: serve al pallino sulla voce di menu. */
export async function ordiniDaEvadere(): Promise<number> {
  return prisma.productOrder.count({ where: { stato: { in: ['nuovo', 'pronto'] } } });
}
