/**
 * Flash Slot: i buchi in agenda messi in vetrina nell'app.
 *
 * Il problema che risolve è concreto: una disdetta alle 9 del mattino per le
 * 16:30 di oggi è un'ora di lavoro persa, e nessuno ha il tempo di chiamare
 * dieci clienti sperando che una possa. Qui lo slot si pubblica in un clic e
 * chi arriva prima se lo prende.
 *
 * **La parte delicata è una sola: due clienti che premono insieme.** Il
 * controllo "è ancora libero? allora prendilo" non basta — fra la domanda e la
 * risposta ci sta un'altra prenotazione. Qui il posto si assegna con un solo
 * aggiornamento condizionato (`WHERE status = 'open'`), che il database esegue
 * in modo atomico: chi arriva secondo si vede rispondere "zero righe
 * modificate" e riceve un messaggio chiaro, invece di trovarsi un doppio
 * appuntamento in agenda.
 */

import { prisma } from './prisma';
import { leggiConfig } from './appSettings';
import { livelloCliente } from './club';

const round2 = (n: number) => Math.round(n * 100) / 100;
const oraItalia = () => new Date();

export interface SlotPubblicabile {
  date: string;
  startTime: string;
  endTime: string;
  treatmentId: string;
  treatmentName: string;
  operatorId: string;
  operatorName: string;
  fullPrice: number;
  /** Se non passato, si applica lo sconto configurato. */
  price?: number;
  durataMinuti?: number;
  minLevelOrder?: number;
  createdBy?: string;
}

/** Mette uno slot in vetrina. */
export async function pubblicaSlot(s: SlotPubblicabile) {
  const config = await leggiConfig();
  const prezzo = s.price ?? round2(s.fullPrice * (1 - config.flashSlot.scontoPercentuale / 100));
  const durata = s.durataMinuti ?? config.flashSlot.durataMinuti;

  // La vetrina non può durare oltre l'inizio del trattamento: uno slot
  // "disponibile ancora per 40 minuti" che inizia fra 10 è una presa in giro.
  const inizio = new Date(`${s.date}T${s.startTime}:00`);
  const scadenzaVetrina = new Date(Date.now() + durata * 60_000);
  const expiresAt = (inizio < scadenzaVetrina ? inizio : scadenzaVetrina).toISOString();

  return prisma.flashSlot.create({
    data: {
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      treatmentId: s.treatmentId,
      treatmentName: s.treatmentName,
      operatorId: s.operatorId,
      operatorName: s.operatorName,
      fullPrice: round2(s.fullPrice),
      price: prezzo,
      expiresAt,
      status: 'open',
      minLevelOrder: s.minLevelOrder ?? 0,
      createdAt: new Date().toISOString(),
      createdBy: s.createdBy ?? null,
    },
  });
}

