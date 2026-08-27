/**
 * Un messaggio alla volta, uno solo, e mai due uguali.
 *
 * È la parte noiosa che decide se un bot su WhatsApp è utile o insopportabile.
 * I modi di sbagliare sono quattro, e non sono ipotesi: succedono tutti.
 *
 *  1. **La cliente scrive a raffica.** «ciao», «volevo prenotare», «per
 *     giovedì»: tre messaggi in sei secondi, tre webhook, tre risposte. La
 *     terza risponde alla terza riga come se le prime due non ci fossero.
 *     Rimedio: si aspetta qualche secondo di silenzio e si risponde una volta
 *     sola, avendo letto tutto.
 *
 *  2. **Meta riconsegna.** Se il webhook non risponde 200 abbastanza in
 *     fretta, Meta rimanda lo stesso messaggio. Senza memoria di quello che
 *     abbiamo già letto, la cliente riceve la stessa risposta due volte.
 *     Rimedio: gli id già visti.
 *
 *  3. **Due turni insieme.** Due webhook che arrivano nello stesso istante
 *     fanno partire due conversazioni parallele sullo stesso numero, che si
 *     rispondono a vicenda senza sapere l'una dell'altra.
 *     Rimedio: un fermo per numero, preso in modo atomico.
 *
 *  4. **L'automazione che si accavalla.** Il promemoria delle 18 che atterra
 *     dentro una conversazione già aperta, subito dopo una risposta della
 *     segretaria. Rimedio: prima di mandare un messaggio automatico si guarda
 *     da quanto tempo è partito l'ultimo.
 *
 * Niente di tutto questo si risolve nelle istruzioni del modello. Un modello a
 * cui si scrive «non mandare due messaggi» ne manda due lo stesso, perché il
 * secondo messaggio non lo decide lui: lo decide l'infrastruttura che lo
 * chiama due volte.
 */

import { prisma } from './prisma';
import { sendWhatsApp } from './whatsapp';
import type { WaSource } from './wa-conversations';

const FLUSSO_KIND = 'wa_flusso';
const TURNO_KIND = 'wa_turno';
const MSG_KIND = 'wa_msg';

/**
 * Quanti secondi di silenzio si aspettano prima di rispondere.
 *
 * Sette secondi sono la distanza fra "sta ancora scrivendo" e "aspetta una
 * risposta". Più corti e si risponde a metà frase; più lunghi e sembra che non
 * ci sia nessuno.
 */
export const ATTESA_SILENZIO_MS = 7_000;

/** Oltre questo, un fermo è di un turno morto (processo riavviato, errore non gestito). */
const TTL_TURNO_MS = 120_000;

/** Quanti id di messaggi tenere a mente per numero. */
const VISTI_MAX = 30;

interface StatoFlusso {
  phone: string;
  /** Messaggi già elaborati: contro le riconsegne. */
  visti: string[];
  /** L'ultimo arrivato. Chi non è più l'ultimo non risponde. */
  ultimoId: string;
  ultimoAt: string;
}

const rigaFlusso = (phone: string) => `wa:flusso:${phone}`;
const rigaTurno = (phone: string) => `wa:turno:${phone}`;

async function leggiFlusso(phone: string): Promise<StatoFlusso> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: rigaFlusso(phone) } });
  const s = row?.data as unknown as StatoFlusso | undefined;
  return { phone, visti: s?.visti || [], ultimoId: s?.ultimoId || '', ultimoAt: s?.ultimoAt || '' };
}

async function scriviFlusso(s: StatoFlusso): Promise<void> {
  const data = { ...s, visti: s.visti.slice(-VISTI_MAX) } as unknown as object;
  await prisma.adminEntry.upsert({
    where: { rowId: rigaFlusso(s.phone) },
    update: { data },
    create: {
      rowId: rigaFlusso(s.phone), kind: FLUSSO_KIND, entityId: s.phone,
      data, createdAt: new Date().toISOString(),
    },
  });
}

// ============================================================
// 1 e 2 — arrivo, riconsegne, raffica
// ============================================================

/**
 * Registra il messaggio appena arrivato.
 *
 * Torna `false` se l'avevamo già elaborato: è una riconsegna di Meta e va
 * lasciata cadere senza rispondere.
 *
 * (La lettura e la scrittura non sono atomiche: due riconsegne nello stesso
 * millesimo di secondo possono passare entrambe. A fermarle c'è il turno, che
 * invece atomico lo è.)
 */
export async function registraArrivo(phone: string, messageId?: string): Promise<boolean> {
  const id = messageId || `${phone}:${Date.now()}`;
  const s = await leggiFlusso(phone);
  if (s.visti.includes(id)) return false;

  await scriviFlusso({
    ...s,
    visti: [...s.visti, id],
    ultimoId: id,
    ultimoAt: new Date().toISOString(),
  });
  return true;
}

