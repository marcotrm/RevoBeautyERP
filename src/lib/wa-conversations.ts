/**
 * Archivio conversazioni WhatsApp: entrata E uscita, nello stesso posto.
 *
 * Serve perché dopo la migrazione del numero su WABA il telefono del centro non
 * apre più quelle chat: il gestionale è l'unica finestra sulle conversazioni.
 * Senza questo archivio si vedrebbero solo le domande dei clienti e non le
 * risposte che l'assistente o il bot mandano da soli.
 *
 * Ogni riga è un AdminEntry di kind `wa_msg`. Le vecchie righe `wa_inbox`
 * (solo entrata) vengono lette lo stesso, così lo storico non si perde.
 *
 * Nota sul volume: `admin_entries` è indicizzato per `kind`, non per `entityId`.
 * Le letture filtrano per kind e poi raggruppano in memoria: ai numeri di un
 * centro estetico va bene, ma è il motivo dei tetti (`take`) qui sotto.
 */

import { prisma } from '@/lib/prisma';

const MSG_KIND = 'wa_msg';
const LEGACY_INBOX_KIND = 'wa_inbox';
const WINDOW_KIND = 'wa_window';

/** Chi ha scritto il messaggio in uscita. */
export type WaSource = 'assistant' | 'booking' | 'automation' | 'manual' | 'system';

export interface WaMessageRow {
  phone: string;
  direction: 'in' | 'out';
  text: string;
  /** Solo per i messaggi in uscita. */
  source?: WaSource;
  name?: string;
  at: string;
  messageId?: string;
  /** Solo in uscita: se l'invio a 360dialog è andato a buon fine. */
  ok?: boolean;
  error?: string;
}

/** La finestra di servizio Meta: testo libero solo entro 24h dall'ultimo messaggio del cliente. */
export const WINDOW_HOURS = 24;

export interface WaConversation {
  phone: string;
  name?: string;
  lastText: string;
  lastAt: string;
  lastDirection: 'in' | 'out';
  /** Vero se possiamo ancora rispondere a testo libero (finestra 24h aperta). */
  windowOpen: boolean;
  /** Scadenza della finestra 24h, se aperta. */
  windowExpiresAt?: string;
  /** Messaggi del cliente arrivati dopo l'ultima lettura in gestionale. */
  unread: number;
}

// ============================================================
// Scrittura
// ============================================================

/**
 * `upsert` invece di `create`: 360dialog può riconsegnare lo stesso webhook più
 * volte, e con un rowId deterministico il doppione sovrascrive invece di
 * duplicare la riga in chat.
 */
async function put(rowId: string, data: WaMessageRow): Promise<void> {
  await prisma.adminEntry.upsert({
    where: { rowId },
    update: { data: data as unknown as object },
    create: { rowId, kind: MSG_KIND, entityId: data.phone, data: data as unknown as object, createdAt: data.at },
  });
}

/** Registra un messaggio ricevuto da un cliente. */
export async function logInbound(params: {
  phone: string;
  text: string;
  name?: string;
  messageId?: string;
  at?: string;
}): Promise<void> {
  const at = params.at || new Date().toISOString();
  const id = params.messageId || `${params.phone}:${at}`;
  await put(`wa:msg:in:${id}`, {
    phone: params.phone,
    direction: 'in',
    text: params.text,
    name: params.name,
    at,
    messageId: params.messageId,
  });
}

/**
 * Registra un messaggio partito dal centro, chiunque l'abbia scritto.
 * Non lancia mai: un errore d'archivio non deve impedire l'invio vero.
 */
export async function logOutbound(params: {
  phone: string;
  text: string;
  source: WaSource;
  messageId?: string;
  ok: boolean;
  error?: string;
}): Promise<void> {
  try {
    const at = new Date().toISOString();
    // Senza messageId (invio fallito) serve comunque una chiave unica, altrimenti
    // due errori di fila sullo stesso numero si sovrascriverebbero a vicenda.
    const id = params.messageId || `${params.phone}:${at}:${Math.random().toString(36).slice(2, 8)}`;
    await put(`wa:msg:out:${id}`, {
      phone: params.phone,
      direction: 'out',
      text: params.text,
      source: params.source,
      at,
      messageId: params.messageId,
      ok: params.ok,
      error: params.error,
    });
  } catch (err) {
    console.error('[wa-conversations] log uscita fallito', err);
  }
}

// ============================================================
// Lettura
// ============================================================

function rowToMessage(rowId: string, data: Record<string, unknown>, createdAt: string, legacy: boolean): WaMessageRow {
  if (legacy) {
    return {
      phone: String(data.phone || ''),
      direction: 'in',
      text: String(data.text || ''),
      name: data.name ? String(data.name) : undefined,
      at: String(data.receivedAt || createdAt),
    };
  }
  return {
    phone: String(data.phone || ''),
    direction: rowId.startsWith('wa:msg:out:') ? 'out' : 'in',
    text: String(data.text || ''),
    source: data.source as WaSource | undefined,
    name: data.name ? String(data.name) : undefined,
    at: String(data.at || createdAt),
    messageId: data.messageId ? String(data.messageId) : undefined,
    ok: typeof data.ok === 'boolean' ? data.ok : undefined,
    error: data.error ? String(data.error) : undefined,
  };
}

