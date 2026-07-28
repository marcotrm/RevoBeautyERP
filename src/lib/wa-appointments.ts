/**
 * Risposte dei clienti al promemoria appuntamento.
 *
 * Il promemoria (template `promemoria_appuntamento`) ha due bottoni di risposta
 * rapida: "Confermo" e "Devo spostare". Qui li traduciamo in azioni sull'agenda:
 *
 *  - Confermo      → l'appuntamento passa a `confirmed`, nessuno deve fare nulla;
 *  - Devo spostare → l'appuntamento NON viene toccato (spostarlo è una decisione
 *                    del centro, non del bot): si annota la richiesta e parte una
 *                    notifica Telegram, così qualcuno richiama il cliente.
 *
 * Il collegamento cliente → appuntamento avviene sul numero di telefono: WhatsApp
 * ci dà solo quello. Si confronta sulle ultime 9 cifre per non inciampare nei
 * prefissi scritti in modo diverso (+39, 0039, senza prefisso).
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendTelegram } from '@/lib/telegram';

/** Un appuntamento già passato o annullato non si conferma né si sposta. */
const OPEN_STATUSES = ['confirmed', 'pending', 'scheduled', 'booked'];

export type ReminderIntent = 'confirm' | 'reschedule' | null;

/**
 * Riconosce l'intenzione dalla risposta del cliente. Guarda prima il payload del
 * bottone (stabile) e poi il testo libero, perché molti rispondono scrivendo.
 */
export function detectReminderIntent(text: string, payloadId: string): ReminderIntent {
  const p = String(payloadId || '').toLowerCase();
  if (/confirm|conferm/.test(p)) return 'confirm';
  if (/reschedul|spost|cambi/.test(p)) return 'reschedule';

  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  // "non confermo" / "non posso" non è una conferma: la negazione va vista prima.
  if (/\b(non posso|non riesco|non ce la faccio|devo spostare|spostare|spostiamo|rimandare|cambiare (data|orario)|un altro giorno)\b/.test(t)) {
    return 'reschedule';
  }
  if (/^(s[ìi]|ok|okay|va bene|confermo|confermato|perfetto|ci sono|presente|👍|✅)\b/.test(t)) return 'confirm';
  return null;
}

/** Prossimo appuntamento aperto di quel numero, dal giorno corrente in avanti. */
async function nextAppointmentByPhone(phone: string) {
  const tail = phone.slice(-9);
  if (tail.length < 9) return null;
  return prisma.appointment.findFirst({
    where: {
      date: { gte: todayRome() },
      status: { in: OPEN_STATUSES },
      client: { phone: { endsWith: tail } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { client: true },
  });
}

export interface ReminderReplyResult {
  handled: boolean;
  intent: ReminderIntent;
  appointmentId?: string;
  note?: string;
}

/**
 * Applica la risposta del cliente al promemoria. Non lancia mai: il webhook deve
 * rispondere 200 comunque, altrimenti Meta ritenta all'infinito.
 */
export async function handleReminderReply(params: {
  phone: string;
  text: string;
  payloadId: string;
  contactName?: string;
}): Promise<ReminderReplyResult> {
  const intent = detectReminderIntent(params.text, params.payloadId);
  if (!intent) return { handled: false, intent: null };

  try {
    const appt = await nextAppointmentByPhone(params.phone);
    if (!appt) {
      return { handled: false, intent, note: 'nessun appuntamento aperto per questo numero' };
    }

    const who = appt.clientName || params.contactName || params.phone;
    const quando = `${appt.date.split('-').reverse().join('/')} alle ${appt.startTime}`;

    if (intent === 'confirm') {
      if (appt.status !== 'confirmed') {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { status: 'confirmed', updatedAt: new Date().toISOString() },
        });
      }
      return { handled: true, intent, appointmentId: appt.id };
    }

    // Richiesta di spostamento: si annota e si avvisa, l'agenda non si tocca.
    const nota = `[WhatsApp ${new Date().toLocaleDateString('it-IT')}] Il cliente ha chiesto di spostare questo appuntamento.`;
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        notes: appt.notes ? `${appt.notes}\n${nota}` : nota,
        updatedAt: new Date().toISOString(),
      },
    });

    await sendTelegram(
      `🔄 <b>Richiesta di spostamento</b>\n` +
      `Cliente: ${who}\n` +
      `Appuntamento: ${appt.treatmentName} — ${quando}\n` +
      `Telefono: ${appt.client?.phone || params.phone}\n\n` +
      `Ha risposto al promemoria WhatsApp. L'appuntamento è ancora in agenda: richiamalo per concordare la nuova data.`
    ).catch(() => {});

    return { handled: true, intent, appointmentId: appt.id };
  } catch (err) {
    console.error('[wa-appointments] errore gestione risposta promemoria', err);
    return { handled: false, intent };
  }
}
