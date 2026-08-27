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
import { isWalkIn } from '@/lib/walkIn';
import { sendTelegram } from '@/lib/telegram';
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { sanitizeParam, WA_TEMPLATES, type TemplateKey } from '@/lib/wa-templates';
import { listD360Templates } from '@/lib/whatsapp360';
import { getWaAutomationsConfig } from '@/lib/wa-automations';
import { avviaSpostamento } from '@/lib/wa-spostamento';

/**
 * L'ora che si dice alla cliente: quando deve essere qui.
 *
 * Se un trattamento della seduta è affidato a un'altra operatrice e comincia
 * prima, l'inizio del blocco principale non è l'inizio vero della sua visita.
 */
function oraPerLaCliente(appt: { startTime: string; services?: unknown }): string {
  const orari = [appt.startTime].filter(Boolean);
  const servizi = Array.isArray(appt.services) ? (appt.services as { startTime?: string }[]) : [];
  for (const sv of servizi) if (sv?.startTime) orari.push(sv.startTime);
  return orari.sort()[0] || appt.startTime;
}

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
  /**
   * Gestisci solo il "Confermo" e lascia stare il "Devo spostare".
   *
   * Serve quando è accesa la segretaria: lo spostamento lo porta avanti lei in
   * conversazione, e questa via — che si limita ad annotare e avvisare il
   * centro — le passerebbe davanti lasciando la cliente senza risposta.
   */
  soloConferme?: boolean;
}): Promise<ReminderReplyResult> {
  const intent = detectReminderIntent(params.text, params.payloadId);
  if (!intent) return { handled: false, intent: null };

  try {
    if (intent === 'reschedule' && params.soloConferme) {
      return { handled: false, intent, note: 'spostamento lasciato alla segretaria' };
    }

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

    /*
      Richiesta di spostamento.

      Se l'agente è acceso prende lui la conversazione: propone giorni e orari
      liberi, sposta davvero e poi rimette in vendita il posto lasciato libero.
      Da spento resta il comportamento di prima — si annota e si avvisa il
      centro, l'agenda non si tocca — che è meglio di un bot a metà.
    */
    const preso = await avviaSpostamento({ phone: params.phone, appointment: appt });
    if (preso.handled) {
      return { handled: true, intent, appointmentId: appt.id, note: preso.nota || 'gestita dall\'agente spostamenti' };
    }

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

// ============================================================
// Conferma alla prenotazione
// ============================================================

const CONFIRM_LOG_KIND = 'wa_log';

/** "2026-07-28" → "martedì 28 luglio". */
function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Manda la conferma subito dopo che l'appuntamento è entrato in agenda,
 * da qualunque canale sia arrivato (gestionale, prenotazione online, bot
 * WhatsApp, assistente vocale).
 *
 * Non lancia mai e non blocca: se WhatsApp è spento o il numero non è valido,
 * la prenotazione resta comunque salvata. Deduplica sull'id appuntamento, così
 * una modifica successiva non rimanda la stessa conferma.
 */
export async function sendAppointmentConfirmation(appointmentId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const cfg = await getWaAutomationsConfig();
    if (!cfg.confirm) return { sent: false, reason: 'conferma spenta' };

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true },
    });
    if (!appt) return { sent: false, reason: 'appuntamento non trovato' };
    if (!OPEN_STATUSES.includes(appt.status)) return { sent: false, reason: `stato ${appt.status}` };
    // Cliente entrata e servita al momento: la conferma non ha senso, è già qui.
    if (isWalkIn(appt.date, appt.startTime)) return { sent: false, reason: 'cliente già in negozio' };

    const phone = appt.client?.phone;
    if (!isSendablePhone(phone)) return { sent: false, reason: 'numero non valido' };

    const rowId = `wa:confirm:${appt.clientId}:${appt.id}`;
    const existing = await prisma.adminEntry.findUnique({ where: { rowId } });
    if ((existing?.data as { ok?: boolean } | null)?.ok) return { sent: false, reason: 'già inviata' };

    const params = [
      sanitizeParam(appt.client?.firstName || appt.clientName.split(' ')[0]),
      sanitizeParam(appt.treatmentName, 'il tuo trattamento'),
      sanitizeParam(humanDate(appt.date)),
      sanitizeParam(oraPerLaCliente(appt)),
    ];
    const preview = WA_TEMPLATES.confirm.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');

    // In simulazione si vede in archivio cosa sarebbe partito, senza mandarlo.
    if (cfg.dryRun) {
      console.log(`[wa-appointments] SIMULAZIONE conferma a ${normalizePhone(phone as string)}: ${preview}`);
      return { sent: false, reason: 'simulazione attiva' };
    }

    const res = await sendWhatsAppTemplate(normalizePhone(phone as string), 'confirm', {
      bodyParams: params,
      fallbackText: preview,
      source: 'automation',
    });

    const now = new Date().toISOString();
    await prisma.adminEntry.upsert({
      where: { rowId },
      update: { data: { automation: 'confirm', clientId: appt.clientId, phone: normalizePhone(phone as string), messageId: res.messageId, ok: res.ok, error: res.error, sentAt: now } },
      create: {
        rowId, kind: CONFIRM_LOG_KIND, entityId: rowId,
        data: { automation: 'confirm', clientId: appt.clientId, phone: normalizePhone(phone as string), messageId: res.messageId, ok: res.ok, error: res.error, sentAt: now },
        createdAt: now,
      },
    });

    if (!res.ok) console.error(`[wa-appointments] conferma non inviata a ${appt.clientName}: ${res.error}`);
    return { sent: res.ok, reason: res.error };
  } catch (err) {
    console.error('[wa-appointments] errore invio conferma', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'errore' };
  }
}


