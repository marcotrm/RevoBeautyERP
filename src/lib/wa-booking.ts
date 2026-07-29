/**
 * Prenotazione appuntamenti via WhatsApp.
 *
 * Il cliente scrive "vorrei prenotare" e il bot lo guida con menù numerati:
 * trattamento → giorno → orario → conferma. L'appuntamento finisce in agenda
 * usando gli stessi endpoint della pagina pubblica /prenota, quindi valgono le
 * stesse regole di disponibilità e lo stesso controllo anti-doppia-prenotazione
 * (409 se nel frattempo lo slot è stato preso).
 *
 * Scelte di progetto:
 *  - menù numerati e non interpretazione del linguaggio libero: su un'agenda
 *    reale un fraintendimento costa un appuntamento sbagliato, e "rispondi con
 *    il numero" non si presta a equivoci;
 *  - si risponde SOLO dentro la finestra 24h. Non è una limitazione pratica:
 *    la conversazione la apre sempre il cliente scrivendo per primo;
 *  - la sessione scade dopo 30 minuti di silenzio, così una conversazione
 *    lasciata a metà non si riapre giorni dopo dal punto in cui era rimasta;
 *  - niente prenotazioni oltre 60 giorni o nel passato: le valida comunque
 *    l'endpoint, ma è meglio non proporle nemmeno.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendWhatsApp } from '@/lib/whatsapp';
import { sendTelegram } from '@/lib/telegram';
import { getWaAutomationsConfig } from '@/lib/wa-automations';

/**
 * Tutte le risposte del bot passano di qui, così in archivio conversazioni
 * risultano etichettate come "bot prenotazione" e si distinguono a colpo
 * d'occhio da quelle scritte da una persona.
 */
const say = (phone: string, text: string) => sendWhatsApp(phone, text, 'booking');

const SESSION_KIND = 'wa_booking';
/** Minuti di inattività dopo i quali la conversazione riparte da zero. */
const SESSION_TTL_MIN = 30;
/** Giorni di calendario proposti nel menù dei giorni. */
const DAYS_AHEAD = 14;
/** Quanti orari proporre per giornata: oltre diventa un muro di testo. */
const MAX_SLOTS = 9;

type Step = 'treatment' | 'date' | 'slot' | 'name' | 'confirm';

interface SlotOption { time: string; operatorId: string; operatorName: string }

interface BookingSession {
  step: Step;
  updatedAt: string;
  /** Opzioni mostrate all'ultimo messaggio: l'indice scelto si risolve qui. */
  options: Array<{ id: string; label: string; extra?: SlotOption }>;
  treatmentId?: string;
  treatmentName?: string;
  date?: string;
  slot?: SlotOption;
  name?: string;
}

// ============================================================
// Sessione
// ============================================================

function rowId(phone: string): string {
  return `wa:booking:${phone}`;
}

async function loadSession(phone: string): Promise<BookingSession | null> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(phone) } });
  const s = row?.data as unknown as BookingSession | undefined;
  if (!s?.step) return null;
  const age = (Date.now() - new Date(s.updatedAt).getTime()) / 60000;
  if (!isFinite(age) || age > SESSION_TTL_MIN) return null;
  return s;
}

async function saveSession(phone: string, s: BookingSession): Promise<void> {
  const data = { ...s, updatedAt: new Date().toISOString() } as unknown as object;
  await prisma.adminEntry.upsert({
    where: { rowId: rowId(phone) },
    update: { data },
    create: { rowId: rowId(phone), kind: SESSION_KIND, entityId: phone, data, createdAt: new Date().toISOString() },
  });
}

async function clearSession(phone: string): Promise<void> {
  await prisma.adminEntry.delete({ where: { rowId: rowId(phone) } }).catch(() => {});
}

// ============================================================
// Testo
// ============================================================

/** "2026-07-28" → "martedì 28 luglio". */
function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function numberedList(options: Array<{ label: string }>): string {
  return options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
}

/** Indice scelto dal cliente: accetta "3", "3.", "n. 3", "il 3". */
function parseChoice(text: string, max: number): number | null {
  const m = String(text || '').match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= max ? n - 1 : null;
}

const CANCEL = /\b(annulla|lascia stare|niente|stop|esci|basta)\b/i;
export const BOOKING_TRIGGER = /\b(prenot\w*|appuntament\w*|disponibilit\w*|vorrei venire|posso venire)\b/i;

// ============================================================
// Passi
// ============================================================

