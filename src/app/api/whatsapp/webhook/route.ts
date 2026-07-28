/**
 * Webhook WhatsApp (360dialog → gestionale).
 *
 * Riceve due cose:
 *  - `messages`: risposte dei clienti. Aprono la finestra 24h e gestiscono l'opt-out.
 *  - `statuses`: stati di consegna (sent/delivered/read/failed) dei nostri invii.
 *
 * 360dialog non firma le richieste: proteggiamo l'endpoint con un token in
 * query string. Imposta D360_WEBHOOK_TOKEN e registra il webhook come
 * https://erp.revobeauty.it/api/whatsapp/webhook?token=<segreto>
 */

import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/whatsapp';
import { handleReminderReply } from '@/lib/wa-appointments';
import { handleBookingMessage } from '@/lib/wa-booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_KIND = 'wa_window';
const INBOX_KIND = 'wa_inbox';

/** Parole che il cliente può scrivere per non ricevere più marketing. */
const OPT_OUT = /\b(stop|basta|cancellami|disiscriv|non scriv|rimuovi|unsubscribe)\w*/i;

function authorized(request: Request): boolean {
  const expected = process.env.D360_WEBHOOK_TOKEN;
  if (!expected) return true; // non configurato: nessun controllo (sconsigliato in produzione)
  const url = new URL(request.url);
  return url.searchParams.get('token') === expected;
}

// Verifica alla Meta (hub challenge). 360dialog non la usa, ma non costa nulla supportarla.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('hub.challenge');
  const token = url.searchParams.get('hub.verify_token');
  if (challenge && (!process.env.D360_WEBHOOK_TOKEN || token === process.env.D360_WEBHOOK_TOKEN)) {
    return new Response(challenge, { status: 200 });
  }
  return Response.json({ ok: true, endpoint: 'whatsapp-webhook' });
}

interface WaContact { wa_id?: string; profile?: { name?: string } }
interface WaMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
}
interface WaStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string }>;
}

/** Testo utile del messaggio, qualunque sia il tipo. */
function messageText(m: WaMessage): string {
  return (
    m.text?.body ||
    m.button?.text ||
    m.interactive?.button_reply?.title ||
    m.interactive?.list_reply?.title ||
    `[${m.type || 'messaggio'}]`
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Token webhook non valido' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json({ error: 'Payload non valido' }, { status: 400 });

  const now = new Date().toISOString();
  let handled = 0;
  // Base URL con cui il bot richiama gli endpoint di prenotazione del gestionale.
  // In produzione dietro proxy la request può arrivare con host interno: se c'è
  // APP_URL vince quella.
  const origin = process.env.APP_URL || new URL(request.url).origin;

  try {
    type Change = { value?: { messages?: WaMessage[]; statuses?: WaStatus[]; contacts?: WaContact[] } };
    const changes: Change[] = (payload.entry || []).flatMap((e: { changes?: Change[] }) => e.changes || []);

    for (const change of changes) {
      const value = change.value || {};
      const contactName = value.contacts?.[0]?.profile?.name;

      // --- Messaggi in ingresso -------------------------------
      for (const m of value.messages || []) {
        if (!m.from) continue;
        const phone = normalizePhone(m.from);
        const text = messageText(m);
        handled++;

        // La finestra 24h riparte da adesso: possiamo rispondere a testo libero.
        await prisma.adminEntry.upsert({
          where: { rowId: `wa:window:${phone}` },
          update: { data: { phone, lastInboundAt: now, name: contactName } },
          create: {
            rowId: `wa:window:${phone}`, kind: WINDOW_KIND, entityId: phone,
            data: { phone, lastInboundAt: now, name: contactName }, createdAt: now,
          },
        });

        // Archivio del messaggio, così la chat resta nel gestionale.
        await prisma.adminEntry.upsert({
          where: { rowId: `wa:in:${m.id || `${phone}:${m.timestamp || now}`}` },
          update: { data: { phone, text, type: m.type, name: contactName, receivedAt: now } },
          create: {
            rowId: `wa:in:${m.id || `${phone}:${m.timestamp || now}`}`, kind: INBOX_KIND, entityId: phone,
            data: { phone, text, type: m.type, name: contactName, receivedAt: now }, createdAt: now,
          },
        });

        // Opt-out: obbligatorio onorarlo, sia da bottone che da testo libero.
        const payloadId = m.button?.payload || m.interactive?.button_reply?.id || '';
        if (OPT_OUT.test(text) || /opt.?out|stop/i.test(payloadId)) {
          const updated = await prisma.client.updateMany({
            where: { phone: { endsWith: phone.slice(-9) } },
            data: { marketingConsent: false },
          });
          console.log(`[wa-webhook] opt-out da ${phone}: ${updated.count} cliente/i aggiornati`);
          continue; // chi chiede di non essere più contattato non va interpretato oltre
        }

        // Risposte al promemoria: "Confermo" conferma l'appuntamento, "Devo spostare"
        // lascia l'agenda intatta e avvisa il centro.
        const reply = await handleReminderReply({ phone, text, payloadId, contactName });
        if (reply.handled) {
          console.log(`[wa-webhook] ${phone}: promemoria ${reply.intent} su appuntamento ${reply.appointmentId}`);
          continue;
        }

        // Prenotazione guidata: parte su "prenota/appuntamento" e prosegue finché
        // la conversazione è aperta. Se non c'entra, il messaggio resta solo in archivio
        // e risponde una persona.
        const booking = await handleBookingMessage({ phone, text, contactName, origin });
        if (booking.handled) {
          console.log(`[wa-webhook] ${phone}: prenotazione, passo ${booking.step || 'concluso'}`);
        }
      }

      // --- Stati di consegna ----------------------------------
      for (const s of value.statuses || []) {
        if (!s.id) continue;
        handled++;
        const rowId = `wa:status:${s.id}`;
        const data = {
          messageId: s.id,
          status: s.status,
          phone: s.recipient_id ? normalizePhone(s.recipient_id) : undefined,
          error: s.errors?.[0]?.title,
          errorCode: s.errors?.[0]?.code,
          updatedAt: now,
        };
        await prisma.adminEntry.upsert({
          where: { rowId },
          update: { data },
          create: { rowId, kind: 'wa_status', entityId: s.id, data, createdAt: now },
        });
        if (s.status === 'failed') {
          console.error(`[wa-webhook] invio fallito ${s.id}`, s.errors);
        }
      }
    }
  } catch (err) {
    console.error('[wa-webhook] errore elaborazione', err);
    // Rispondiamo comunque 200: un 500 fa ritentare Meta all'infinito.
  }

  return Response.json({ ok: true, handled });
}
