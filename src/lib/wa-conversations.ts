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

/** Tipi di allegato che sappiamo mostrare in chat. */
export type WaMediaKind = 'image' | 'sticker' | 'audio' | 'video' | 'document';

/**
 * Allegato ricevuto da un cliente.
 *
 * Del binario teniamo solo l'id: il file resta su Meta e viene scaricato al
 * volo dalla rotta proxy quando l'operatrice apre la chat. Meta lo conserva
 * circa 30 giorni, quindi gli allegati molto vecchi non si aprono più — è un
 * limite della piattaforma, non un errore del gestionale.
 */
export interface WaMedia {
  kind: WaMediaKind;
  id: string;
  mimeType?: string;
  /** Nome originale del file, solo per i documenti. */
  filename?: string;
  /** Didascalia scritta dal cliente insieme all'allegato, se c'è. */
  caption?: string;
  /** Vero per i messaggi vocali (registrati sul momento), falso per un audio allegato. */
  voice?: boolean;
}

export interface WaMessageRow {
  phone: string;
  direction: 'in' | 'out';
  /** Per gli allegati è la didascalia, o un'etichetta tipo "Messaggio vocale". */
  text: string;
  /** Presente solo se il messaggio conteneva un allegato. */
  media?: WaMedia;
  /** Solo per i messaggi in uscita. */
  source?: WaSource;
  name?: string;
  at: string;
  messageId?: string;
  /** Solo in uscita: se l'invio a 360dialog è andato a buon fine. */
  ok?: boolean;
  error?: string;
  /**
   * Solo in uscita: dove è arrivato il messaggio secondo WhatsApp.
   * sent = partito, delivered = sul telefono, read = letto dalla cliente.
   */
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
}

/** La finestra di servizio Meta: testo libero solo entro 24h dall'ultimo messaggio del cliente. */
export const WINDOW_HOURS = 24;

export interface WaConversation {
  phone: string;
  name?: string;
  lastText: string;
  /** Allegato dell'ultimo messaggio, se ce n'era uno: serve all'anteprima in elenco. */
  lastMedia?: WaMedia;
  lastAt: string;
  lastDirection: 'in' | 'out';
  /** Vero se possiamo ancora rispondere a testo libero (finestra 24h aperta). */
  windowOpen: boolean;
  /** Scadenza della finestra 24h, se aperta. */
  windowExpiresAt?: string;
  /** Messaggi del cliente arrivati dopo l'ultima lettura in gestionale. */
  unread: number;
  /** Quando è arrivato il più vecchio dei messaggi non letti: da qui si conta l'attesa. */
  oldestUnreadAt?: string;
}