async function askTreatment(phone: string): Promise<void> {
  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    take: 10,
  });

  if (!treatments.length) {
    await say(phone, 'Al momento non riesco a mostrarti i trattamenti prenotabili. Scrivici pure qui e ti rispondiamo noi.');
    await clearSession(phone);
    return;
  }

  const options = treatments.map((t) => ({ id: t.id, label: `${t.name} (${t.duration} min)` }));
  await saveSession(phone, { step: 'treatment', updatedAt: new Date().toISOString(), options });
  await say(phone,
    'Certo! Per quale trattamento vuoi prenotare?\n\n' +
    numberedList(options) +
    '\n\nRispondi con il numero. Scrivi "annulla" per lasciar perdere.'
  );
}

async function askDate(phone: string, s: BookingSession): Promise<void> {
  const today = todayRome();
  const options = Array.from({ length: DAYS_AHEAD }, (_, i) => shiftDate(today, i))
    .map((d) => ({ id: d, label: i18nDay(d, today) }));

  await saveSession(phone, { ...s, step: 'date', options, updatedAt: new Date().toISOString() });
  await say(phone,
    `Perfetto: ${s.treatmentName}.\nIn che giorno ti farebbe comodo?\n\n` +
    numberedList(options) +
    '\n\nRispondi con il numero.'
  );
}

function i18nDay(ymd: string, today: string): string {
  if (ymd === today) return `Oggi — ${humanDate(ymd)}`;
  if (ymd === shiftDate(today, 1)) return `Domani — ${humanDate(ymd)}`;
  return humanDate(ymd).replace(/^./, (c) => c.toUpperCase());
}

async function askSlot(phone: string, s: BookingSession, origin: string): Promise<void> {
  const url = `${origin}/api/booking/availability?date=${s.date}&treatmentId=${s.treatmentId}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => null);
  const slots: SlotOption[] = res?.slots || [];

  if (!slots.length) {
    await saveSession(phone, { ...s, step: 'date', updatedAt: new Date().toISOString() });
    await say(phone,
      `Mi dispiace, ${humanDate(s.date!)} non ho orari liberi.\n` +
      'Rispondi con il numero di un altro giorno, oppure scrivi "annulla".'
    );
    return;
  }

  const shown = slots.slice(0, MAX_SLOTS);
  const options = shown.map((sl) => ({ id: sl.time, label: `ore ${sl.time}`, extra: sl }));
  await saveSession(phone, { ...s, step: 'slot', options, updatedAt: new Date().toISOString() });
  await say(phone,
    `${humanDate(s.date!)} ho questi orari liberi:\n\n` +
    numberedList(options) +
    '\n\nRispondi con il numero.'
  );
}

async function askConfirm(phone: string, s: BookingSession): Promise<void> {
  await saveSession(phone, { ...s, step: 'confirm', options: [], updatedAt: new Date().toISOString() });
  await say(phone,
    'Riepilogo:\n' +
    `• ${s.treatmentName}\n` +
    `• ${humanDate(s.date!)} alle ${s.slot!.time}\n` +
    `• a nome di ${s.name}\n\n` +
    'Confermo? Rispondi *SI* per prenotare, oppure "annulla".'
  );
}

async function createBooking(phone: string, s: BookingSession, origin: string): Promise<void> {
  const res = await fetch(`${origin}/api/booking/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: s.name,
      phone,
      treatmentId: s.treatmentId,
      date: s.date,
      startTime: s.slot!.time,
      operatorId: s.slot!.operatorId,
    }),
  }).catch(() => null);

  const body = res ? await res.json().catch(() => null) : null;

  if (!res?.ok) {
    // 409 = slot occupato nel frattempo: si riparte dagli orari, non da capo.
    if (res?.status === 409) {
      await say(phone, 'Quell\'orario è appena stato preso da qualcun altro, mi dispiace. Ti rimando gli orari ancora liberi.');
      await askSlot(phone, { ...s, step: 'slot' }, origin);
      return;
    }
    await say(phone,
      `Non sono riuscito a completare la prenotazione${body?.error ? `: ${body.error}` : ''}.\n` +
      'Scrivici pure qui, ti rispondiamo noi e la fissiamo insieme.'
    );
    await clearSession(phone);
    await sendTelegram(
      `⚠️ <b>Prenotazione WhatsApp fallita</b>\n${s.name} — ${s.treatmentName}\n` +
      `${humanDate(s.date!)} ore ${s.slot!.time}\nTel: ${phone}\nErrore: ${body?.error || 'sconosciuto'}`
    ).catch(() => {});
    return;
  }

  await clearSession(phone);
  await say(phone,
    `È fatta! Ti aspettiamo ${humanDate(s.date!)} alle ${s.slot!.time} per ${s.treatmentName}.\n` +
    'Se ti serve spostare l\'appuntamento, scrivici pure qui. A presto!'
  );
  await sendTelegram(
    `📅 <b>Nuova prenotazione da WhatsApp</b>\n${s.name}\n${s.treatmentName}\n` +
    `${humanDate(s.date!)} ore ${s.slot!.time}\nTel: ${phone}`
  ).catch(() => {});
}

