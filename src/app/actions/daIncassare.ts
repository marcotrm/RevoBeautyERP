'use server';

/**
 * Sedute chiuse ma mai incassate.
 *
 * Il check-out marca l'appuntamento "completato" e POI manda in cassa. Se in
 * mezzo succede qualcosa — la cliente chiama, entra qualcun altro, si chiude la
 * pagina — la seduta resta completata e i soldi non li ha presi nessuno. In
 * agenda si legge "completato e pagato", che è una bugia, e quei soldi non
 * compaiono da nessuna parte: né in cassa, né negli scontrini, né nelle
 * statistiche.
 *
 * Qui si cercano, per poterli incassare adesso invece di scoprirli a fine mese.
 *
 * Come si riconosce una seduta pagata:
 *  - il legame diretto `PosTransaction.appointmentId`, quando la vendita è
 *    nata dal check-out (da adesso in poi è sempre così);
 *  - per lo storico, che quel legame non ce l'ha, si ripiega sul nome della
 *    cliente nello stesso giorno: se in giornata risulta un incasso a suo nome,
 *    la seduta si considera pagata. Può sbagliare per difetto (due sedute nello
 *    stesso giorno pagate una sola volta), mai per eccesso: meglio non
 *    disturbare che accusare a torto.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';

export interface SedutaDaIncassare {
  id: string;
  date: string;
  startTime: string;
  clientName: string;
  treatmentName: string;
  operatorName: string;
  prezzo: number;
  /** Quando è stata chiusa senza incassare. */
  chiusaAlle?: string;
}

/**
 * Le sedute completate e non incassate, dalla più recente.
 * `giorni` indietro da oggi: 1 = solo oggi.
 */
export async function seduteDaIncassare(giorni = 30): Promise<SedutaDaIncassare[]> {
  const oggi = todayRome();
  const da = new Date(`${oggi}T12:00:00Z`);
  da.setUTCDate(da.getUTCDate() - (giorni - 1));
  const dal = da.toISOString().slice(0, 10);

  const [sedute, incassi] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: 'completed', date: { gte: dal, lte: oggi }, price: { gt: 0 } },
      select: {
        id: true, date: true, startTime: true, clientName: true,
        treatmentName: true, operatorName: true, price: true, checkOutAt: true, notes: true,
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    }),
    prisma.posTransaction.findMany({
      where: { date: { gte: dal, lte: oggi }, isRefund: false },
      select: { appointmentId: true, clientName: true, date: true, total: true },
    }),
  ]);

  const pagatiPerId = new Set(incassi.map(t => t.appointmentId).filter(Boolean) as string[]);
  const pagatiPerGiorno = new Set(
    incassi.filter(t => t.total > 0).map(t => `${t.date}|${(t.clientName || '').trim().toLowerCase()}`),
  );

  return sedute
    .filter(a => {
      if (pagatiPerId.has(a.id)) return false;
      if (pagatiPerGiorno.has(`${a.date}|${(a.clientName || '').trim().toLowerCase()}`)) return false;
      // La seduta scalata da un pacchetto è già stata pagata quando il
      // pacchetto è stato venduto: non deve risultare da incassare.
      if (/📦 Seduta da pacchetto/.test(a.notes || '')) return false;
      return true;
    })
    .map(a => ({
      id: a.id, date: a.date, startTime: a.startTime, clientName: a.clientName,
      treatmentName: a.treatmentName, operatorName: a.operatorName,
      prezzo: a.price, chiusaAlle: a.checkOutAt || undefined,
    }));
}

/** Vero se quella seduta risulta incassata: serve al pannello dell'appuntamento. */
export async function sedutaIncassata(appointmentId: string): Promise<boolean> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { date: true, clientName: true, price: true, notes: true },
  });
  if (!appt) return true;
  if (appt.price <= 0) return true;
  if (/📦 Seduta da pacchetto/.test(appt.notes || '')) return true;

  const diretto = await prisma.posTransaction.count({ where: { appointmentId, isRefund: false } });
  if (diretto > 0) return true;

  const stessoGiorno = await prisma.posTransaction.count({
    where: {
      date: appt.date, isRefund: false, total: { gt: 0 },
      clientName: { equals: appt.clientName, mode: 'insensitive' },
    },
  });
  return stessoGiorno > 0;
}
