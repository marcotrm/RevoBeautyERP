'use server';

import { prisma } from '@/lib/prisma';

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// ============================================================
// FUNNEL INAUGURAZIONE
// Quante clienti dell'inaugurazione sono venute (omaggio scalato) e quante
// sono TORNATE come paganti (upsell dopo la seduta gratis).
// ============================================================
export interface InaugurationStats {
  totalLeads: number;        // contatti raccolti all'inaugurazione
  inClients: number;         // entrati in anagrafica
  withGift: number;          // con pacchetto omaggio assegnato
  came: number;              // omaggio effettivamente scalato (sono venute)
  booked: number;            // omaggio prenotato ma non ancora completato
  returnedPaying: number;    // tornate per un servizio a pagamento
  conversionRate: number;    // % venute → tornate paganti
}

export async function getInaugurationStats(): Promise<InaugurationStats> {
  const [leads, inaugClients, giftPkgs, transactions] = await Promise.all([
    prisma.inaugurationLead.count(),
    prisma.client.findMany({ where: { tags: { has: 'Inaugurazione' } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.clientPackage.findMany({ where: { pricePaid: 0 }, select: { clientId: true, usedSessions: true } }),
    prisma.posTransaction.findMany({ where: { total: { gt: 0 } }, select: { clientName: true } }),
  ]);

  const inaugIds = new Set(inaugClients.map(c => c.id));
  const inaugNames = new Set(inaugClients.map(c => norm(`${c.firstName} ${c.lastName}`)));

  const giftForInaug = giftPkgs.filter(g => g.clientId && inaugIds.has(g.clientId));
  const withGift = new Set(giftForInaug.map(g => g.clientId)).size;
  const came = new Set(giftForInaug.filter(g => g.usedSessions >= 1).map(g => g.clientId)).size;
  const booked = withGift - came;

  // Appuntamenti a pagamento completati per clienti inaugurazione
  const paidAppts = await prisma.appointment.findMany({
    where: { status: 'completed', price: { gt: 0 }, clientId: { in: [...inaugIds] } },
    select: { clientId: true },
  });
  const returnedIds = new Set<string>(paidAppts.map(a => a.clientId));
  // ...oppure una vendita cassa a loro nome
  for (const t of transactions) {
    const n = norm(t.clientName);
    if (n && inaugNames.has(n)) {
      const match = inaugClients.find(c => norm(`${c.firstName} ${c.lastName}`) === n);
      if (match) returnedIds.add(match.id);
    }
  }
  const returnedPaying = returnedIds.size;

  return {
    totalLeads: leads,
    inClients: inaugClients.length,
    withGift,
    came,
    booked,
    returnedPaying,
    conversionRate: came > 0 ? Math.round((returnedPaying / came) * 100) : 0,
  };
}

// ============================================================
// VALORE REALE DEL CLIENTE
// Aggrega incassi cassa (per nome) + pagamenti pacchetti (per nome) e conta
// le visite dagli appuntamenti completati.
// ============================================================
export interface ClientValue {
  totalSpent: number;
  visits: number;
  avgTicket: number;
  firstVisit: string | null;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  avgDaysBetweenVisits: number | null;
  monthlyAvg: number; // spesa media al mese da quando è cliente
}

export async function getClientValue(clientId: string): Promise<ClientValue> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true, createdAt: true },
  });
  if (!client) {
    return { totalSpent: 0, visits: 0, avgTicket: 0, firstVisit: null, lastVisit: null, daysSinceLastVisit: null, avgDaysBetweenVisits: null, monthlyAvg: 0 };
  }
  const fullName = norm(`${client.firstName} ${client.lastName}`);

  const [appts, transactions, packages] = await Promise.all([
    prisma.appointment.findMany({ where: { clientId, status: 'completed' }, select: { date: true, price: true } }),
    prisma.posTransaction.findMany({ select: { clientName: true, total: true, date: true } }),
    prisma.clientPackage.findMany({ where: { clientId }, select: { payments: true } }),
  ]);

  // Incasso cassa a nome del cliente (solo importi positivi)
  const posTotal = transactions
    .filter(t => norm(t.clientName) === fullName && t.total > 0)
    .reduce((s, t) => s + t.total, 0);

  // Pagamenti pacchetti
  let pkgTotal = 0;
  for (const p of packages) {
    const pays = Array.isArray(p.payments) ? (p.payments as { amount?: number }[]) : [];
    pkgTotal += pays.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  }

  const totalSpent = Math.round((posTotal + pkgTotal) * 100) / 100;

  // Visite = appuntamenti completati (date distinte)
  const visitDates = [...new Set(appts.map(a => a.date).filter(Boolean))].sort();
  const visits = visitDates.length;

  const firstVisit = visitDates[0] || null;
  const lastVisit = visitDates[visitDates.length - 1] || null;

  const dayMs = 86400000;
  const daysSinceLastVisit = lastVisit ? Math.floor((Date.now() - Date.parse(lastVisit)) / dayMs) : null;

  let avgDaysBetweenVisits: number | null = null;
  if (visitDates.length >= 2) {
    let sum = 0;
    for (let i = 1; i < visitDates.length; i++) sum += (Date.parse(visitDates[i]) - Date.parse(visitDates[i - 1])) / dayMs;
    avgDaysBetweenVisits = Math.round(sum / (visitDates.length - 1));
  }

  const monthsAsClient = Math.max(1, (Date.now() - Date.parse(client.createdAt || firstVisit || new Date().toISOString())) / (dayMs * 30));
  const monthlyAvg = Math.round(totalSpent / monthsAsClient);

  return {
    totalSpent,
    visits,
    avgTicket: visits > 0 ? Math.round(totalSpent / visits) : 0,
    firstVisit,
    lastVisit,
    daysSinceLastVisit,
    avgDaysBetweenVisits,
    monthlyAvg,
  };
}
