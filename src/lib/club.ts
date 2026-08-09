/**
 * Beauty Club: i livelli della cliente e quanto le manca per il prossimo.
 *
 * I livelli non stanno nel codice ma a database, perché sono una leva
 * commerciale: le soglie si ritoccano a stagione, i vantaggi cambiano con le
 * promozioni. Qui c'è solo il come si calcola, mai il quanto.
 *
 * La spesa che conta è quella vera già calcolata altrove — cassa più rate dei
 * pacchetti — perché il livello deve rispecchiare quanto la cliente ha
 * davvero lasciato al centro, non quanto vale il listino dei suoi appuntamenti.
 */

import { prisma } from './prisma';

export interface LivelloCliente {
  /** Livello attuale; null se non ne ha ancora raggiunto nessuno. */
  attuale: {
    id: string; name: string; color: string;
    cashbackPct: number; pointsFactor: number; flashHeadMin: number;
    perks: string[]; sortOrder: number;
  } | null;
  /** Livello successivo e quanto manca. */
  prossimo: { name: string; color: string; mancaSpesa: number; mancaVisite: number } | null;
  /** Da 0 a 100: quanto è avanti verso il prossimo livello. */
  avanzamento: number;
  spesaTotale: number;
  visite: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Livelli attivi, dal più basso al più alto. */
export async function livelliClub() {
  return prisma.clubLevel.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { minSpent: 'asc' }],
  });
}

/**
 * Quanto ha speso davvero una cliente: incassi in cassa a suo nome più le rate
 * dei pacchetti. È lo stesso criterio delle statistiche del gestionale: due
 * numeri diversi per la stessa domanda sarebbero un problema, non un dettaglio.
 */
export async function spesaEVisite(clientId: string): Promise<{ spesa: number; visite: number }> {
  const cliente = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true },
  });
  if (!cliente) return { spesa: 0, visite: 0 };

  const nome = norm(`${cliente.firstName} ${cliente.lastName}`);
  const [txs, pacchetti, appuntamenti] = await Promise.all([
    prisma.posTransaction.findMany({
      where: { isRefund: false, total: { gt: 0 } },
      select: { clientName: true, total: true },
    }),
    prisma.clientPackage.findMany({ where: { clientId }, select: { payments: true } }),
    prisma.appointment.findMany({ where: { clientId, status: 'completed' }, select: { date: true } }),
  ]);

  let spesa = txs.filter(t => norm(t.clientName) === nome).reduce((s, t) => s + t.total, 0);
  for (const p of pacchetti) {
    const pagamenti = Array.isArray(p.payments) ? (p.payments as { amount?: number }[]) : [];
    spesa += pagamenti.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  }

  return {
    spesa: round2(spesa),
    visite: new Set(appuntamenti.map(a => a.date)).size,
  };
}

export async function livelloCliente(clientId: string): Promise<LivelloCliente> {
  const [livelli, { spesa, visite }] = await Promise.all([livelliClub(), spesaEVisite(clientId)]);

  if (!livelli.length) {
    return { attuale: null, prossimo: null, avanzamento: 0, spesaTotale: spesa, visite };
  }

  const raggiunto = (l: (typeof livelli)[number]) =>
    // Basta una delle due condizioni: chi viene tanto spendendo poco merita
    // il livello quanto chi viene una volta e spende molto.
    spesa >= l.minSpent || (l.minVisits > 0 && visite >= l.minVisits);

  const presi = livelli.filter(raggiunto);
  const attuale = presi.length ? presi[presi.length - 1] : null;
  const prossimo = livelli.find(l => !raggiunto(l)) ?? null;

  let avanzamento = 100;
  if (prossimo) {
    const da = attuale?.minSpent ?? 0;
    const a = prossimo.minSpent;
    avanzamento = a > da ? Math.max(0, Math.min(100, Math.round(((spesa - da) / (a - da)) * 100))) : 0;
  }

  return {
    attuale: attuale
      ? {
          id: attuale.id, name: attuale.name, color: attuale.color,
          cashbackPct: attuale.cashbackPct, pointsFactor: attuale.pointsFactor,
          flashHeadMin: attuale.flashHeadMin, perks: attuale.perks, sortOrder: attuale.sortOrder,
        }
      : null,
    prossimo: prossimo
      ? {
          name: prossimo.name,
          color: prossimo.color,
          mancaSpesa: round2(Math.max(0, prossimo.minSpent - spesa)),
          mancaVisite: Math.max(0, prossimo.minVisits - visite),
        }
      : null,
    avanzamento,
    spesaTotale: spesa,
    visite,
  };
}

/** Livelli di partenza, creati alla prima apertura del pannello. */
export const LIVELLI_DI_PARTENZA = [
  { name: 'Silver', minSpent: 0, minVisits: 0, color: '#B7B7BD', cashbackPct: 2, pointsFactor: 1, flashHeadMin: 0, sortOrder: 1,
    perks: ['Punti su ogni trattamento', 'Offerte riservate alle clienti'] },
  { name: 'Gold', minSpent: 400, minVisits: 8, color: '#C9A96A', cashbackPct: 4, pointsFactor: 1.5, flashHeadMin: 15, sortOrder: 2,
    perks: ['Cashback del 4%', 'Punti e mezzo su ogni euro', 'Flash Slot con 15 minuti di anticipo'] },
  { name: 'Platinum', minSpent: 1000, minVisits: 20, color: '#8E9BA6', cashbackPct: 6, pointsFactor: 2, flashHeadMin: 30, sortOrder: 3,
    perks: ['Cashback del 6%', 'Punti doppi', 'Flash Slot con 30 minuti di anticipo', 'Regalo di compleanno'] },
  { name: 'Black', minSpent: 2500, minVisits: 40, color: '#2E2A2B', cashbackPct: 8, pointsFactor: 2.5, flashHeadMin: 60, sortOrder: 4,
    perks: ['Cashback dell\'8%', 'Priorità in agenda', 'Flash Slot un\'ora prima di tutte', 'Trattamento omaggio a Natale'] },
];