const dormi = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Aspetta che la cliente abbia finito di scrivere.
 *
 * Torna `false` se nel frattempo è arrivato un altro messaggio: quel turno lo
 * gestirà chi ha ricevuto l'ultimo, che a quel punto ha davanti tutta la
 * raffica e può rispondere una volta sola.
 */
export async function attendiSilenzio(
  phone: string,
  messageId: string | undefined,
  ms: number = ATTESA_SILENZIO_MS
): Promise<boolean> {
  if (!messageId) return true;
  await dormi(ms);
  const s = await leggiFlusso(phone);
  return s.ultimoId === messageId;
}

// ============================================================
// 3 — un turno alla volta
// ============================================================

/**
 * Prende il fermo per questo numero.
 *
 * L'atomicità è quella della chiave primaria: due `create` sullo stesso
 * `rowId` non possono riuscire entrambi, uno dei due riceve un errore di
 * unicità dal database. È il motivo per cui qui non si legge prima di
 * scrivere: leggere e poi scrivere è esattamente la corsa che stiamo evitando.
 */
export async function prendiTurno(phone: string): Promise<boolean> {
  const adesso = new Date().toISOString();
  try {
    await prisma.adminEntry.create({
      data: { rowId: rigaTurno(phone), kind: TURNO_KIND, entityId: phone, data: { presoIl: adesso }, createdAt: adesso },
    });
    return true;
  } catch {
    // C'è già un fermo. Se è vecchio è di un turno morto e si può scavalcare.
    const row = await prisma.adminEntry.findUnique({ where: { rowId: rigaTurno(phone) } });
    if (!row) return false;
    const preso = (row.data as { presoIl?: string })?.presoIl || row.createdAt;
    if (Date.now() - new Date(preso).getTime() < TTL_TURNO_MS) return false;

    await prisma.adminEntry.update({ where: { rowId: rigaTurno(phone) }, data: { data: { presoIl: adesso } } })
      .catch(() => {});
    return true;
  }
}

export async function rilasciaTurno(phone: string): Promise<void> {
  await prisma.adminEntry.delete({ where: { rowId: rigaTurno(phone) } }).catch(() => {});
}

// ============================================================
// 4 — non accavallare
// ============================================================

interface UltimoInvio { at: string; text: string }

/** L'ultimo messaggio partito dal centro verso questo numero, dall'archivio chat. */
export async function ultimoInvioA(phone: string): Promise<UltimoInvio | null> {
  const row = await prisma.adminEntry.findFirst({
    where: {
      kind: MSG_KIND,
      rowId: { startsWith: 'wa:msg:out:' },
      data: { path: ['phone'], equals: phone },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, data: true },
  }).catch(() => null);

  if (!row) return null;
  const d = (row.data || {}) as { at?: string; text?: string };
  return { at: d.at || row.createdAt, text: d.text || '' };
}

/**
 * Vero se al centro conviene stare zitto ancora un po'.
 *
 * Da chiamare PRIMA di ogni messaggio automatico: un promemoria che atterra
 * trenta secondi dopo una risposta della segretaria è il modo più semplice di
 * far sembrare due interlocutori scoordinati un unico interlocutore confuso.
 */
export async function troppoRavvicinato(phone: string, minutiDiPausa: number): Promise<boolean> {
  const ultimo = await ultimoInvioA(phone);
  if (!ultimo) return false;
  const minuti = (Date.now() - new Date(ultimo.at).getTime()) / 60_000;
  return isFinite(minuti) && minuti < minutiDiPausa;
}

// ============================================================
// L'invio
// ============================================================

/** Quanto a lungo lo stesso identico testo non si ripete allo stesso numero. */
const NO_RIPETIZIONI_MIN = 10;

export interface EsitoInvio { inviato: boolean; motivo?: string }

/**
 * Manda UN messaggio. Uno.
 *
 * È l'unica porta da cui la segretaria scrive, e fa tre cose che nessuna
 * istruzione al modello garantisce: rifiuta il vuoto, rifiuta di ripetere
 * parola per parola quello che ha appena detto, e non spezza mai il testo in
 * più bolle. Se la risposta è lunga, arriva lunga: tre bolle di fila sono più
 * fastidiose di dieci righe.
 */
export async function rispondiUnaVolta(
  phone: string,
  testo: string,
  source: WaSource = 'assistant'
): Promise<EsitoInvio> {
  const pulito = testo.replace(/\s+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!pulito) return { inviato: false, motivo: 'niente da dire' };

  const ultimo = await ultimoInvioA(phone);
  if (ultimo && ultimo.text.trim() === pulito) {
    const minuti = (Date.now() - new Date(ultimo.at).getTime()) / 60_000;
    if (isFinite(minuti) && minuti < NO_RIPETIZIONI_MIN) {
      return { inviato: false, motivo: 'messaggio identico appena mandato' };
    }
  }

  const res = await sendWhatsApp(phone, pulito, source);
  return res.ok ? { inviato: true } : { inviato: false, motivo: res.error };
}
