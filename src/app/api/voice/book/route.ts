import { prisma } from '@/lib/prisma';
import { notifyNuovoAppuntamento } from '@/lib/telegram';
import { eClienteNuova } from '@/lib/clienteNuova';
import { omonimoInRubrica } from '@/lib/omonimi';
import { sendAppointmentConfirmation } from '@/lib/wa-appointments';
import { slotDisponibili, type ServizioRichiesto } from '@/lib/bookingEngine';
import { quandoParlato } from '@/lib/parlato';
import {
  isAuthorized, unauthorized, badRequest, findClientByPhone, todayInItaly,
} from '@/lib/voice';

export const runtime = 'nodejs';

/**
 * L'appuntamento preso al telefono.
 *
 * Riconosce la cliente dal numero da cui chiama; se non è in rubrica la crea
 * con il nome che ha detto.
 *
 * Il ricontrollo della disponibilità passa dallo stesso motore di tutto il
 * resto (`slotDisponibili`), non più da `hasConflict`: quello guardava solo se
 * l'operatrice era già occupata, e lasciava passare gli appuntamenti presi
 * mentre è in pausa, fuori dal suo turno, o su un lavoro che non fa lei.
 *
 * `oraDa: startTime` non è un dettaglio: senza, la griglia degli orari riparte
 * dall'apertura del centro e cade su minuti diversi da quelli che la cliente
 * si è sentita proporre — la ricerca offre le 18:45, il ricontrollo conosce
 * solo le 18:50, e la prenotazione muore su un orario che era libero.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  if (!b) return badRequest('Body JSON mancante');

  if (!b.phone) return badRequest('Campo "phone" obbligatorio');
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return badRequest('Campo "date" obbligatorio in formato YYYY-MM-DD');
  if (!b.startTime || !/^\d{2}:\d{2}$/.test(b.startTime)) return badRequest('Campo "startTime" obbligatorio in formato HH:MM');
  if (b.date < todayInItaly()) return badRequest('La data richiesta è nel passato');

  // Forma nuova (più trattamenti di fila) e forma vecchia a trattamento singolo
  const richiesti: ServizioRichiesto[] = Array.isArray(b.services) && b.services.length > 0
    ? b.services
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
          treatmentId: String(s.treatmentId || ''),
          operatorId: s.operatorId ? String(s.operatorId) : null,
        }))
        .filter((s: ServizioRichiesto) => s.treatmentId)
    : (b.treatmentId
        ? [{ treatmentId: String(b.treatmentId), operatorId: b.operatorId ? String(b.operatorId) : null }]
        : []);
  if (richiesti.length === 0) return badRequest('Serve almeno un trattamento');

  /*
    La cliente si cerca PRIMA di scrivere, ma si crea DOPO che l'orario ha
    retto: se la telefonata si incaglia sull'orario, in rubrica non deve
    restare una scheda vuota di qualcuno che non ha prenotato niente.
  */
  const esistente = await findClientByPhone(b.phone);
  const gender: 'male' | 'female' = (b.gender === 'male' || b.gender === 'female')
    ? b.gender
    : (esistente?.gender === 'M' ? 'male' : 'female');

  const { slots } = await slotDisponibili({
    date: b.date, services: richiesti, gender, oraDa: b.startTime,
  });
  const slot = slots.find(s => s.time === b.startTime);
  if (!slot) {
    return Response.json({
      success: false,
      code: 'NOT_AVAILABLE',
      message: 'Quell\'orario non è più libero. Proponi un altro orario.',
    }, { status: 409 });
  }

  const client = esistente || await prisma.client.create({
    data: {
      firstName: String(b.clientName || '').trim().split(/\s+/)[0] || 'Cliente',
      lastName: String(b.clientName || '').trim().split(/\s+/).slice(1).join(' '),
      phone: String(b.phone),
      createdAt: new Date().toISOString(),
    },
    select: { id: true, firstName: true, lastName: true, phone: true, gender: true },
  });

  const trattamenti = await prisma.treatment.findMany({
    where: { id: { in: slot.assegnazioni.map(a => a.treatmentId) } },
    select: { id: true, category: true, color: true },
  });
  const metaDi = new Map(trattamenti.map(t => [t.id, t]));
  const principale = slot.assegnazioni[0];

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      operatorId: principale.operatorId,
      operatorName: principale.operatorName,
      treatmentId: principale.treatmentId,
      treatmentName: slot.assegnazioni.map(a => a.treatmentName).join(' + '),
      treatmentCategory: metaDi.get(principale.treatmentId)?.category || 'body',
      date: b.date,
      startTime: slot.time,
      endTime: slot.endTime,
      duration: slot.durataTotale,
      status: 'confirmed',
      price: slot.prezzoTotale,
      services: slot.assegnazioni.map(a => ({
        treatmentId: a.treatmentId,
        treatmentName: a.treatmentName,
        treatmentCategory: metaDi.get(a.treatmentId)?.category || 'body',
        duration: a.duration,
        price: a.price,
        gender,
        operatorId: a.operatorId,
        operatorName: a.operatorName,
      })),
      color: metaDi.get(principale.treatmentId)?.color || '#A855F7',
      notes: 'Prenotazione al telefono',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'voice-assistant',
    },
  });

  // Conferma WhatsApp alla cliente (non blocca la prenotazione)
  sendAppointmentConfirmation(appointment.id).catch(() => {});

  /*
    Chi prenota da fuori non sceglie una scheda: la sua nasce dal numero. Se
    però quel nome in rubrica c'è già con un altro numero, è un possibile
    doppione e va detto stasera, non fra sei mesi.
  */
  Promise.all([
    eClienteNuova(appointment.clientId, appointment.id),
    omonimoInRubrica(prisma, appointment.clientId),
  ])
    .then(([nuova, omonimi]) => notifyNuovoAppuntamento({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      price: appointment.price,
      source: 'assistente vocale',
      nuova,
      omonima: omonimi.length > 0 ? omonimi.map(o => o.phone).join(', ') : null,
    }))
    .catch(() => {});

  return Response.json({
    success: true,
    // Frase già pronta da leggere alla cliente, invece di far comporre al
    // modello una data che potrebbe dire sbagliata.
    message: `Appuntamento fissato ${quandoParlato(appointment.date, appointment.startTime)} con ${appointment.operatorName.split(' ')[0]}.`,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      clientName: appointment.clientName,
      price: appointment.price,
    },
  });
}
