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
import { normalizePhone } from '@/lib/whatsapp';

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
  /**
   * Solo in uscita, e solo se il messaggio è partito come template approvato.
   *
   * Senza questo, in chat un template si vedeva identico a un messaggio scritto
   * a mano: solo il corpo, senza traccia dei bottoni. Per la richiesta
   * recensione — dove il link vive unicamente nel bottone — voleva dire
   * rileggere l'archivio e concludere che il link non fosse mai partito.
   */
  template?: {
    /** Nome tecnico approvato su Meta, es. `richiesta_recensione`. */
    name: string;
    /** Bottoni allegati al messaggio, in forma leggibile. */
    buttons?: string[];
  };
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

/**
 * L'ultimo messaggio deve essere sempre il nostro.
 *
 * Prima una chat usciva dai "da leggere" appena la si apriva: bastava dare
 * un'occhiata e spariva dall'elenco, anche senza aver risposto una parola. Le
 * conversazioni finivano così — la cliente scrive "grazie mille, ti faccio
 * sapere", qualcuno legge, nessuno chiude, e a schermo non resta traccia che
 * quella persona è rimasta senza una risposta.
 *
 * Ora conta una cosa sola: chi ha parlato per ultimo. Se è la cliente e sono
 * passati più di questi minuti, la conversazione torna in cima come DA
 * RISPONDERE, e ci resta finché non le scriviamo davvero.
 *
 * I dieci minuti sono il margine per chi è in cabina con le mani occupate:
 * sotto quella soglia non è un buco, è normale lavoro.
 */
export const ATTESA_RISPOSTA_MIN = 10;

/**
 * Per quanto vale «Ho letto».
 *
 * Serve a chi ha richiamato la cliente al telefono o a chi ha ricevuto un
 * messaggio che non chiedeva niente: casi veri, e il tasto deve restare.
 *
 * Ma e' anche il modo piu' facile per far sparire un'etichetta rossa senza
 * fare niente, e succede — Vincenzo Ferro ha scritto tre volte alle 16:13
 * chiedendo aiuto col documento, alle 16:51 qualcuno ha premuto «Ho letto» e
 * la chat e' uscita dall'elenco senza che nessuno gli avesse risposto.
 *
 * Quindi «Ho letto» adesso mette in pausa, non chiude: se dopo due ore non
 * gli abbiamo ancora scritto niente, la conversazione torna in cima. Chi ha
 * davvero risolto al telefono non se ne accorge mai, perche' nel frattempo
 * quasi sempre un messaggio parte lo stesso.
 */
export const GESTITA_VALE_MIN = 120;

/**
 * Il "cuoricino" su un nostro messaggio non è una domanda.
 *
 * WhatsApp manda le reazioni come messaggi in entrata, e il gestionale le
 * archivia con questa dicitura (vedi `messageText` nel webhook). Pretendere di
 * rispondere a un 👍 vorrebbe dire tenere chat segnalate per sempre e
 * insegnare a ignorare l'avviso.
 */
function eReazione(m: WaMessageRow): boolean {
  return m.direction === 'in' && /\(reazione a un messaggio\)\s*$/.test(m.text || '');
}

/**
 * "Confermo" chiude il discorso, non lo apre.
 *
 * È la risposta al nostro promemoria: l'appuntamento passa a confermato da
 * solo e non c'è niente da dire. Tenerla fra le cose da rispondere riempirebbe
 * l'elenco di chat in cui l'unica replica possibile è "ok" — e un elenco pieno
 * di roba inutile è un elenco che si smette di guardare.
 *
 * Vale solo se il messaggio è TUTTO lì: "Confermo, ma posso spostare alle 17?"
 * è una domanda vera e resta da rispondere. Un "grazie" invece va risposto —
 * è una cortesia, e l'ultima parola deve restare nostra.
 *
 * Le parole sono le stesse che riconosce `detectReminderIntent` in
 * lib/wa-appointments: se una cambia lì, va cambiata anche qui.
 */
