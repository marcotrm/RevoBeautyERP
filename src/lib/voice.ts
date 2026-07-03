import { prisma } from '@/lib/prisma';

// ============================================================
// Utility condivise per le API dell'assistente vocale
// ============================================================

const OPENING_TIME = '09:00';
const CLOSING_TIME = '19:00';

export function isAuthorized(request: Request): boolean {
  const secret = process.env.VOICE_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

export function unauthorized() {
  return Response.json({ error: 'Non autorizzato' }, { status: 401 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// Confronta numeri di telefono ignorando prefisso internazionale, spazi e trattini
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

export async function findClientByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 6) return null;
  const clients = await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  return clients.find((c) => normalizePhone(c.phone) === normalized) || null;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Data odierna nel fuso orario italiano (YYYY-MM-DD)
export function todayInItaly(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

const BLOCKING_STATUSES = ['confirmed', 'pending', 'in_progress', 'in_cabin', 'completed'];

// Slot liberi di un'operatrice in una data, a passi di 30 minuti
export async function getFreeSlots(date: string, operatorId: string, duration: number): Promise<string[]> {
  const appointments = await prisma.appointment.findMany({
    where: { date, operatorId, status: { in: BLOCKING_STATUSES } },
    select: { startTime: true, endTime: true },
  });
  const busy = appointments.map((a) => [toMinutes(a.startTime), toMinutes(a.endTime)]);
  const open = toMinutes(OPENING_TIME);
  const close = toMinutes(CLOSING_TIME);
  const slots: string[] = [];
  for (let start = open; start + duration <= close; start += 30) {
    const end = start + duration;
    const overlaps = busy.some(([bStart, bEnd]) => start < bEnd && end > bStart);
    if (!overlaps) slots.push(toHHMM(start));
  }
  return slots;
}

export async function hasConflict(
  date: string,
  operatorId: string,
  startTime: string,
  duration: number,
  excludeAppointmentId?: string
): Promise<boolean> {
  const start = toMinutes(startTime);
  const end = start + duration;
  if (start < toMinutes(OPENING_TIME) || end > toMinutes(CLOSING_TIME)) return true;
  const appointments = await prisma.appointment.findMany({
    where: {
      date,
      operatorId,
      status: { in: BLOCKING_STATUSES },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { startTime: true, endTime: true },
  });
  return appointments.some((a) => start < toMinutes(a.endTime) && end > toMinutes(a.startTime));
}
