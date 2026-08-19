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

/**
 * Quanto resta da incassare su una seduta: i trattamenti a pagamento, meno lo
 * sconto concordato. Quelli a 0 € sono coperti dal pacchetto.
 */
interface RigaSeduta { treatmentId?: string; treatmentName?: string; price: number; productId?: string }

/** Le righe della seduta, anche per gli appuntamenti vecchi con un trattamento solo. */
function righeDi(a: { services?: unknown; treatmentId?: string; treatmentName?: string; price: number }): RigaSeduta[] {
  const righe = Array.isArray(a.services) ? (a.services as RigaSeduta[]) : [];
  if (righe.length > 0) return righe.map(r => ({ ...r, price: Number(r.price) || 0 }));
  return [{ treatmentId: a.treatmentId, treatmentName: a.treatmentName, price: a.price }];
}

function daPagare(a: {
  price: number;
  services?: unknown;
  discountAmount?: number | null;
}): number {
  const righe = Array.isArray(a.services) ? (a.services as { price?: number }[]) : [];
  const somma = righe.length > 0
    ? righe.reduce((t, s) => t + (Number(s.price) || 0), 0)
    : a.price;
  return Math.round(Math.max(0, somma - (a.discountAmount || 0)) * 100) / 100;
}

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
  /** Le righe da battere in cassa: una per trattamento, col suo prezzo. */
  servizi: { id: string; name: string; price: number; qty: number }[];
  /** I prodotti del carrello della seduta: scaricano la giacenza. */
  prodotti: { id: string; name: string; price: number; qty: number }[];
  /** Lo sconto concordato sulla seduta, da riportare come sconto in cassa. */
  sconto: number;
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
        id: true, date: true, startTime: true, clientName: true, treatmentId: true,
        treatmentName: true, operatorName: true, price: true, checkOutAt: true, notes: true,
        services: true, discountAmount: true,
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
      /*
        La seduta scalata da un pacchetto è già pagata quando il pacchetto è
        stato venduto — ma solo per la parte del pacchetto.
        
        Prima bastava la nota "Seduta da pacchetto" per considerare pagato
        tutto: Ilaria Fusco aveva la pressoterapia dal pacchetto (0 €) e tre
        cerette da 41,70 €, e quei 41,70 € sparivano da questo elenco. Ora si
        guarda quanto c'è davvero da incassare.
      */
      if (daPagare(a) <= 0) return false;
      return true;
    })
    .map(a => ({
      id: a.id, date: a.date, startTime: a.startTime, clientName: a.clientName,
      treatmentName: a.treatmentName, operatorName: a.operatorName,
      prezzo: daPagare(a), chiusaAlle: a.checkOutAt || undefined,
      servizi: righeDi(a).filter(r => !r.productId && r.price > 0)
        .map(r => ({ id: r.treatmentId || '', name: r.treatmentName || '', price: r.price, qty: 1 })),
      prodotti: righeDi(a).filter(r => r.productId && r.price > 0)
        .map(r => ({ id: r.productId as string, name: r.treatmentName || '', price: r.price, qty: 1 })),
      sconto: a.discountAmount || 0,
    }));
}

/** Vero se quella seduta risulta incassata: serve al pannello dell'appuntamento. */
export async function sedutaIncassata(appointmentId: string): Promise<boolean> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { date: true, clientName: true, price: true, notes: true, services: true, discountAmount: true, treatmentId: true, treatmentName: true },
  });
  if (!appt) return true;
  /*
    Quanto c'è davvero da incassare, riga per riga.

    Prima bastava la nota "Seduta da pacchetto" per dire "pagata" e chiudere
    lì: Ilaria Fusco aveva la pressoterapia dal pacchetto (0 €) e tre cerette
    da 41,70 €, e il pannello dell'appuntamento le segnava tutte come pagate.
    Non c'era nessun avviso, nessun tasto per incassare, e quei soldi non si
    potevano più prendere da nessuna parte.
  */
  if (daPagare(appt) <= 0) return true;

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