/**
 * L'appuntamento è stato spostato: la cliente deve saperlo.
 *
 * Prima, cambiando ora dal gestionale, non partiva niente: in mano alla
 * cliente restava la conferma vecchia, e si presentava all'ora vecchia. Qui si
 * manda il nuovo orario, una volta per ogni spostamento.
 *
 * Non parte quando è la cliente stessa a spostarlo da WhatsApp: quel percorso
 * (lib/wa-spostamento.ts) scrive in agenda per conto suo e le conferma il
 * nuovo orario nella chat, quindi da qui non passa e non arriva un doppione.
 */
export async function sendAppointmentMoved(appointmentId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const cfg = await getWaAutomationsConfig();
    // Stesso interruttore della conferma: chi non vuole i messaggi
    // dell'appuntamento non vuole nemmeno questo.
    if (!cfg.confirm) return { sent: false, reason: 'conferma spenta' };

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true },
    });
    if (!appt) return { sent: false, reason: 'appuntamento non trovato' };
    if (!OPEN_STATUSES.includes(appt.status)) return { sent: false, reason: `stato ${appt.status}` };
    // Spostato a un'ora già passata (o a "adesso"): avvisare non serve più.
    if (isWalkIn(appt.date, appt.startTime)) return { sent: false, reason: 'orario già in corso' };

    const phone = appt.client?.phone;
    if (!isSendablePhone(phone)) return { sent: false, reason: 'numero non valido' };

    /*
      Un messaggio per ogni orario nuovo: si può spostare due volte lo stesso
      appuntamento e la cliente li riceve entrambi, ma salvare due volte la
      stessa modifica non le manda niente.
    */
    const oraDaDire = oraPerLaCliente(appt);
    const rowId = `wa:spostato:${appt.id}:${appt.date}:${oraDaDire}`;
    const existing = await prisma.adminEntry.findUnique({ where: { rowId } });
    if ((existing?.data as { ok?: boolean } | null)?.ok) return { sent: false, reason: 'già inviato' };

    const params = [
      sanitizeParam(appt.client?.firstName || appt.clientName.split(' ')[0]),
      sanitizeParam(appt.treatmentName, 'il tuo trattamento'),
      sanitizeParam(humanDate(appt.date)),
      sanitizeParam(appt.startTime),
    ];

    /*
      Quale messaggio parte. Quello dedicato dice "abbiamo spostato" ed è il
      testo giusto; finché Meta non l'ha approvato si ripiega sulla conferma,
      che è approvata e porta comunque l'orario nuovo. Meglio una conferma con
      l'ora giusta che il silenzio.
    */
    const remote = await listD360Templates();
    const approvato = (nome: string) => remote.ok && remote.templates.some(
      t => t.name === nome && t.language.toLowerCase().startsWith('it') && t.status.toUpperCase() === 'APPROVED',
    );
    const chiave: TemplateKey = approvato(WA_TEMPLATES.spostato.name) ? 'spostato' : 'confirm';
    const preview = WA_TEMPLATES[chiave].body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');

    if (cfg.dryRun) {
      console.log(`[wa-appointments] SIMULAZIONE spostamento a ${normalizePhone(phone as string)}: ${preview}`);
      return { sent: false, reason: 'simulazione attiva' };
    }

    const res = await sendWhatsAppTemplate(normalizePhone(phone as string), chiave, {
      bodyParams: params,
      fallbackText: preview,
      source: 'automation',
    });

    const now = new Date().toISOString();
    const dati = {
      automation: 'spostato', clientId: appt.clientId, phone: normalizePhone(phone as string),
      messageId: res.messageId, ok: res.ok, error: res.error, sentAt: now,
    };
    await prisma.adminEntry.upsert({
      where: { rowId },
      update: { data: dati },
      create: { rowId, kind: CONFIRM_LOG_KIND, entityId: rowId, data: dati, createdAt: now },
    });

    if (!res.ok) console.error(`[wa-appointments] spostamento non comunicato a ${appt.clientName}: ${res.error}`);
    return { sent: res.ok, reason: res.error };
  } catch (err) {
    console.error('[wa-appointments] errore avviso spostamento', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'errore' };
  }
}
