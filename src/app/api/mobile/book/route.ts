import { prisma } from '@/lib/prisma';
import { notifyNuovoAppuntamento } from '@/lib/telegram';
import { eClienteNuova } from '@/lib/clienteNuova';
import { omonimoInRubrica } from '@/lib/omonimi';
import { getAccountFromRequest, unauthorized } from '@/lib/mobile';
import { todayInItaly } from '@/lib/voice';
import { slotDisponibili, type ServizioRichiesto } from '@/lib/bookingEngine';
import { sendAppointmentConfirmation } from '@/lib/wa-appointments';
import { avanzaSfide } from '@/lib/challenge';
import { muoviPunti } from '@/lib/wallet';
import { leggiConfig } from '@/lib/appSettings';
import { traccia } from '@/lib/appEvents';

export const runtime = 'nodejs';

// Prenotazione dall'app clienti: il cliente è identificato dal token (niente nome/telefono da inserire).
export async function POST(request: Request) {
  const account = await getAccountFromRequest(request);
  if (!account) return unauthorized();
  const client = account.client;

  const b = await request.json().catch(() => null);
  if (!b?.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return Response.json({ error: 'Seleziona una data', code: 'VALIDATION' }, { status: 400 });
  if (!b?.startTime || !/^\d{2}:\d{2}$/.test(b.startTime)) return Response.json({ error: 'Seleziona un orario', code: 'VALIDATION' }, { status: 400 });
  if (b.date < todayInItaly()) return Response.json({ error: 'La data è nel passato', code: 'VALIDATION' }, { status: 400 });

  // Più trattamenti nella stessa seduta, o la vecchia forma a trattamento singolo
  const richiesti: ServizioRichiesto[] = Array.isArray(b.services) && b.services.length > 0
    ? b.services
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
          treatmentId: String(s.treatmentId || ''),
          operatorId: s.operatorId ? String(s.operatorId) : null,
        }))
        .filter((s: ServizioRichiesto) => s.treatmentId)
    : (b.treatmentId ? [{ treatmentId: String(b.treatmentId), operatorId: b.operatorId ? String(b.operatorId) : null }] : []);
  if (richiesti.length === 0) return Response.json({ error: 'Seleziona un trattamento', code: 'VALIDATION' }, { status: 400 });

  const gender = (b.gender === 'male' || b.gender === 'female')
    ? b.gender
    : (client.gender === 'M' ? 'male' : 'female');

  // Ricontrollo della disponibilità al momento della conferma: rispetta turni,
  // pause e appuntamenti già presi (stesso motore della pagina web).
  /*
    Il ricontrollo parte DALL'ORARIO CHIESTO, non dall'apertura.

    Senza `oraDa` la griglia degli orari possibili riparte dall'apertura del
    centro, e con un passo che non divide la giornata in modo tondo cade su
    minuti diversi da quelli che la cliente ha visto: la ricerca dalle 15:00
    offriva le 18:45, il ricontrollo dall'apertura conosceva solo le 18:50, e
    la prenotazione moriva con "questo orario non e' piu' disponibile" su un
    orario che era liberissimo. Ancorando la griglia all'ora richiesta, quel
    momento viene sempre valutato per quello che e'.
  */
  const { slots } = await slotDisponibili({ date: b.date, services: richiesti, gender, oraDa: b.startTime });
  const slot = slots.find(s => s.time === b.startTime);
  if (!slot) return Response.json({ error: 'Questo orario non è più disponibile.', code: 'NOT_CANCELLABLE' }, { status: 409 });

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
      notes: 'Prenotazione da app',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'mobile-app',
    },
  });

  // Conferma WhatsApp al cliente (non blocca la prenotazione)
  sendAppointmentConfirmation(appointment.id).catch(() => {});

  // Prenotare dall'app è ciò che si vuole incoraggiare: punti bonus, sfide che
  // avanzano e l'evento per l'attribuzione del fatturato. Niente di tutto ciò
  // deve poter far fallire una prenotazione già scritta in agenda.
  (async () => {
    const config = await leggiConfig();
    if (config.punti.prenotazioneApp > 0) {
      await muoviPunti({
        clientId: client.id,
        punti: config.punti.prenotazioneApp,
        motivo: 'Prenotazione dall\'app',
        sourceType: 'appointment',
        sourceId: appointment.id,
      });
    }
    await avanzaSfide(client.id, 'bookings_app');
    await traccia({
      clientId: client.id, type: 'booking', surface: 'prenota',
      itemId: appointment.id, value: appointment.price,
    });
  })().catch(e => console.error('[app] premi prenotazione non assegnati:', e));

  // Notifica Telegram del nuovo appuntamento (non blocca la prenotazione)
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
      source: 'app clienti',
      nuova,
      omonima: omonimi.length > 0 ? omonimi.map(o => o.phone).join(', ') : null,
    }))
    .catch(() => {});

  return Response.json({
    success: true,
    appointment: {
      date: appointment.date, startTime: appointment.startTime, endTime: appointment.endTime,
      treatmentName: appointment.treatmentName, operatorName: appointment.operatorName, price: appointment.price,
    },
  });
}
