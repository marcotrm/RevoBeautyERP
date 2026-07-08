import { prisma } from '@/lib/prisma';
import { hasConflict, findClientByPhone, toMinutes, toHHMM, todayInItaly } from '@/lib/voice';

export const runtime = 'nodejs';

// Crea una prenotazione dalla pagina pubblica.
// Trova/crea il cliente dal telefono, assegna un'operatrice libera, crea l'appuntamento.
export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ error: 'Dati mancanti' }, { status: 400 });

  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const email = b.email ? String(b.email).trim() : null;
  const gender = b.gender === 'male' ? 'male' : 'female';

  if (!name) return Response.json({ error: 'Inserisci il tuo nome' }, { status: 400 });
  if (phone.replace(/\D/g, '').length < 6) return Response.json({ error: 'Inserisci un numero di telefono valido' }, { status: 400 });
  if (!b.treatmentId) return Response.json({ error: 'Seleziona un trattamento' }, { status: 400 });
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return Response.json({ error: 'Seleziona una data' }, { status: 400 });
  if (!b.startTime || !/^\d{2}:\d{2}$/.test(b.startTime)) return Response.json({ error: 'Seleziona un orario' }, { status: 400 });
  if (b.date < todayInItaly()) return Response.json({ error: 'La data è nel passato' }, { status: 400 });

  const treatment = await prisma.treatment.findUnique({ where: { id: String(b.treatmentId) } });
  if (!treatment) return Response.json({ error: 'Trattamento non trovato' }, { status: 404 });

  const duration = gender === 'male'
    ? (treatment.durationMale ?? treatment.durationFemale ?? treatment.duration)
    : (treatment.durationFemale ?? treatment.duration);
  const price = gender === 'male'
    ? (treatment.priceMale ?? treatment.priceFemale ?? treatment.price)
    : (treatment.priceFemale ?? treatment.price);

  // Scegli l'operatrice: quella richiesta (se libera) o la prima libera
  const operators = await prisma.operator.findMany({ where: { isActive: true } });
  let chosen: typeof operators[number] | null = null;
  const preferredId = b.operatorId ? String(b.operatorId) : null;
  const ordered = preferredId
    ? [...operators].sort((a) => (a.id === preferredId ? -1 : 1))
    : operators;
  for (const op of ordered) {
    const conflict = await hasConflict(b.date, op.id, b.startTime, duration);
    if (!conflict) { chosen = op; break; }
  }
  if (!chosen) {
    return Response.json({ error: 'Questo orario non è più disponibile. Scegli un altro orario.' }, { status: 409 });
  }

  // Trova o crea il cliente dal telefono
  let client = await findClientByPhone(phone);
  if (!client) {
    const created = await prisma.client.create({
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
    client = created;
  }

  const endTime = toHHMM(toMinutes(b.startTime) + duration);
  const operatorName = `${chosen.firstName} ${chosen.lastName}`.trim();

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      operatorId: chosen.id,
      operatorName,
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      treatmentCategory: treatment.category,
      date: b.date,
      startTime: b.startTime,
      endTime,
      duration,
      status: 'confirmed',
      price,
      color: treatment.color,
      notes: 'Prenotazione online',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'online-booking',
    },
  });

  return Response.json({
    success: true,
    appointment: {
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      price: appointment.price,
    },
  });
}
