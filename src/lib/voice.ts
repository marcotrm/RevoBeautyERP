import { prisma } from '@/lib/prisma';
import { confrontoSicuro } from '@/lib/conferma';

// ============================================================
// Utility condivise per le API dell'assistente vocale
// ============================================================

const OPENING_TIME = '09:00';
const CLOSING_TIME = '19:00';

export function isAuthorized(request: Request): boolean {
  const secret = process.env.VOICE_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  // Confronto a tempo costante: `===` esce al primo byte diverso, e quella
  // differenza di tempo si misura per indovinare il segreto un pezzo per volta.
  return confrontoSicuro(header, `Bearer ${secret}`);
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

/**
 * Chi sta chiamando, cercato dalle ultime nove cifre del numero.
 *
 * Prima si tirava dentro l'intera rubrica a ogni chiamata e si filtrava in
 * JavaScript: funziona, ma sta sul percorso critico di ogni telefonata e
 * cresce con il centro. Adesso si prova prima la strada corta — il numero
 * salvato così com'è finisce quasi sempre con quelle nove cifre — e solo se
 * non trova niente si ripiega sul confronto normalizzato, che è l'unico che
 * regge i numeri scritti con spazi, punti o il prefisso attaccato.
 */
const CAMPI_CLIENTE = {
  id: true, firstName: true, lastName: true, phone: true, gender: true,
} as const;

export async function findClientByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 6) return null;

  const diretto = await prisma.client.findFirst({
    where: { phone: { endsWith: normalized } },
    select: CAMPI_CLIENTE,
  });
  if (diretto) return diretto;

  const clients = await prisma.client.findMany({ select: CAMPI_CLIENTE });
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
/**
 * @deprecated Guarda solo apertura e chiusura del centro: ignora il turno vero
 * dell'operatrice, la pausa, la settimana personalizzata di Staff → Turni, le
 * fasce bloccate in agenda e chi quel lavoro lo sa fare. Proponeva le 15:00 a
 * chi è in pausa e le 16:00 a chi stacca alle 14.
 *
 * Usa `slotDisponibili` o `cercaSlot` di `lib/bookingEngine`, che è il motore
 * di tutto il resto — app clienti, pagina /prenota e assistente al telefono.
 * Resta qui finché non è certo che nessuno la chiami più.
 */
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

/**
 * Quanto preavviso serve per spostare o disdire da soli.
 *
 * Sotto le ventiquattr'ore il posto non si rivende piu': e' tempo di cabina
 * gia' perso, e la decisione se farlo passare o no la prende il centro, non
 * una voce al telefono.
 */
export const PREAVVISO_ORE = 24;

/** Quante ore mancano all'appuntamento. Negativo se e' gia' passato. */
export function oreDaAdesso(date: string, startTime: string): number {
  // Gli appuntamenti sono scritti in ora italiana; il server puo' stare altrove.
  const adessoIt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const quando = new Date(`${date}T${startTime}:00`);
  return (quando.getTime() - adessoIt.getTime()) / 3_600_000;
}

/**
 * Vero se l'appuntamento e' troppo vicino perche' l'assistente ci metta mano.
 * In quel caso la telefonata va passata al centro, non chiusa con un no.
 */
export function troppoTardi(date: string, startTime: string): boolean {
  return oreDaAdesso(date, startTime) < PREAVVISO_ORE;
}
