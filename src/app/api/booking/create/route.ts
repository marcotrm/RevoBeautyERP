import { prisma } from '@/lib/prisma';
import { notifyNuovoAppuntamento } from '@/lib/telegram';
import { findClientByPhone, todayInItaly } from '@/lib/voice';
import { sendAppointmentConfirmation } from '@/lib/wa-appointments';
import { slotDisponibili, type ServizioRichiesto } from '@/lib/bookingEngine';

export const runtime = 'nodejs';

/**
 * Prenotazione dalla pagina pubblica o dalla app clienti.
 *
 * Accetta più trattamenti nella stessa seduta (uno di fila all'altro, anche
 * con operatrici diverse) e ricontrolla la disponibilità al momento del
 * salvataggio: tra quando la cliente ha visto l'orario e quando conferma,
 * quel posto può essere stato preso da qualcun altro.
 */
export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ error: 'Dati mancanti' }, { status: 400 });

  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const email = b.email ? String(b.email).trim() : null;
  const gender = b.gender === 'male' ? 'male' : 'female';

  if (!name) return Response.json({ error: 'Inserisci il tuo nome' }, { status: 400 });
  if (phone.replace(/\D/g, '').length < 6) return Response.json({ error: 'Inserisci un numero di telefono valido' }, { status: 400 });
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return Response.json({ error: 'Seleziona una data' }, { status: 400 });
  if (!b.startTime || !/^\d{2}:\d{2}$/.test(b.startTime)) return Response.json({ error: 'Seleziona un orario' }, { status: 400 });
  if (b.date < todayInItaly()) return Response.json({ error: 'La data è nel passato' }, { status: 400 });

  // Forma nuova (più trattamenti) o quella vecchia a trattamento singolo
  const richiesti: ServizioRichiesto[] = Array.isArray(b.services) && b.services.length > 0
    ? b.services
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: { treatmentId?: unknown; operatorId?: unknown }) => ({
          treatmentId: String(s.treatmentId || ''),
          operatorId: s.operatorId ? String(s.operatorId) : null,
        }))
        .filter((s: ServizioRichiesto) => s.treatmentId)
    : (b.treatmentId ? [{ treatmentId: String(b.treatmentId), operatorId: b.operatorId ? String(b.operatorId) : null }] : []);

  if (richiesti.length === 0) return Response.json({ error: 'Seleziona un trattamento' }, { status: 400 });

  // Ricontrollo: l'orario deve essere ancora libero adesso, non quando è stato mostrato
  const { slots } = await slotDisponibili({ date: b.date, services: richiesti, gender });
  const slot = slots.find(s => s.time === b.startTime);
  if (!slot) {
    return Response.json({ error: 'Questo orario non è più disponibile. Scegli un altro orario.' }, { status: 409 });
  }

  // Trova o crea il cliente dal telefono
  let client = await findClientByPhone(phone);
  if (!client) {
    client = await prisma.client.create({
      data: {
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
        phone,
        email,
        gender: gender === 'male' ? 'M' : 'F',
        createdAt: new Date().toISOString(),
        marketingConsent: !!b.marketingConsent,
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
  }

  const trattamenti = await prisma.treatment.findMany({
    where: { id: { in: slot.assegnazioni.map(a => a.treatmentId) } },
    select: { id: true, category: true, color: true },
  });
  const metaDi = new Map(trattamenti.map(t => [t.id, t]));
  const principale = slot.assegnazioni[0];

  const adesso = new Date().toISOString();
  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      // L'operatrice "dell'appuntamento" è quella del primo trattamento; le
      // altre restano dentro services, come per gli appuntamenti a più mani
      // creati dall'agenda.
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
      notes: 'Prenotazione online',
      createdAt: adesso,
      updatedAt: adesso,
      createdBy: 'online-booking',
    },
  });

  // Conferma WhatsApp e avviso Telegram: nessuno dei due blocca la prenotazione
  sendAppointmentConfirmation(appointment.id).catch(() => {});
  notifyNuovoAppuntamento({
    client: appointment.clientName,
    treatment: appointment.treatmentName,
    operator: appointment.operatorName,
    date: appointment.date,
    time: appointment.startTime,
    price: appointment.price,
    source: 'prenotazione online dal sito',
  }).catch(() => {});

  return Response.json({
    success: true,
    appointment: {
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      price: appointment.price,
      servizi: slot.assegnazioni.map(a => ({
        nome: a.treatmentName, orario: a.startTime, operatrice: a.operatorName, prezzo: a.price,
      })),
    },
  });
}