/** Riassunto dei non letti per l'avviso in tutto il gestionale. */
export interface WaUnreadChat {
  phone: string;
  name?: string;
  unread: number;
  lastText: string;
  /** Da quanto il cliente aspetta una risposta. */
  oldestUnreadAt: string;
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
  media?: WaMedia;
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
    media: params.media,
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
  const media = data.media as WaMedia | undefined;
  return {
    phone: String(data.phone || ''),
    direction: rowId.startsWith('wa:msg:out:') ? 'out' : 'in',
    text: String(data.text || ''),
    media: media?.id ? media : undefined,
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

/**
 * Chiave di confronto fra il numero di WhatsApp e quello in anagrafica: le
 * ultime 9 cifre. Il prefisso può esserci o no (+39, 0039, niente) e in scheda
 * cliente i numeri sono scritti in tutti i modi, spazi e trattini compresi.
 */
function phoneKey(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

/** Nome e cognome dei clienti in anagrafica, indicizzati sul numero. */
export async function clientNamesByPhone(): Promise<Map<string, string>> {
  const clients = await prisma.client.findMany({ select: { firstName: true, lastName: true, phone: true } });
  const map = new Map<string, string>();
  for (const c of clients) {
    const key = phoneKey(c.phone);
    const full = `${c.firstName} ${c.lastName}`.trim();
    // Primo arrivato, primo servito: se due schede hanno lo stesso numero
    // (doppioni in anagrafica) meglio un nome stabile che uno a caso.
    if (key && full && !map.has(key)) map.set(key, full);
  }
  return map;
}

/** Nome del cliente in anagrafica per un singolo numero, se c'è. */
export async function clientNameForPhone(phone: string): Promise<string | undefined> {
  return (await clientNamesByPhone()).get(phoneKey(phone));
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

/**
 * Rimette una conversazione fra quelle da leggere.
 *
 * Si toglie proprio il segno di lettura: i messaggi del cliente tornano tutti
 * non letti, quindi ricompaiono il pallino sul menu e l'avviso se restano
 * senza risposta. Serve quando si apre una chat di corsa e si vuole
 * ritrovarla dopo, senza affidarsi alla memoria.
 */
export async function markConversationUnread(phone: string): Promise<void> {
  await prisma.adminEntry.deleteMany({ where: { rowId: READ_ROW(phone) } });
}

/** Elenco conversazioni, la più recente in cima. */
export async function listConversations(limit = 50): Promise<WaConversation[]> {
  const [messages, windows, reads, clientNames] = await Promise.all([
    recentMessages(600), lastInboundMap(), readMarks(), clientNamesByPhone(),
  ]);

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
    const unreadMsgs = msgs.filter(m => m.direction === 'in' && (!readAt || m.at > readAt));
    conversations.push({
      phone,
      // Prima il nome in anagrafica: dice davvero a chi appartiene il numero.
      // In mancanza si ripiega sul nome profilo WhatsApp, che arriva solo con i
      // messaggi in entrata e spesso è un soprannome con emoji.
      name: clientNames.get(phoneKey(phone)) || msgs.find(m => m.name)?.name,
      lastText: last.text,
      lastMedia: last.media,
      lastAt: last.at,
      lastDirection: last.direction,
      windowOpen: win.open,
      windowExpiresAt: win.expiresAt,
      unread: unreadMsgs.length,
      // `msgs` è ordinato dal più recente: l'ultimo non letto è il più vecchio.
      oldestUnreadAt: unreadMsgs.length ? unreadMsgs[unreadMsgs.length - 1].at : undefined,
    });
  }

  // Le chat DA LEGGERE stanno sempre in cima (e non vengono mai tagliate dal
  // limite): con l'ordinamento solo per orario, le conversazioni già risposte
  // più recenti seppellivano quelle in attesa e il pallino diceva "4" senza
  // che si capisse quali fossero.
  return conversations
    .sort((a, b) => {
      const aDaLeggere = a.unread > 0 ? 1 : 0;
      const bDaLeggere = b.unread > 0 ? 1 : 0;
      if (aDaLeggere !== bDaLeggere) return bDaLeggere - aDaLeggere;
      return b.lastAt.localeCompare(a.lastAt);
    })
    .slice(0, limit);
}

/**
 * Solo le chat con messaggi del cliente ancora da leggere, dalla più vecchia
 * in attesa. Serve all'avviso sempre attivo nel gestionale: chiede poco al DB
 * rispetto al thread completo e può girare in polling su ogni pagina.
 */
export async function listUnreadChats(): Promise<WaUnreadChat[]> {
  const conversations = await listConversations(100);
  return conversations
    .filter((c): c is WaConversation & { oldestUnreadAt: string } => c.unread > 0 && !!c.oldestUnreadAt)
    .map(c => ({ phone: c.phone, name: c.name, unread: c.unread, lastText: c.lastText, oldestUnreadAt: c.oldestUnreadAt }))
    .sort((a, b) => a.oldestUnreadAt.localeCompare(b.oldestUnreadAt));
}

/** Thread completo di un numero, dal più vecchio al più recente (ordine di lettura). */
export async function listMessages(phone: string, limit = 200): Promise<WaMessageRow[]> {
  const messages = await recentMessages(600);
  const thread = messages
    .filter(m => m.phone === phone)
    .slice(0, limit)
    .sort((a, b) => a.at.localeCompare(b.at));
  return withDeliveryStatus(thread);
}

/**
 * Attacca ai messaggi in uscita lo stato di consegna che WhatsApp ci ha
 * rimandato via webhook (righe `wa_status`, una per messaggio, aggiornata a ogni
 * passaggio: inviato → consegnato → letto). Senza questo in chat si vede solo
 * che il messaggio è partito, non se la cliente l'ha davvero letto.
 */
async function withDeliveryStatus(rows: WaMessageRow[]): Promise<WaMessageRow[]> {
  const ids = rows.filter(m => m.direction === 'out' && m.messageId).map(m => m.messageId as string);
  if (ids.length === 0) return rows;

  const statusRows = await prisma.adminEntry.findMany({
    where: { rowId: { in: ids.map(id => `wa:status:${id}`) } },
  });
  const byId = new Map<string, WaMessageRow['deliveryStatus']>();
  for (const r of statusRows) {
    const d = (r.data || {}) as { messageId?: string; status?: string };
    if (!d.messageId) continue;
    const s = d.status;
    if (s === 'sent' || s === 'delivered' || s === 'read' || s === 'failed') byId.set(d.messageId, s);
  }

  return rows.map(m => (m.messageId && byId.has(m.messageId) ? { ...m, deliveryStatus: byId.get(m.messageId) } : m));
}

/**
 * Vero se quell'id media compare davvero in una conversazione archiviata.
 *
 * La rotta proxy dei media la usa come lucchetto: senza, chiunque conosca
 * l'indirizzo potrebbe farsi scaricare dal gestionale qualunque allegato del
 * canale WhatsApp, anche di un altro numero.
 */
export async function mediaIsKnown(mediaId: string): Promise<boolean> {
  const rows = await prisma.adminEntry.findMany({
    where: { kind: MSG_KIND }, orderBy: { createdAt: 'desc' }, take: 600,
  });
  return rows.some(r => ((r.data || {}) as { media?: { id?: string } }).media?.id === mediaId);
}

/** Stato della finestra 24h per un singolo numero. */
export async function conversationWindow(phone: string): Promise<{ open: boolean; expiresAt?: string }> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: `wa:window:${phone}` } });
  const d = (row?.data || {}) as { lastInboundAt?: string };
  return windowState(d.lastInboundAt);
}