/** Gli slot che una cliente può vedere adesso, con il suo livello. */
export async function slotVisibili(clientId: string | null) {
  const oggi = new Date().toISOString().slice(0, 10);
  const adesso = new Date().toISOString();

  const aperti = await prisma.flashSlot.findMany({
    where: { status: 'open', date: { gte: oggi }, expiresAt: { gt: adesso } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  let ordine = 0;
  if (clientId) {
    const l = await livelloCliente(clientId);
    ordine = l.attuale?.sortOrder ?? 0;
  }

  return aperti
    .filter(s => s.minLevelOrder <= ordine)
    .map(s => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      treatmentName: s.treatmentName,
      operatorName: s.operatorName,
      fullPrice: s.fullPrice,
      price: s.price,
      risparmio: round2(s.fullPrice - s.price),
      /** Secondi che restano: l'app ci fa il conto alla rovescia. */
      restanoSecondi: Math.max(0, Math.floor((Date.parse(s.expiresAt) - Date.now()) / 1000)),
    }));
}

export type EsitoPresa =
  | { ok: true; appointmentId: string; slot: { date: string; startTime: string; treatmentName: string; operatorName: string; price: number } }
  | { ok: false; code: 'NOT_FOUND' | 'TAKEN' | 'EXPIRED' | 'CONFLICT'; error: string };

/**
 * Prende lo slot e crea l'appuntamento.
 *
 * L'ordine conta: prima si assegna lo slot (la scrittura che può fallire per
 * concorrenza), poi si crea l'appuntamento. Al contrario si rischierebbe di
 * avere un appuntamento in agenda per uno slot che qualcun altro si è preso.
 */
export async function prendiSlot(slotId: string, clientId: string): Promise<EsitoPresa> {
  const slot = await prisma.flashSlot.findUnique({ where: { id: slotId } });
  if (!slot) return { ok: false, code: 'NOT_FOUND', error: 'Questa occasione non esiste più.' };
  if (slot.status === 'taken') return { ok: false, code: 'TAKEN', error: 'Questo posto è appena stato preso da un\'altra cliente.' };
  if (slot.status !== 'open') return { ok: false, code: 'EXPIRED', error: 'Questa occasione non è più disponibile.' };
  if (Date.parse(slot.expiresAt) <= Date.now()) {
    await prisma.flashSlot.update({ where: { id: slotId }, data: { status: 'expired' } }).catch(() => {});
    return { ok: false, code: 'EXPIRED', error: 'Tempo scaduto: questa occasione non è più disponibile.' };
  }

  const cliente = await prisma.client.findUnique({ where: { id: clientId } });
  if (!cliente) return { ok: false, code: 'NOT_FOUND', error: 'Scheda cliente non trovata.' };

  const adesso = new Date().toISOString();

  // Il passo che decide chi vince. La condizione sullo stato sta dentro la
  // stessa istruzione che scrive: il database la valuta e aggiorna in un colpo
  // solo, quindi fra il controllo e la scrittura non c'è spazio per nessuno.
  try {
    const preso = await prisma.flashSlot.updateMany({
      where: { id: slotId, status: 'open', takenByClientId: null },
      data: { status: 'taken', takenByClientId: clientId, takenAt: adesso },
    });
    if (preso.count === 0) {
      return { ok: false, code: 'TAKEN', error: 'Questo posto è appena stato preso da un\'altra cliente.' };
    }
  } catch {
    return { ok: false, code: 'TAKEN', error: 'Non è stato possibile prendere questo posto. Riprova.' };
  }

  // Ultimo controllo prima di scrivere in agenda: nel frattempo l'operatrice
  // potrebbe aver ricevuto un appuntamento normale sulla stessa fascia.
  const sovrapposti = await prisma.appointment.findMany({
    where: { operatorId: slot.operatorId, date: slot.date, status: { notIn: ['cancelled'] } },
    select: { startTime: true, endTime: true },
  });
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const conflitto = sovrapposti.some(a => min(a.startTime) < min(slot.endTime) && min(slot.startTime) < min(a.endTime));
  if (conflitto) {
    await prisma.flashSlot.update({
      where: { id: slotId },
      data: { status: 'cancelled', takenByClientId: null, takenAt: null },
    });
    return { ok: false, code: 'CONFLICT', error: 'Quell\'orario si è appena riempito. Ci dispiace!' };
  }

  const trattamento = await prisma.treatment.findUnique({ where: { id: slot.treatmentId } });
  const appuntamento = await prisma.appointment.create({
    data: {
      clientId,
      clientName: `${cliente.firstName} ${cliente.lastName}`.trim(),
      operatorId: slot.operatorId,
      operatorName: slot.operatorName,
      treatmentId: slot.treatmentId,
      treatmentName: slot.treatmentName,
      treatmentCategory: trattamento?.category ?? '',
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: min(slot.endTime) - min(slot.startTime),
      status: 'confirmed',
      price: slot.price,
      color: trattamento?.color ?? '#B76E79',
      notes: `Flash Slot dall'app — prezzo speciale ${slot.price} € (invece di ${slot.fullPrice} €)`,
      createdAt: adesso,
      updatedAt: adesso,
      createdBy: 'app',
    },
  });

  await prisma.flashSlot.update({ where: { id: slotId }, data: { appointmentId: appuntamento.id } });

  return {
    ok: true,
    appointmentId: appuntamento.id,
    slot: {
      date: slot.date, startTime: slot.startTime,
      treatmentName: slot.treatmentName, operatorName: slot.operatorName, price: slot.price,
    },
  };
}

/** Chiude gli slot scaduti: li chiama chi legge la vetrina, senza cron. */
export async function ripulisciScaduti(): Promise<number> {
  const r = await prisma.flashSlot.updateMany({
    where: { status: 'open', expiresAt: { lte: new Date().toISOString() } },
    data: { status: 'expired' },
  });
  return r.count;
}

void oraItalia;