// ============================================================
// Ingresso dal webhook
// ============================================================

export interface BookingReplyResult { handled: boolean; step?: Step }

/**
 * Fa avanzare la conversazione di prenotazione. Torna handled=false se il
 * messaggio non riguarda una prenotazione, così il webhook può ignorarlo.
 * Non lancia mai: il webhook deve rispondere 200 comunque.
 */
export async function handleBookingMessage(params: {
  phone: string;
  text: string;
  contactName?: string;
  origin: string;
}): Promise<BookingReplyResult> {
  const { phone, text, origin } = params;

  try {
    // Interruttore generale: da spento il bot non risponde e i messaggi restano
    // in archivio, gestiti da una persona.
    const cfg = await getWaAutomationsConfig();
    if (!cfg.booking) return { handled: false };

    const session = await loadSession(phone);

    if (!session) {
      if (!BOOKING_TRIGGER.test(text)) return { handled: false };
      await askTreatment(phone);
      return { handled: true, step: 'treatment' };
    }

    if (CANCEL.test(text)) {
      await clearSession(phone);
      await say(phone, 'Va bene, non ho prenotato nulla. Se cambi idea scrivimi pure "prenota".');
      return { handled: true };
    }

    switch (session.step) {
      case 'treatment': {
        const i = parseChoice(text, session.options.length);
        if (i === null) {
          await say(phone, `Non ho capito. Rispondi con un numero da 1 a ${session.options.length}, oppure scrivi "annulla".`);
          return { handled: true, step: 'treatment' };
        }
        const chosen = session.options[i];
        await askDate(phone, {
          ...session,
          treatmentId: chosen.id,
          treatmentName: chosen.label.replace(/\s*\(\d+ min\)$/, ''),
        });
        return { handled: true, step: 'date' };
      }

      case 'date': {
        const i = parseChoice(text, session.options.length);
        if (i === null) {
          await say(phone, `Non ho capito. Rispondi con un numero da 1 a ${session.options.length}, oppure scrivi "annulla".`);
          return { handled: true, step: 'date' };
        }
        await askSlot(phone, { ...session, date: session.options[i].id }, origin);
        return { handled: true, step: 'slot' };
      }

      case 'slot': {
        const i = parseChoice(text, session.options.length);
        if (i === null) {
          await say(phone, `Non ho capito. Rispondi con un numero da 1 a ${session.options.length}, oppure scrivi "annulla".`);
          return { handled: true, step: 'slot' };
        }
        const slot = session.options[i].extra as SlotOption;
        const next = { ...session, slot };

        // Se il numero è già in anagrafica non chiediamo di nuovo il nome.
        const known = await prisma.client.findFirst({
          where: { phone: { endsWith: phone.slice(-9) } },
          select: { firstName: true, lastName: true },
        });
        if (known) {
          await askConfirm(phone, { ...next, name: `${known.firstName} ${known.lastName}`.trim() });
          return { handled: true, step: 'confirm' };
        }

        await saveSession(phone, { ...next, step: 'name', options: [], updatedAt: new Date().toISOString() });
        await say(phone, 'Ultima cosa: come ti chiami? (nome e cognome)');
        return { handled: true, step: 'name' };
      }

      case 'name': {
        const name = text.trim().replace(/\s{2,}/g, ' ');
        if (name.length < 2) {
          await say(phone, 'Scrivimi nome e cognome, per favore.');
          return { handled: true, step: 'name' };
        }
        await askConfirm(phone, { ...session, name });
        return { handled: true, step: 'confirm' };
      }

      case 'confirm': {
        if (/^\s*(s[iì]|si'|ok|okay|va bene|confermo|conferma|perfetto|👍|✅)\b/i.test(text)) {
          await createBooking(phone, session, origin);
          return { handled: true };
        }
        await say(phone, 'Rispondi *SI* per confermare la prenotazione, oppure "annulla" per lasciar perdere.');
        return { handled: true, step: 'confirm' };
      }
    }

    return { handled: false };
  } catch (err) {
    console.error('[wa-booking] errore', err);
    return { handled: false };
  }
}