/** Tutti i messaggi recenti, nuovo formato + storico `wa_inbox`, dal più recente. */
async function recentMessages(limit: number): Promise<WaMessageRow[]> {
  const [fresh, legacy] = await Promise.all([
    prisma.adminEntry.findMany({ where: { kind: MSG_KIND }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.adminEntry.findMany({ where: { kind: LEGACY_INBOX_KIND }, orderBy: { createdAt: 'desc' }, take: limit }),
  ]);

  const all = [
    ...fresh.map(r => rowToMessage(r.rowId, (r.data || {}) as Record<string, unknown>, r.createdAt, false)),
    ...legacy.map(r => rowToMessage(r.rowId, (r.data || {}) as Record<string, unknown>, r.createdAt, true)),
  ].filter(m => m.phone);

  return all.sort((a, b) => b.at.localeCompare(a.at));
}

/** Momento dell'ultimo messaggio del cliente, per sapere se la finestra 24h è aperta. */
async function lastInboundMap(): Promise<Map<string, string>> {
  const rows = await prisma.adminEntry.findMany({ where: { kind: WINDOW_KIND }, take: 500 });
  const map = new Map<string, string>();
  for (const r of rows) {
    const d = (r.data || {}) as { phone?: string; lastInboundAt?: string };
    if (d.phone && d.lastInboundAt) map.set(d.phone, d.lastInboundAt);
  }
  return map;
}

function windowState(lastInboundAt: string | undefined): { open: boolean; expiresAt?: string } {
  if (!lastInboundAt) return { open: false };
  const expires = new Date(new Date(lastInboundAt).getTime() + WINDOW_HOURS * 3600 * 1000);
  return { open: expires.getTime() > Date.now(), expiresAt: expires.toISOString() };
}

const READ_ROW = (phone: string) => `wa:read:${phone}`;

/** Fino a quando ogni conversazione è stata letta in gestionale. */
async function readMarks(): Promise<Map<string, string>> {
  const rows = await prisma.adminEntry.findMany({ where: { kind: 'wa_read' }, take: 500 });
  const map = new Map<string, string>();
  for (const r of rows) {
    const d = (r.data || {}) as { phone?: string; readAt?: string };
    if (d.phone && d.readAt) map.set(d.phone, d.readAt);
  }
  return map;
}

/** Segna come letta una conversazione (azzera il contatore dei non letti). */
export async function markConversationRead(phone: string): Promise<void> {
  const now = new Date().toISOString();
  await prisma.adminEntry.upsert({
    where: { rowId: READ_ROW(phone) },
    update: { data: { phone, readAt: now } },
    create: { rowId: READ_ROW(phone), kind: 'wa_read', entityId: phone, data: { phone, readAt: now }, createdAt: now },
  });
}

/** Elenco conversazioni, la più recente in cima. */
export async function listConversations(limit = 50): Promise<WaConversation[]> {
  const [messages, windows, reads] = await Promise.all([recentMessages(600), lastInboundMap(), readMarks()]);

  const byPhone = new Map<string, WaMessageRow[]>();
  for (const m of messages) {
    const list = byPhone.get(m.phone);
    if (list) list.push(m);
    else byPhone.set(m.phone, [m]);
  }

  const conversations: WaConversation[] = [];
  for (const [phone, msgs] of byPhone) {
    const last = msgs[0]; // recentMessages ordina già dal più recente
    const readAt = reads.get(phone);
    const win = windowState(windows.get(phone));
    conversations.push({
      phone,
      // Il nome profilo arriva solo con i messaggi in entrata.
      name: msgs.find(m => m.name)?.name,
      lastText: last.text,
      lastAt: last.at,
      lastDirection: last.direction,
      windowOpen: win.open,
      windowExpiresAt: win.expiresAt,
      unread: msgs.filter(m => m.direction === 'in' && (!readAt || m.at > readAt)).length,
    });
  }

  return conversations.sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, limit);
}

/** Thread completo di un numero, dal più vecchio al più recente (ordine di lettura). */
export async function listMessages(phone: string, limit = 200): Promise<WaMessageRow[]> {
  const messages = await recentMessages(600);
  return messages
    .filter(m => m.phone === phone)
    .slice(0, limit)
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Stato della finestra 24h per un singolo numero. */
export async function conversationWindow(phone: string): Promise<{ open: boolean; expiresAt?: string }> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: `wa:window:${phone}` } });
  const d = (row?.data || {}) as { lastInboundAt?: string };
  return windowState(d.lastInboundAt);
}
