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
import { rispostaCopriBuchi } from '@/lib/copriBuchi';
import { handleBookingMessage } from '@/lib/wa-booking';
import { handleSpostamentoMessage } from '@/lib/wa-spostamento';
import { handleAssistantMessage } from '@/lib/wa-assistant';
import { logInbound, type WaMedia, type WaMediaKind } from '@/lib/wa-conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_KIND = 'wa_window';

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
/** Blocco allegato: Meta usa la stessa forma per foto, audio, video, sticker e documenti. */
interface WaMediaPart { id?: string; mime_type?: string; caption?: string; filename?: string; voice?: boolean }
interface WaMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
  /** Emoji messo su un nostro messaggio (il "cuoricino" di WhatsApp). */
  reaction?: { emoji?: string; message_id?: string };
  /** Allegati: WhatsApp manda solo l'id del file, non il contenuto. */
  image?: WaMediaPart;
  sticker?: WaMediaPart;
  audio?: WaMediaPart;
  video?: WaMediaPart;
  document?: WaMediaPart;
  /** La posizione non è un file: non c'è niente da scaricare, solo da leggere. */
  location?: { name?: string; address?: string };
}

/** Come chiamare a parole i messaggi che non sono testo. */
const TIPI_LEGGIBILI: Record<string, string> = {
  image: '📷 Foto',
  video: '🎥 Video',
  audio: '🎤 Messaggio vocale',
  voice: '🎤 Messaggio vocale',
  sticker: '🩷 Sticker',
  document: '📎 Documento',
  location: '📍 Posizione',
  contacts: '👤 Contatto',
};
interface WaStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string }>;
}

/**
 * Testo utile del messaggio, qualunque sia il tipo.
 *
 * Foto, vocali e reazioni non hanno un corpo di testo: WhatsApp manda solo il
 * tipo (e per le reazioni l'emoji). Senza tradurli, in chat compariva un secco
 * "[reaction]" o "[image]" che non dice niente a chi legge.
 */
function messageText(m: WaMessage): string {
  if (m.reaction?.emoji) return `${m.reaction.emoji} (reazione a un messaggio)`;

  const didascalia = m.image?.caption || m.video?.caption || m.document?.caption;
  const tipo = m.type ? TIPI_LEGGIBILI[m.type] : undefined;
  if (tipo) {
    if (m.type === 'document' && m.document?.filename) return `${tipo}: ${m.document.filename}`;
    if (m.type === 'location') {
      const dove = [m.location?.name, m.location?.address].filter(Boolean).join(' — ');
      return dove ? `${tipo}: ${dove}` : tipo;
    }
    return didascalia ? `${tipo}: ${didascalia}` : tipo;
  }

  return (
    m.text?.body ||
    m.button?.text ||
    m.interactive?.button_reply?.title ||
    m.interactive?.list_reply?.title ||
    didascalia ||
    `[${m.type || 'messaggio'}]`
  );
}

const MEDIA_KINDS: WaMediaKind[] = ['image', 'sticker', 'audio', 'video', 'document'];

/**
 * Allegato del messaggio, se c'è.
 *
 * Del file non salviamo il binario: resta su Meta e lo scarica al bisogno la
 * rotta proxy. Qui teniamo solo l'id e quanto basta a mostrarlo.
 */
function messageMedia(m: WaMessage): WaMedia | undefined {
  for (const kind of MEDIA_KINDS) {
    const part = m[kind];
    if (part?.id) {
      return {
        kind,
        id: part.id,
        mimeType: part.mime_type,
        filename: part.filename,
        caption: part.caption,
        // I vocali registrati sul momento arrivano con voice:true; un mp3 allegato no.
        voice: kind === 'audio' ? part.voice !== false : undefined,
      };
    }
  }
  return undefined;
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
        const media = messageMedia(m);
        // `text` resta l'etichetta leggibile ("📷 Foto: ...") che alimenta
        // l'anteprima in elenco; il file vero viaggia a parte in `media`.
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

        // Archivio del messaggio, così la chat resta nel gestionale. Va nello
        // stesso archivio delle risposte in uscita: è quello che alimenta la
        // schermata Conversazioni.
        await logInbound({ phone, text, media, name: contactName, messageId: m.id, at: now });

        // Un vocale o una foto senza didascalia non sono interpretabili: farli
        // passare ai bot significherebbe rispondere a caso a "📷 Foto".
        // Restano in chat e li legge una persona.
        if (media && !media.caption) continue;

        // Una reazione (il "cuoricino" su un messaggio) non è una richiesta:
        // resta in chat ma non deve far partire bot, promemoria o assistente.
        if (m.type === 'reaction') continue;

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

        // Copri buchi: "Lo prendo io" sul posto che si è liberato. Va prima di
        // tutto il resto perché è una corsa — vince chi risponde per prima, e
        // ogni secondo speso a interpretare altro è un secondo perso.
        const buco = await rispostaCopriBuchi({ phone, text, payloadId });
        if (buco.gestita) {
          console.log(`[wa-webhook] ${phone}: copri buchi — ${buco.nota}`);
          continue;
        }

        // Spostamento in corso: se per questo numero c'è una conversazione
        // aperta ("in che giorno?", "quale orario?"), il numero che arriva
        // adesso è una risposta a quella. Va prima della prenotazione,
        // altrimenti un "2" verrebbe letto come scelta di un trattamento.
        const spostamento = await handleSpostamentoMessage({ phone, text, origin });
        if (spostamento.handled) {
          console.log(`[wa-webhook] ${phone}: spostamento, passo ${spostamento.passo || 'concluso'}`);
          continue;
        }

        // Risposte al promemoria: "Confermo" conferma l'appuntamento, "Devo spostare"
        // apre lo spostamento guidato (o avvisa il centro, se l'agente è spento).
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
          continue; // conversazione di prenotazione in corso: l'assistente non si intromette
        }

        // Assistente AI: risponde alle domande. Ultimo anello, così prenotazione
        // e promemoria hanno sempre la precedenza.
        const assistant = await handleAssistantMessage({ phone, text, contactName });
        if (!assistant.handled && assistant.reason) {
          console.log(`[wa-webhook] ${phone}: assistente non ha risposto (${assistant.reason})`);
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
