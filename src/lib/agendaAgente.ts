/**
 * Spostare e disdire, in un posto solo.
 *
 * Le due regole che contano — il preavviso di ventiquattr'ore e il divieto sui
 * appuntamenti bloccati — stavano scritte due volte, dentro le due route
 * vocali. Adesso che a chiamarle sono in tre (telefono, WhatsApp e domani
 * chissà) due copie non bastano più: la terza sarebbe nata già diversa dalle
 * altre, e la differenza si sarebbe scoperta da una cliente a cui l'assistente
 * ha disdetto un appuntamento che al telefono avrebbe rifiutato.
 */

import { prisma } from './prisma';
import { slotDisponibili, type ServizioRichiesto } from './bookingEngine';
import { hasConflict, toMinutes, toHHMM, todayInItaly, troppoTardi, PREAVVISO_ORE } from './voice';

export type EsitoAgenda =
  | { ok: false; codice: 'NON_TROVATO' | 'GIA_CANCELLATO' | 'BLOCCATO' | 'TROPPO_TARDI' | 'OCCUPATO' | 'VALIDAZIONE'; messaggio: string }
  | { ok: true; messaggio: string; date: string; startTime: string; endTime: string; treatmentName: string; operatorName: string };

/**
 * I controlli che valgono per tutti e due: l'appuntamento esiste, non è già
 * cancellato, non è bloccato, e manca abbastanza tempo.
 *
 * Sotto le ventiquattr'ore non si tocca niente e si passa la conversazione a
 * una persona. Non è burocrazia: quel posto non si rivende più, è tempo di
 * cabina già perso, e se la cliente ha un motivo serio deve poterlo dire a
 * qualcuno che decide.
 */
type Appuntamento = NonNullable<Awaited<ReturnType<typeof prisma.appointment.findUnique>>>;

async function apri(appointmentId: string): Promise<
  { aperto: false; no: EsitoAgenda } | { aperto: true; appointment: Appuntamento }
> {
  const no = (codice: 'NON_TROVATO' | 'GIA_CANCELLATO' | 'BLOCCATO' | 'TROPPO_TARDI', messaggio: string) =>
    ({ aperto: false as const, no: { ok: false as const, codice, messaggio } });

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) return no('NON_TROVATO', 'Appuntamento non trovato.');
  if (appointment.status === 'cancelled') return no('GIA_CANCELLATO', 'Questo appuntamento è già stato disdetto.');
  if (appointment.isLocked) {
    return no('BLOCCATO', 'Questo appuntamento è bloccato: lo può toccare solo il centro. Passa la conversazione a una collega.');
  }
  if (troppoTardi(appointment.date, appointment.startTime)) {
    return no(
      'TROPPO_TARDI',
      `Manca meno di ${PREAVVISO_ORE} ore all'appuntamento: non lo puoi toccare tu. `
      + 'Dille che la passi subito a una collega, e passa la conversazione.'
    );
  }
  return { aperto: true, appointment };
}

/** I trattamenti dell'appuntamento, nella forma che capisce il motore degli orari. */
function serviziDi(appointment: { services: unknown; treatmentId: string; operatorId: string }): ServizioRichiesto[] {
  const s = appointment.services;
  if (Array.isArray(s) && s.length > 0) {
    const letti = s
      .filter((x): x is { treatmentId?: unknown; operatorId?: unknown } => Boolean(x) && typeof x === 'object')
      .map(x => ({
        treatmentId: String(x.treatmentId || ''),
        operatorId: x.operatorId ? String(x.operatorId) : null,
      }))
      .filter(x => x.treatmentId);
    if (letti.length > 0) return letti;
  }
  return [{ treatmentId: appointment.treatmentId, operatorId: appointment.operatorId }];
}

export async function spostaAppuntamento(params: {
  appointmentId: string;
  newDate: string;
  newTime: string;
}): Promise<EsitoAgenda> {
  const { appointmentId, newDate, newTime } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return { ok: false, codice: 'VALIDAZIONE', messaggio: 'La data va scritta come 2026-09-03.' };
  }
  if (!/^\d{2}:\d{2}$/.test(newTime)) {
    return { ok: false, codice: 'VALIDAZIONE', messaggio: 'L\'orario va scritto come 15:30.' };
  }
  if (newDate < todayInItaly()) {
    return { ok: false, codice: 'VALIDAZIONE', messaggio: 'Quella data è già passata.' };
  }

  const aperto = await apri(appointmentId);
  if (!aperto.aperto) return aperto.no;
  const { appointment } = aperto;

  /*
    Il posto nuovo si controlla col motore vero — turno dell'operatrice, pausa,
    settimana personalizzata, fasce bloccate — non con "siamo aperti dalle nove
    alle sette". Su un giorno diverso è tutto quello che serve.

    Sullo STESSO giorno il motore vede in mezzo l'appuntamento che stiamo
    spostando e rifiuterebbe di spostarlo di mezz'ora avanti. Lì l'unico
    controllo che sa escludere se stesso è `hasConflict`, e si usa quello: non
    è il migliore, ma è l'unico che risponde alla domanda giusta.
  */
  const gender: 'male' | 'female' = appointment.services && Array.isArray(appointment.services)
    && (appointment.services[0] as { gender?: string } | undefined)?.gender === 'male' ? 'male' : 'female';

  let libero: boolean;
  if (newDate === appointment.date) {
    libero = !(await hasConflict(newDate, appointment.operatorId, newTime, appointment.duration, appointment.id));
  } else {
    const { slots } = await slotDisponibili({
      date: newDate,
      services: serviziDi(appointment),
      gender,
      oraDa: newTime,
    });
    libero = slots.some(s => s.time === newTime);
  }

  if (!libero) {
    return { ok: false, codice: 'OCCUPATO', messaggio: 'Quell\'orario non è libero. Proponine un altro.' };
  }

  const newEndTime = toHHMM(toMinutes(newTime) + appointment.duration);
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { date: newDate, startTime: newTime, endTime: newEndTime, updatedAt: new Date().toISOString() },
  });

  return {
    ok: true,
    messaggio: 'Appuntamento spostato.',
    date: updated.date,
    startTime: updated.startTime,
    endTime: updated.endTime,
    treatmentName: updated.treatmentName,
    operatorName: updated.operatorName,
  };
}

export async function disdiciAppuntamento(appointmentId: string): Promise<EsitoAgenda> {
  const aperto = await apri(appointmentId);
  if (!aperto.aperto) return aperto.no;
  const { appointment } = aperto;

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled', updatedAt: new Date().toISOString() },
  });

  return {
    ok: true,
    messaggio: 'Appuntamento disdetto.',
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    treatmentName: appointment.treatmentName,
    operatorName: appointment.operatorName,
  };
}

/** Gli appuntamenti che una cliente ha ancora davanti. */
export async function prossimiAppuntamenti(clientId: string) {
  return prisma.appointment.findMany({
    where: {
      clientId,
      date: { gte: todayInItaly() },
      status: { notIn: ['cancelled', 'no_show', 'completed'] },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true, date: true, startTime: true, endTime: true,
      treatmentName: true, operatorName: true, status: true,
    },
    take: 10,
  });
}