function eConfermaSecca(m: WaMessageRow): boolean {
  if (m.direction !== 'in') return false;
  const t = (m.text || '').trim();
  return /^(s[ìi]|ok|okay|va bene|confermo|confermato|conferma|confermata|perfetto|ci sono|presente|d'accordo|certo)[\s.,!👍✅😊🙂❤️💜]*$/i.test(t)
    || /^[👍✅👌🙏❤️💜]+$/u.test(t);
}

/** Minuti trascorsi da un istante ISO. */
function minutiDa(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

export interface WaConversation {
  phone: string;
  name?: string;
  /** Foto della scheda cliente, se caricata: la faccia si riconosce prima del nome. */
  avatar?: string;
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
  /** Messaggi della cliente rimasti senza una nostra risposta dopo di loro. */
  senzaRisposta: number;
  /** Il primo di quei messaggi: da lì si conta da quanto sta aspettando. */
  senzaRispostaDa?: string;
  /** Minuti di attesa, se c'è qualcosa a cui rispondere. */
  attesaMinuti?: number;
  /** Vero oltre i 15 minuti: è la chat che deve tornare in cima. */
  daRispondere: boolean;
  /**
   * Vero quando aspetta da oltre 15 minuti MA la finestra 24h è chiusa.
   *
   * Sono le conversazioni lasciate cadere: si vedono, perché sapere che è
   * successo serve, ma non entrano nel conteggio urgente — a testo libero
   * WhatsApp non ci fa più scrivere, e chiedere di rispondere sarebbe chiedere
   * una cosa impossibile.
   */
  rispostaScaduta: boolean;
}

/** Riassunto dei non letti per l'avviso in tutto il gestionale. */
export interface WaUnreadChat {
  phone: string;
  name?: string;
  unread: number;
  /**
   * Vero se aspetta una risposta da più di 15 minuti.
   *
   * È la differenza fra "è arrivato un messaggio" e "qualcuno sta aspettando":
   * il numerino sul menu si accende subito col primo, il lampeggio solo col
   * secondo. Sono due informazioni diverse e servivano tutte e due — averle
   * fuse in una sola aveva tolto il numerino dei messaggi appena arrivati.
   */
  daRispondere: boolean;
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
  /** Presente solo se è partito come template approvato, non come testo libero. */
  template?: WaMessageRow['template'];
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
      template: params.template,
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

/**
 * Quanti messaggi si guardano per costruire l'elenco delle chat.
 *
 * Erano 600, e con qualche migliaio di messaggi in archivio le conversazioni
 * più vecchie sparivano dall'elenco: non erano cancellate, semplicemente
 * restavano fuori dalla finestra. Adesso la finestra tiene dentro tutto lo
 * storico (oggi sono circa millecinquecento messaggi) con parecchio margine.
 */
const FINESTRA_ELENCO = 6000;

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

/** Quel poco che serve in chat per riconoscere chi scrive. */
export interface SchedaInChat {
  nome: string;
  /**
   * La foto della SCHEDA CLIENTE, non quella del profilo WhatsApp: l'API di
   * Meta (Cloud API, quella che usa 360dialog) non dà la foto profilo di chi
   * ci scrive. Si carica dalla scheda cliente in anagrafica.
   */
  avatar?: string;
}

/** Nome, cognome e foto dei clienti in anagrafica, indicizzati sul numero. */
export async function clientNamesByPhone(): Promise<Map<string, SchedaInChat>> {
  const clients = await prisma.client.findMany({
    select: { firstName: true, lastName: true, phone: true, avatar: true },
  });
  const map = new Map<string, SchedaInChat>();
  for (const c of clients) {
    const key = phoneKey(c.phone);
    const full = `${c.firstName} ${c.lastName}`.trim();
    // Primo arrivato, primo servito: se due schede hanno lo stesso numero
    // (doppioni in anagrafica) meglio un nome stabile che uno a caso.
    if (key && full && !map.has(key)) map.set(key, { nome: full, avatar: c.avatar || undefined });
  }
  return map;
}

/** La scheda del cliente in anagrafica per un singolo numero, se c'è. */
export async function clientNameForPhone(phone: string): Promise<SchedaInChat | undefined> {
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

const GESTITA_ROW = (phone: string) => `wa:gestita:${phone}`;

/**
 * "Ho letto": la chiudo io, senza rispondere qui.
 *
 * La regola dell'ultimo messaggio nostro è giusta, ma non copre tutto: a volte
 * la cliente la si è richiamata al telefono, a volte il messaggio non chiede
 * niente. Senza una via d'uscita quella chat resterebbe rossa per sempre, e
 * una lista che segna cose già sistemate smette di essere creduta.
 *
 * Non è un "letto" qualunque: vale fino a QUEL momento. Se dopo arriva un
 * altro messaggio, la conversazione torna da rispondere — che è esattamente
 * quello che deve succedere.
 */
export async function segnaGestita(phone: string): Promise<void> {
  const now = new Date().toISOString();
  await prisma.adminEntry.upsert({
    where: { rowId: GESTITA_ROW(phone) },
    update: { data: { phone, gestitaAl: now } },
    create: { rowId: GESTITA_ROW(phone), kind: 'wa_gestita', entityId: phone, data: { phone, gestitaAl: now }, createdAt: now },
  });
}

async function gestiteMarks(): Promise<Map<string, string>> {
  const rows = await prisma.adminEntry.findMany({ where: { kind: 'wa_gestita' }, take: 500 });
  const map = new Map<string, string>();
  for (const r of rows) {
    const d = (r.data || {}) as { phone?: string; gestitaAl?: string };
    if (d.phone && d.gestitaAl) map.set(d.phone, d.gestitaAl);
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
/**
 * Cancella una conversazione dall'archivio del gestionale.
 *
 * Serve per la roba che non è una cliente: numeri sbagliati, spam, prove. Se
 * restano in elenco si portano dietro il segno DA RISPONDERE e riempiono di
 * rumore l'unica lista che deve restare pulita — e una lista sporca è una
 * lista che si smette di guardare.
 *
 * Cosa sparisce: i messaggi archiviati qui, il segno di lettura, la finestra
 * 24h e le eventuali conversazioni aperte dai bot. Cosa NON sparisce: la chat
 * sul telefono della persona, che è roba di WhatsApp e non nostra, e la scheda
 * cliente se esiste. Non si torna indietro.
 */
export async function cancellaConversazione(phone: string): Promise<{ eliminati: number }> {
  const tel = normalizePhone(phone);
  if (!tel) return { eliminati: 0 };

  const messaggi = await prisma.adminEntry.deleteMany({
    where: { kind: { in: [MSG_KIND, LEGACY_INBOX_KIND] }, entityId: tel },
  });
  await prisma.adminEntry.deleteMany({
    where: {
      OR: [
        { rowId: READ_ROW(tel) },
        { rowId: GESTITA_ROW(tel) },
        { rowId: `wa:window:${tel}` },
        { rowId: `wa:booking:${tel}` },
        { rowId: `wa:spostamento:${tel}` },
        { rowId: `wa:assistant:${tel}` },
        // Anche la memoria della segretaria: dentro ci sono le ultime battute
        // e l'eventuale pausa per il passaggio a una persona. Lasciarla
        // indietro vuol dire cancellare la chat e ritrovarsi il bot che
        // riprende da dove aveva lasciato, o che continua a tacere.
        { rowId: `wa:segretaria:${tel}` },
      ],
    },
  });
  return { eliminati: messaggi.count };
}

export async function markConversationUnread(phone: string): Promise<void> {
  await prisma.adminEntry.deleteMany({ where: { rowId: READ_ROW(phone) } });
}

/** Elenco conversazioni, la più recente in cima. */
/**
 * Numeri che ci hanno scritto almeno una volta.
 *
 * Serve alle campagne di sollecito: chi ha risposto al primo messaggio non va
 * ricontattato con lo stesso template — o gli si ripete addosso una cosa a cui
 * ha già reagito.
 */
export async function phonesWithInbound(): Promise<Set<string>> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: MSG_KIND, rowId: { startsWith: 'wa:msg:in:' } },
    select: { entityId: true, data: true },
  });
  const numeri = new Set<string>();
  for (const r of righe) {
    const tel = (r.data as { phone?: string } | null)?.phone || r.entityId || '';
    if (tel) numeri.add(normalizePhone(tel));
  }
  return numeri;
}

export async function listConversations(limit = 300): Promise<WaConversation[]> {
  const [messages, windows, reads, clientNames, gestite] = await Promise.all([
    recentMessages(FINESTRA_ELENCO), lastInboundMap(), readMarks(), clientNamesByPhone(), gestiteMarks(),
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

    /*
      Da dove parte l'attesa: si risale dal più recente e ci si ferma al primo
      messaggio nostro. Tutto quello che sta sopra è rimasto senza risposta, e
      l'attesa si conta dal più vecchio del gruppo — se la cliente ha scritto
      tre volte in mezz'ora, aspetta da mezz'ora, non dall'ultimo messaggio.
    */
    let senzaRisposta = 0;
    let primoSenzaRisposta: string | undefined;
    let ultimoSenzaRisposta: string | undefined;
    for (const m of msgs) {
      if (m.direction === 'out') break;
      if (eReazione(m) || eConfermaSecca(m)) continue;
      senzaRisposta++;
      // `msgs` va dal più recente al più vecchio: il primo che si incontra è
      // l'ultimo scritto, l'ultimo che si incontra è quello da cui aspetta.
      if (!ultimoSenzaRisposta) ultimoSenzaRisposta = m.at;
      primoSenzaRisposta = m.at;
    }
    const attesaMinuti = primoSenzaRisposta ? minutiDa(primoSenzaRisposta) : undefined;
    // Se qualcuno ha premuto "Ho letto" DOPO l'ultimo messaggio rimasto senza
    // risposta, quella conversazione è sistemata: torna in lista solo se la
    // cliente scrive di nuovo.
    /*
      Il confronto è con l'ULTIMO messaggio della cliente, non col primo.

      Col primo bastava un "Ho letto" per zittire anche tutto quello che
      sarebbe arrivato dopo: lei riscriveva e la chat restava sistemata,
      perché il messaggio da cui si contava l'attesa era comunque più vecchio
      del segno. Provato e visto: è il modo esatto in cui si perde una cliente
      convinti di avere la lista in ordine.
    */
    const gestitaAl = gestite.get(phone);
    const giaGestita = Boolean(
      gestitaAl && ultimoSenzaRisposta && gestitaAl >= ultimoSenzaRisposta
      // …ma non per sempre: vedi GESTITA_VALE_MIN.
      && minutiDa(gestitaAl) < GESTITA_VALE_MIN,
    );
    const inAttesa = senzaRisposta > 0 && (attesaMinuti ?? 0) >= ATTESA_RISPOSTA_MIN && !giaGestita;

    conversations.push({
      phone,
      // Prima il nome in anagrafica: dice davvero a chi appartiene il numero.
      // In mancanza si ripiega sul nome profilo WhatsApp, che arriva solo con i
      // messaggi in entrata e spesso è un soprannome con emoji.
      name: clientNames.get(phoneKey(phone))?.nome || msgs.find(m => m.name)?.name,
      avatar: clientNames.get(phoneKey(phone))?.avatar,
      lastText: last.text,
      lastMedia: last.media,
      lastAt: last.at,
      lastDirection: last.direction,
      windowOpen: win.open,
      windowExpiresAt: win.expiresAt,
      /*
        Aprire la chat non basta piu' a farla sembrare sistemata.

        Bastava entrare e uscire perche' il pallino verde sparisse: da fuori
        quella conversazione era identica a una a cui avevamo risposto, e
        nessuno tornava a guardarla. Adesso, se la cliente ha parlato per
        ultima e sono passati dieci minuti, la chat si rimette da sola come
        NON LETTA — col numero dei suoi messaggi rimasti in sospeso — e ci
        resta finche' non le scriviamo davvero.
      */
      unread: inAttesa ? Math.max(unreadMsgs.length, senzaRisposta) : unreadMsgs.length,
      // `msgs` è ordinato dal più recente: l'ultimo non letto è il più vecchio.
      oldestUnreadAt: unreadMsgs.length ? unreadMsgs[unreadMsgs.length - 1].at : undefined,
      senzaRisposta,
      senzaRispostaDa: primoSenzaRisposta,
      attesaMinuti,
      daRispondere: inAttesa && win.open,
      rispostaScaduta: inAttesa && !win.open,
    });
  }

  // Le chat DA LEGGERE stanno sempre in cima (e non vengono mai tagliate dal
  // limite): con l'ordinamento solo per orario, le conversazioni già risposte
  // più recenti seppellivano quelle in attesa e il pallino diceva "4" senza
  // che si capisse quali fossero.
  /*
    Ordine: prima chi aspetta una risposta, e fra loro chi aspetta da più
    tempo. Poi i messaggi nuovi non ancora letti, poi il resto per orario.
    Chi aspetta da un'ora deve stare sopra a chi ha appena scritto, altrimenti
    l'elenco premia le chat fresche e seppellisce proprio quelle in ritardo.
  */
  return conversations
    .sort((a, b) => {
      if (a.daRispondere !== b.daRispondere) return a.daRispondere ? -1 : 1;
      if (a.daRispondere && b.daRispondere) {
        return (a.senzaRispostaDa || '').localeCompare(b.senzaRispostaDa || '');
      }
      const aNuovi = a.unread > 0 ? 1 : 0;
      const bNuovi = b.unread > 0 ? 1 : 0;
      if (aNuovi !== bNuovi) return bNuovi - aNuovi;
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
  /*
    Qui non contano più i messaggi "non letti" ma quelli SENZA RISPOSTA: è la
    stessa cosa che dice l'avviso ("3 messaggi senza risposta") e finalmente è
    vera. Prima bastava aprire la chat per far sparire il numero, e il numero
    diceva quante chat erano state guardate, non quante persone stavano ancora
    aspettando.
  */
  return conversations
    /*
      Due motivi per comparire qui, e non vanno confusi:

       - `unread`: è arrivato qualcosa che non abbiamo ancora aperto. È il
         numerino sul menu, e deve accendersi SUBITO — serve a sapere che c'è
         posta, non che qualcuno è in attesa;
       - `daRispondere`: sono passati più di quindici minuti e la risposta non
         c'è. È il lampeggio e l'avviso a schermo.

      Averli fusi in uno solo aveva tolto il numerino dei messaggi appena
      arrivati: la chat compariva solo dopo un quarto d'ora, e nel frattempo
      sembrava che non fosse arrivato niente.
    */
    .filter(c => c.unread > 0 || c.daRispondere)
    .map(c => ({
      phone: c.phone, name: c.name,
      unread: Math.max(c.unread, c.senzaRisposta),
      daRispondere: c.daRispondere,
      lastText: c.lastText,
      oldestUnreadAt: c.senzaRispostaDa || c.oldestUnreadAt || c.lastAt,
    }))
    .sort((a, b) => a.oldestUnreadAt.localeCompare(b.oldestUnreadAt));
}

/**
 * Thread completo di un numero, dal più vecchio al più recente.
 *
 * Si chiede al database solo questo numero (le righe hanno il telefono in
 * `entityId`): prima si rileggevano gli ultimi 600 messaggi di tutti e si
 * filtrava, così una chat vecchia si apriva vuota anche se i messaggi
 * c'erano ancora.
 */
export async function listMessages(phone: string, limit = 500): Promise<WaMessageRow[]> {
  const [fresh, legacy] = await Promise.all([
    prisma.adminEntry.findMany({
      where: { kind: MSG_KIND, entityId: phone },
      orderBy: { createdAt: 'desc' }, take: limit,
    }),
    prisma.adminEntry.findMany({
      where: { kind: LEGACY_INBOX_KIND, entityId: phone },
      orderBy: { createdAt: 'desc' }, take: limit,
    }),
  ]);

  const thread = [
    ...fresh.map(r => rowToMessage(r.rowId, (r.data || {}) as Record<string, unknown>, r.createdAt, false)),
    ...legacy.map(r => rowToMessage(r.rowId, (r.data || {}) as Record<string, unknown>, r.createdAt, true)),
  ]
    .filter(m => m.phone === phone)
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
