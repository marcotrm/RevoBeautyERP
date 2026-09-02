/**
 * Automazioni WhatsApp: promemoria appuntamenti, recall dormienti, auguri
 * compleanno, richiesta recensioni.
 *
 * Principi:
 *  - ogni invio è tracciato in AdminEntry (kind `wa_log`) con un rowId
 *    deterministico: rilanciare l'automazione non manda doppioni;
 *  - le automazioni di marketing partono solo ai clienti con marketingConsent;
 *  - `dryRun` è acceso di default: si vede chi verrebbe contattato senza
 *    mandare niente, finché non lo si spegne esplicitamente.
 */

import { seduraDaRadere, oraConNota } from '@/lib/epilazione';
import { consensoLaserDi, mandaLinkConsenso } from '@/app/actions/consensoLaser';
import { prisma } from '@/lib/prisma';
import { idClientiSegnalati, idSenzaRecensione } from '@/lib/segnalate';
import { todayRome } from '@/lib/date';
import { creaBuonoCompleanno, percentoDa } from '@/lib/buonoCompleanno';
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone, waProvider } from '@/lib/whatsapp';
import { WA_TEMPLATES, sanitizeParam, isMarketing, templateButtonLabels, type TemplateKey } from '@/lib/wa-templates';
import { listD360Templates } from '@/lib/whatsapp360';
import { scegliRecensione } from '@/lib/sceltaRecensione';
import { GIFT_OPTIONS } from '@/lib/giftOptions';
import { phonesWithInbound } from '@/lib/wa-conversations';
import { troppoRavvicinato } from '@/lib/wa-antiflood';

const CONFIG_ROW = 'integration:wa_automations';
const LOG_KIND = 'wa_log';
/** Tetto per singola esecuzione: evita di svuotare il credito per un bug nei filtri. */
const MAX_PER_RUN = 200;

/** Quanti minuti devono passare dall'ultimo messaggio prima di mandarne uno automatico. */
const MINUTI_DI_SILENZIO = 30;

export interface WaAutomationsConfig {
  /**
   * Conferma inviata subito dopo la creazione dell'appuntamento
   * (lib/wa-appointments.ts). Non è a orario: reagisce alla prenotazione.
   * Rispetta comunque `dryRun`.
   */
  confirm: boolean;
  reminder: boolean;
  /**
   * Il consenso laser mandato la sera prima, a chi non l'ha ancora firmato.
   * Acceso di suo: e' un documento che serve alla seduta, non pubblicita'.
   */
  consensoLaser?: boolean;
  recall: boolean;
  birthday: boolean;
  review: boolean;
  /** Giorni di inattività oltre i quali un cliente è "dormiente". */
  recallDays: number;
  /** Giorni di attesa prima di ricontattare lo stesso dormiente. */
  recallCooldownDays: number;
  /** Testo dello sconto compleanno, es. "il 20%". */
  birthdayDiscount: string;
  /** Validità in giorni del regalo compleanno. */
  birthdayValidDays: number;
  /** Se true simula soltanto: nessun messaggio parte davvero. */
  dryRun: boolean;
  /**
   * Bot di prenotazione su WhatsApp (lib/wa-booking.ts). Spento di default:
   * quando è acceso risponde da solo ai clienti e scrive in agenda, quindi va
   * abilitato consapevolmente. Non è una delle automazioni a orario: reagisce
   * ai messaggi in arrivo.
   */
  booking: boolean;
  /**
   * Assistente AI che risponde alle domande dei clienti (lib/wa-assistant.ts).
   * Spento di default: ogni risposta costa una chiamata al modello e parla
   * direttamente con i clienti. Come il bot di prenotazione, non è coperto
   * dalla modalità simulazione.
   */
  assistant: boolean;
  /**
   * La segretaria su WhatsApp (lib/wa-segretaria.ts).
   *
   * È l'assistente completo: dice quando c'è posto, prenota, sposta, disdice,
   * risponde su prezzi, orari e indirizzo, e passa la conversazione a una
   * persona quando serve. Legge il gestionale a ogni domanda — listino, turni
   * veri delle operatrici, agenda — quindi non può proporre un orario che in
   * cabina non esiste.
   *
   * Da accesa prende il posto dell'assistente, del bot di prenotazione e
   * dell'agente spostamenti: erano tre interlocutori con tre memorie separate
   * nella stessa chat, e la cliente se ne accorgeva.
   *
   * Spenta di default: scrive da sola ai clienti e tocca l'agenda.
   */
  segretaria: boolean;
  /**
   * Che cosa la segretaria può toccare in agenda.
   *
   * Tre interruttori separati e non uno solo, perché i tre lavori hanno rischi
   * diversi. Spostare e disdire partono da un appuntamento che ESISTE: il
   * trattamento è già scritto, non c'è niente da indovinare, al massimo cambia
   * l'ora. Prendere un appuntamento nuovo invece obbliga a capire quale
   * trattamento vuole una persona che magari lo chiama con un altro nome — ed
   * è l'unico dei tre in cui si può sbagliare senza accorgersene.
   *
   * Tutti e tre accesi di suo: chi ha già la segretaria in funzione non deve
   * ritrovarsela dimezzata dopo un aggiornamento.
   */
  segretariaPrenota: boolean;
  segretariaSposta: boolean;
  segretariaDisdice: boolean;
  /**
   * La fascia oraria in cui la segretaria risponde, formato HH:MM.
   *
   * Vuote: risponde sempre, che e' come ha sempre funzionato. Servono a chi
   * la sta ancora collaudando e non vuole che scriva alle clienti a mezzanotte
   * senza che nessuno se ne accorga fino al mattino.
   *
   * Fuori fascia la segretaria non risponde e la conversazione resta segnata
   * DA LEGGERE nel gestionale: chi scrive alle nove di sera non va perso, va
   * solo letto da una persona domani.
   */
  segretariaDalle?: string;
  segretariaAlle?: string;
  /**
   * Agente che gestisce gli spostamenti (lib/wa-spostamento.ts).
   *
   * Quando la cliente risponde "devo spostare" al promemoria o alla conferma,
   * invece di limitarsi ad avvisare il centro le propone i giorni e gli orari
   * liberi e sposta davvero l'appuntamento in agenda. Spento di default: tocca
   * l'agenda da solo, quindi va acceso con cognizione.
   */
  spostamenti: boolean;
  /**
   * Quando un posto si libera (spostamento o disdetta), parte da sola la
   * chiamata Copri buchi verso le clienti che potrebbero prenderlo.
   *
   * Spento di default: manda messaggi a pagamento a dieci persone senza che
   * nessuno abbia premuto niente. Da acceso, il buco viene coperto anche se la
   * disdetta arriva di domenica sera.
   */
  copriBuchiAuto: boolean;
  /**
   * Avviso all'affiliato a ogni incasso di una persona che ha portato lui.
   *
   * Spento di default perché manda un messaggio a pagamento per ogni vendita:
   * su un affiliato che porta molta gente diventa un flusso continuo, ed è una
   * scelta commerciale, non tecnica.
   */
  affiliatoIncasso: boolean;
  /** Riepilogo mensile agli affiliati, il primo del mese sul mese chiuso. */
  affiliatoMese: boolean;
  /**
   * Manda la richiesta di recensione anche a chi non ha dato il consenso
   * marketing.
   *
   * Serve perché Meta ha approvato `richiesta_recensione_link` come
   * PROMOZIONALE, e di suo il gestionale tratta i promozionali come tali: solo
   * a chi ha acconsentito. Con questo acceso si manda a tutti.
   *
   * Spento di default, e la scelta è di chi gestisce il centro: il messaggio
   * parla di una visita appena fatta, ma per Meta resta una promozione, e le
   * promozioni a chi non le ha volute possono far scendere la qualità del
   * numero (fino al blocco) oltre a essere un problema col Garante.
   */
  recensioneSenzaConsenso: boolean;
}

export const DEFAULT_WA_CONFIG: WaAutomationsConfig = {
  confirm: false,
  reminder: false,
  /*
    Acceso di suo, al contrario delle altre.

    Le altre automazioni scrivono a chi non ha chiesto niente, e vanno accese
    con consapevolezza. Questa manda a chi ha una seduta laser domani il
    documento che serve a quella seduta: non mandarlo non protegge nessuno,
    costa solo cinque minuti di cabina ferma il giorno dopo.
  */
  consensoLaser: true,
  recall: false,
  birthday: false,
  review: false,
  recallDays: 60,
  recallCooldownDays: 90,
  birthdayDiscount: 'il 20%',
  /*
    Una settimana, non un mese.

    Un regalo che scade fra trenta giorni si legge, si pensa "ci vado con
    calma" e non ci si va più. Sette giorni sono abbastanza per incastrare un
    appuntamento e abbastanza pochi da farlo prendere adesso.
  */
  birthdayValidDays: 7,
  dryRun: true,
  booking: false,
  assistant: false,
  segretaria: false,
  segretariaPrenota: true,
  segretariaSposta: true,
  segretariaDisdice: true,
  segretariaDalle: '',
  segretariaAlle: '',
  spostamenti: false,
  copriBuchiAuto: false,
  affiliatoIncasso: false,
  affiliatoMese: false,
  recensioneSenzaConsenso: false,
};

export async function getWaAutomationsConfig(): Promise<WaAutomationsConfig> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: CONFIG_ROW } });
    const salvata = (row?.data as Partial<WaAutomationsConfig>) || {};
    return {
      ...DEFAULT_WA_CONFIG,
      ...salvata,
      // Chi aveva gia' configurato le automazioni non ha questa chiave salvata:
      // senza questa riga resterebbe spenta per sempre, senza un interruttore
      // che qualcuno abbia mai toccato.
      consensoLaser: salvata.consensoLaser !== false,
    };
  } catch {
    return DEFAULT_WA_CONFIG;
  }
}

export async function saveWaAutomationsConfig(cfg: WaAutomationsConfig): Promise<void> {
  await prisma.adminEntry.upsert({
    where: { rowId: CONFIG_ROW },
    update: { data: cfg as object },
    create: { rowId: CONFIG_ROW, kind: 'integration', entityId: 'wa_automations', data: cfg as object, createdAt: new Date().toISOString() },
  });
}

// ============================================================
// Helper date
// ============================================================

/** Sposta una data "YYYY-MM-DD" di N giorni (aritmetica su data pura, niente fusi). */
function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** "2026-07-28" → "martedì 28 luglio". */
function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "2026-07-28" → "28/07/2026". */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

// ============================================================
// Log invii / deduplica
// ============================================================

interface SendLogData {
  automation: TemplateKey;
  clientId?: string;
  phone: string;
  messageId?: string;
  ok: boolean;
  error?: string;
  sentAt: string;
}

async function alreadySent(rowId: string): Promise<boolean> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId } });
  return Boolean(row && (row.data as SendLogData | null)?.ok);
}

/** Vero se almeno uno di questi invii è già partito (usata per i lock vecchi). */
async function qualcunoGiaInviato(rowIds: string[]): Promise<boolean> {
  if (!rowIds.length) return false;
  const righe = await prisma.adminEntry.findMany({ where: { rowId: { in: rowIds } } });
  return righe.some(r => (r.data as SendLogData | null)?.ok);
}

/**
 * Prende il posto per un invio, prima di mandarlo.
 *
 * Controllare e poi mandare non basta: fra il controllo e l'invio ci sta
 * un'altra esecuzione che fa lo stesso controllo, trova ancora libero e manda
 * pure lei. Capita davvero durante i deploy, quando per qualche secondo il
 * container vecchio e quello nuovo girano insieme e hanno entrambi lo
 * scheduler acceso: alle 19:30 partono in due e la cliente riceve due volte lo
 * stesso messaggio (che paghiamo due volte).
 *
 * `create` su un rowId univoco è atomico: passa uno solo, l'altro sbatte sul
 * vincolo e si ferma. L'esito vero lo scrive dopo `logSend`.
 */
async function prenotaInvio(rowId: string, data: Omit<SendLogData, 'ok'>): Promise<boolean> {
  try {
    await prisma.adminEntry.create({
      data: {
        rowId, kind: LOG_KIND, entityId: rowId,
        data: { ...data, ok: false, inCorso: true } as unknown as object,
        createdAt: data.sentAt,
      },
    });
    return true;
  } catch {
    // Riga già presente: l'invio è di qualcun altro (o è già stato fatto).
    return false;
  }
}

async function logSend(rowId: string, data: SendLogData): Promise<void> {
  await prisma.adminEntry.upsert({
    where: { rowId },
    update: { data: data as unknown as object },
    create: { rowId, kind: LOG_KIND, entityId: rowId, data: data as unknown as object, createdAt: data.sentAt },
  });
}

/** Ultimo invio riuscito di una certa automazione a un cliente, se c'è. */
async function lastSentAt(automation: TemplateKey, clientId: string): Promise<string | null> {
  const rows = await prisma.adminEntry.findMany({
    where: { kind: LOG_KIND, rowId: { startsWith: `wa:${automation}:${clientId}` } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  const data = rows[0]?.data as unknown as SendLogData | undefined;
  return data?.ok ? data.sentAt : null;
}

// ============================================================
// Motore
// ============================================================

export interface RunResult {
  automation: TemplateKey;
  skipped?: string;
  dryRun: boolean;
  candidates: number;
  sent: number;
  failed: number;
  details: Array<{ to: string; name: string; ok: boolean; error?: string; preview: string }>;
}

interface Job {
  rowId: string;
  clientId?: string;
  name: string;
  phone: string;
  params: string[];
  /** Da fare solo se il messaggio è partito davvero (non in simulazione). */
  dopoInvio?: () => Promise<void>;
}

/** Corpo del messaggio con i {{n}} già sostituiti. È il testo, senza i bottoni. */
function renderBody(key: TemplateKey, params: string[]): string {
  return WA_TEMPLATES[key].body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? `{{${i}}}`);
}

/**
 * Anteprima di quello che il cliente riceve davvero: corpo PIÙ bottoni.
 *
 * Prima mostrava il solo corpo, e per la richiesta recensione questo significava
 * un messaggio senza nessun link — perché il link non è nel testo, è nel bottone
 * URL del template. Dalla schermata sembrava che l'automazione mandasse messaggi
 * monchi, mentre il bottone partiva regolarmente.
 *
 * I bottoni arrivano dal catalogo interno, che è quello che abbiamo fatto
 * approvare: se qualcuno li cambiasse su 360dialog Hub senza aggiornare il
 * catalogo, l'anteprima resterebbe indietro. Il confronto con la versione
 * davvero attiva su Meta lo fa il riquadro "Template su 360dialog".
 */
function renderPreview(key: TemplateKey, params: string[]): string {
  const labels = templateButtonLabels(key);
  const body = renderBody(key, params);
  return labels.length ? `${body}\n\n${labels.map(b => `[ ${b} ]`).join('\n')}` : body;
}

/**
 * `key` è l'automazione (serve per i lucchetti e per l'archivio), `chiaveInvio`
 * è il messaggio che parte davvero. Quasi sempre coincidono; per la richiesta
 * recensione no, perché il testo giusto è quello col bottone e i lucchetti
 * devono restare quelli di sempre — se cambiassero, chi la recensione l'ha già
 * ricevuta se la vedrebbe arrivare una seconda volta.
 */
async function runJobs(key: TemplateKey, jobs: Job[], dryRun: boolean, chiaveInvio: TemplateKey = key): Promise<RunResult> {
  const result: RunResult = { automation: key, dryRun, candidates: jobs.length, sent: 0, failed: 0, details: [] };

  for (const job of jobs.slice(0, MAX_PER_RUN)) {
    // Due testi diversi, apposta: `preview` è per gli occhi (corpo + bottoni),
    // `body` è il testo vero e proprio. Mettere i bottoni nel fallback
    // significherebbe mandarli scritti dentro al messaggio.
    const preview = renderPreview(chiaveInvio, job.params);
    const body = renderBody(chiaveInvio, job.params);

    if (dryRun) {
      result.details.push({ to: job.phone, name: job.name, ok: true, preview });
      continue;
    }

    /*
      Non si atterra sopra una conversazione in corso.

      Il promemoria delle 18 che arriva mentre la cliente sta parlando con la
      segretaria — magari proprio di quell'appuntamento — non informa nessuno:
      fa sembrare due interlocutori scoordinati un unico interlocutore confuso,
      e a quel punto la chat si silenzia. Mezz'ora di distanza dall'ultima cosa
      che le abbiamo detto è il minimo perché il messaggio si legga come una
      cosa a sé. Il posto in agenda non si perde: al giro dopo riparte, perché
      il fermo dell'invio non è stato ancora preso.
    */
    if (await troppoRavvicinato(job.phone, MINUTI_DI_SILENZIO)) {
      console.log(`[wa-automations] ${key}: ${job.phone} ha ricevuto un messaggio da poco, rimandato al prossimo giro`);
      continue;
    }

    // Il posto si prende PRIMA di mandare: se un'altra esecuzione è già
    // partita su questo stesso messaggio, qui ci si ferma senza spendere.
    const mio = await prenotaInvio(job.rowId, {
      automation: key,
      clientId: job.clientId,
      phone: job.phone,
      sentAt: new Date().toISOString(),
    });
    if (!mio) {
      console.warn(`[wa-automations] ${key}: ${job.rowId} già in carico a un'altra esecuzione, saltato`);
      continue;
    }

    const res = await sendWhatsAppTemplate(job.phone, chiaveInvio, {
      bodyParams: job.params,
      fallbackText: body,
    });

    await logSend(job.rowId, {
      automation: key,
      clientId: job.clientId,
      phone: job.phone,
      messageId: res.messageId,
      ok: res.ok,
      error: res.error,
      sentAt: new Date().toISOString(),
    });

    if (res.ok && job.dopoInvio) {
      // Se questo fallisce il messaggio è comunque partito: si annota e si va
      // avanti, non si finge che l'invio non sia avvenuto.
      await job.dopoInvio().catch(e => console.error(`[wa-automations] ${key}: dopoInvio`, e));
    }

    if (res.ok) result.sent++; else result.failed++;
    result.details.push({ to: job.phone, name: job.name, ok: res.ok, error: res.error, preview });
  }

  if (jobs.length > MAX_PER_RUN) {
    console.warn(`[wa-automations] ${key}: ${jobs.length} candidati, inviati solo i primi ${MAX_PER_RUN}`);
  }
  return result;
}

// ---- Promemoria appuntamenti (24h prima) --------------------

export async function runReminders(dryRun: boolean): Promise<RunResult> {
  const target = shiftDate(todayRome(), 1);
  const appts = await prisma.appointment.findMany({
    where: { date: target, status: { notIn: ['cancelled', 'completed', 'no-show', 'no_show'] } },
    include: { client: true },
    orderBy: { startTime: 'asc' },
  });

  // Un promemoria per cliente, non uno per appuntamento: chi ha due
  // appuntamenti domani riceveva due messaggi quasi identici. Si annuncia il
  // primo della giornata (gli appuntamenti arrivano ordinati per orario).
  const perCliente = new Map<string, typeof appts>();
  for (const a of appts) {
    const lista = perCliente.get(a.clientId);
    if (lista) lista.push(a);
    else perCliente.set(a.clientId, [a]);
  }

  const jobs: Job[] = [];
  for (const [clientId, giornata] of perCliente) {
    const a = giornata[0];
    const phone = a.client?.phone;
    if (!isSendablePhone(phone)) continue;

    const rowId = `wa:reminder:${clientId}:${target}`;
    if (await alreadySent(rowId)) continue;
    if (await qualcunoGiaInviato(giornata.map(v => `wa:reminder:${clientId}:${v.id}`))) continue;

    jobs.push({
      rowId,
      clientId,
      name: a.clientName,
      phone: normalizePhone(phone as string),
      params: [
        sanitizeParam(a.client?.firstName || a.clientName.split(' ')[0]),
        // Con più trattamenti in giornata il singolo nome sarebbe fuorviante.
        sanitizeParam(giornata.length > 1 ? 'i tuoi trattamenti' : a.treatmentName, 'il tuo trattamento'),
        sanitizeParam(humanDate(a.date)),
        /*
          Il promemoria della sera prima e' l'ultimo momento utile per dire
          «raditi»: si guardano TUTTI gli appuntamenti di domani, perche' il
          messaggio e' uno solo per cliente e l'epilazione puo' essere il
          secondo della giornata.
        */
        sanitizeParam(oraConNota(a.startTime, giornata.some(seduraDaRadere))),
      ],
    });
  }
  return runJobs('reminder', jobs, dryRun);
}

/**
 * Il consenso laser, mandato la sera prima.
 *
 * Il modulo si compila in cinque minuti: farlo al banco vuol dire cinque
 * minuti di cabina ferma con la cliente che aspetta e l'operatrice che guarda.
 * Mandato la sera prima, chi lo compila arriva e si comincia; chi non lo
 * compila lo firma sul tablet come prima, e non abbiamo perso niente.
 *
 * Si manda solo a chi domani ha un'epilazione laser e non ha gia' un consenso
 * firmato: un modulo gia' fatto non si richiede, e ricevere due volte lo
 * stesso link fa pensare che il primo non fosse arrivato.
 */
async function runConsensiLaser(dryRun: boolean): Promise<RunResult> {
  const target = shiftDate(todayRome(), 1);
  const result: RunResult = { automation: 'consensoLaser', dryRun, candidates: 0, sent: 0, failed: 0, details: [] };

  const appts = await prisma.appointment.findMany({
    where: { date: target, status: { notIn: ['cancelled', 'completed', 'no-show', 'no_show'] } },
    include: { client: true },
    orderBy: { startTime: 'asc' },
  });

  // Una cliente sola, anche con due appuntamenti: il consenso e' suo, non della seduta.
  const visti = new Set<string>();
  for (const a of appts) {
    if (!seduraDaRadere(a)) continue;
    if (visti.has(a.clientId)) continue;
    visti.add(a.clientId);
    if (!isSendablePhone(a.client?.phone)) continue;

    const gia = await consensoLaserDi(a.clientId).catch(() => null);
    if (gia) continue;

    result.candidates++;
    const rowId = `wa:consenso:${a.clientId}:${target}`;
    if (await alreadySent(rowId)) continue;

    if (dryRun) {
      result.details.push({ to: normalizePhone(a.client!.phone), name: a.clientName, ok: true, preview: 'link consenso laser' });
      continue;
    }

    const esito = await mandaLinkConsenso(a.id).catch(() => ({ ok: false, errore: 'invio fallito' }));
    if (esito.ok) result.sent++; else result.failed++;
    result.details.push({ to: normalizePhone(a.client!.phone), name: a.clientName, ok: esito.ok, error: esito.ok ? undefined : esito.errore, preview: 'link consenso laser' });
    await prisma.adminEntry.upsert({
      where: { rowId },
      update: { data: { automation: 'consensoLaser', clientId: a.clientId, ok: esito.ok, sentAt: new Date().toISOString() } },
      create: {
        rowId, kind: 'wa_log', entityId: a.clientId,
        data: { automation: 'consensoLaser', clientId: a.clientId, ok: esito.ok, sentAt: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      },
    });
  }
  return result;
}

// ---- Recall clienti dormienti -------------------------------

export async function runRecall(cfg: WaAutomationsConfig, dryRun: boolean): Promise<RunResult> {
  const cutoff = shiftDate(todayRome(), -cfg.recallDays);
  const clients = await prisma.client.findMany({
    where: {
      marketingConsent: true,
      lastVisit: { not: null, lt: cutoff },
    },
    orderBy: { lastVisit: 'desc' },
  });

  const cooldownStart = shiftDate(todayRome(), -cfg.recallCooldownDays);
  const jobs: Job[] = [];
  for (const c of clients) {
    if (!isSendablePhone(c.phone)) continue;
    const last = await lastSentAt('recall', c.id);
    if (last && last.slice(0, 10) >= cooldownStart) continue;
    jobs.push({
      rowId: `wa:recall:${c.id}:${todayRome()}`,
      clientId: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      phone: normalizePhone(c.phone),
      params: [sanitizeParam(c.firstName)],
    });
  }
  return runJobs('recall', jobs, dryRun);
}

// ---- Auguri compleanno --------------------------------------

export async function runBirthdays(cfg: WaAutomationsConfig, dryRun: boolean): Promise<RunResult> {
  const today = todayRome();
  const mmdd = today.slice(5);
  const year = today.slice(0, 4);
  const expiry = shortDate(shiftDate(today, cfg.birthdayValidDays));
  // "il 20%" scritto nelle impostazioni diventa il numero da scalare in cassa.
  const percento = percentoDa(cfg.birthdayDiscount);

  const clients = await prisma.client.findMany({
    where: { marketingConsent: true, birthDate: { not: null } },
  });

  const jobs: Job[] = [];
  for (const c of clients) {
    if (!c.birthDate || c.birthDate.slice(5, 10) !== mmdd) continue;
    if (!isSendablePhone(c.phone)) continue;
    const rowId = `wa:birthday:${c.id}:${year}`;
    if (await alreadySent(rowId)) continue;
    jobs.push({
      rowId,
      clientId: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      phone: normalizePhone(c.phone),
      params: [sanitizeParam(c.firstName), sanitizeParam(cfg.birthdayDiscount), expiry],
      /*
        Il regalo promesso nel messaggio diventa un buono scritto: se no la
        cliente arriva fra tre settimane e l'unica prova dello sconto è uno
        screenshot sul suo telefono.
      */
      dopoInvio: percento
        ? () => creaBuonoCompleanno({
            clientId: c.id, percento, dal: today,
            scadenza: shiftDate(today, cfg.birthdayValidDays),
          })
        : undefined,
    });
  }
  return runJobs('birthday', jobs, dryRun);
}

/**
 * Quale richiesta recensione parte: quella col bottone.
 *
 * Il primo template (`richiesta_recensione`) è stato approvato senza bottone:
 * alla cliente arriva "ci lasci una recensione?" e nient'altro — nessun link,
 * nessuna indicazione di dove andare, e chi ci prova finisce sulla scheda
 * sbagliata o lascia perdere. La versione col bottone (`richiesta_recensione_link`)
 * apre la pagina giusta con un tocco.
 *
 * Si ripiega sulla vecchia solo se Meta non ha (ancora) approvato quella nuova:
 * meglio un messaggio monco che nessun messaggio.
 */
export async function chiaveRichiestaRecensione(): Promise<{ chiave: TemplateKey; marketing: boolean }> {
  const remote = await listD360Templates();
  // Elenco illeggibile: si prova comunque, meglio un tentativo che il silenzio.
  if (!remote.ok) return { chiave: 'reviewV2', marketing: false };

  /*
    L'ordine conta: la versione che nomina Google viene per prima.

    Le altre due chiedono "ci lasci una recensione?" col link solo nel
    bottone, e chi il bottone non lo tocca non sa dove dovrebbe scrivere —
    una cliente ha risposto "100" in chat, credendo fosse un voto da dare.
    Restano dietro come rete: se Meta un giorno blocca la nuova, il messaggio
    parte lo stesso.
  */
  const perNome: Record<string, TemplateKey> = {
    [WA_TEMPLATES.reviewV3.name]: 'reviewV3',
    [WA_TEMPLATES.reviewV2.name]: 'reviewV2',
    [WA_TEMPLATES.review.name]: 'review',
  };
  const scelta = scegliRecensione(remote.templates, [
    WA_TEMPLATES.reviewV3.name, WA_TEMPLATES.review.name, WA_TEMPLATES.reviewV2.name,
  ]);
  if (!scelta.nome) return { chiave: 'reviewV2', marketing: false };

  return { chiave: perNome[scelta.nome] ?? 'review', marketing: scelta.promozionale };
}

// ---- Richiesta recensione (giorno dopo la visita) -----------

export async function runReviewRequests(dryRun: boolean): Promise<RunResult> {
  const target = shiftDate(todayRome(), -1);
  const [scelta, cfg] = await Promise.all([chiaveRichiestaRecensione(), getWaAutomationsConfig()]);
  const [appts, segnalate, senzaRichiesta] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: target, status: 'completed' },
      include: { client: true },
    }),
    idClientiSegnalati(),
    idSenzaRecensione(),
  ]);

  // La recensione si chiede UNA VOLTA SOLA nella vita del cliente.
  //
  // Prima il blocco valeva per giornata: chi torna ogni settimana si ritrovava
  // la stessa richiesta ogni settimana (record: sei volte). Una recensione la
  // si lascia una volta, e insistere non ne fa arrivare di più — fa solo
  // bloccare il numero del centro.
  const perCliente = new Map<string, typeof appts>();
  for (const a of appts) {
    const lista = perCliente.get(a.clientId);
    if (lista) lista.push(a);
    else perCliente.set(a.clientId, [a]);
  }

  const jobs: Job[] = [];
  for (const [clientId, visite] of perCliente) {
    const a = visite[0];
    const phone = a.client?.phone;
    if (!isSendablePhone(phone)) continue;

    /*
      Alle segnalate non si chiede la recensione.

      Se una cliente ha avuto da ridire — ed è per quello che qualcuno l'ha
      segnalata — il nostro messaggio non le fa cambiare idea: le ricorda che
      può scriverlo su Google. Chi voleva lasciare una stella la lascia
      comunque; chi non ci aveva pensato non deve sentirselo suggerire da noi.
    */
    if (segnalate.has(clientId)) continue;

    /*
      E chi il centro ha deciso di lasciare fuori, punto.

      Non e' una segnalazione e non vuol dire niente su di lei: vuol dire solo
      che qualcuno al banco sa perche' a quella persona la recensione non si
      chiede. Vale per sempre, finche' non la si rimette.
    */
    if (senzaRichiesta.has(clientId)) continue;

    // Se Meta l'ha classificato promozionale vale la regola delle promozioni,
    // a meno che il centro abbia deciso di mandarla comunque a tutte.
    if (scelta.marketing && !cfg.recensioneSenzaConsenso && !a.client?.marketingConsent) continue;

    const rowId = `wa:review:${clientId}:${target}`;
    // Un solo controllo, e vale per sempre: `lastSentAt` guarda TUTTI i lock
    // di questo cliente, in qualunque formato siano stati scritti (per data o
    // per appuntamento). Se una richiesta è già partita una volta, non ne
    // parte mai più.
    if (await lastSentAt('review', clientId)) continue;

    jobs.push({
      rowId,
      clientId,
      name: a.clientName,
      phone: normalizePhone(phone as string),
      params: [
        sanitizeParam(a.client?.firstName || a.clientName.split(' ')[0]),
        sanitizeParam(a.treatmentName, 'il tuo trattamento'),
      ],
    });
  }
  // Il lucchetto resta 'review' (una recensione si chiede una volta nella
  // vita), ma il messaggio che parte è quello col bottone.
  return runJobs('review', jobs, dryRun, scelta.chiave);
}

// ---- Campagna omaggio inaugurazione -------------------------

/**
 * Scrive a chi ha scaricato il coupon dell'inaugurazione e non ha ancora
 * prenotato la seduta omaggio.
 *
 * "Non ha prenotato" ha lo stesso significato della pagina Inaugurazione: il
 * contatto non risulta collegato a nessun appuntamento. L'abbinamento è sul
 * numero (ultime 9 cifre) o sull'email, come nell'elenco.
 *
 * È marketing: chi ha revocato il consenso viene saltato, e il rowId per
 * contatto garantisce che nessuno la riceva due volte anche rilanciandola.
 */
export async function runOmaggioInaugurazione(dryRun: boolean, giro: 1 | 2 = 1): Promise<RunResult> {
  const [leads, clients, appts, hannoRisposto] = await Promise.all([
    prisma.inaugurationLead.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.client.findMany({ select: { id: true, phone: true, email: true, marketingConsent: true } }),
    prisma.appointment.findMany({ where: { status: { not: 'cancelled' } }, select: { clientId: true } }),
    giro === 2 ? phonesWithInbound() : Promise.resolve(new Set<string>()),
  ]);

  const conAppuntamento = new Set(appts.map(a => a.clientId).filter(Boolean) as string[]);
  const tail = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-9);

  // Etichetta leggibile del trattamento omaggio scelto sul coupon
  const etichettaOmaggio = (key: string) =>
    GIFT_OPTIONS.find(o => o.key === key)?.label || 'la tua seduta omaggio';

  const jobs: Job[] = [];
  for (const l of leads) {
    if (!isSendablePhone(l.phone)) continue;
    // Solo chi ha CONFERMATO via email: il coupon scaricato e mai confermato
    // non è un contatto valido (scelta di Dino, 01/08/2026)
    if (l.status !== 'confirmed') continue;

    // Prima il telefono, poi l'email: le email condivise in famiglia con l'OR
    // facevano risolvere il coupon sul familiare sbagliato.
    const cliente = (tail(l.phone) && clients.find(c => tail(c.phone) === tail(l.phone)))
      || (l.email && clients.find(c => (c.email || '').toLowerCase() === l.email!.toLowerCase()))
      || undefined;
    // Ha già prenotato (o è già venuto): non va disturbato
    if (cliente && conAppuntamento.has(cliente.id)) continue;
    // Consenso marketing: si rispetta quando il contatto è già in anagrafica
    if (cliente && cliente.marketingConsent === false) continue;

    // Primo giro e sollecito hanno chiavi diverse, così il secondo messaggio
    // può partire senza che il primo lo blocchi (e senza mai ripetersi a sua volta).
    const primoGiro = `wa:omaggio:${l.id}`;
    const rowId = giro === 2 ? `wa:omaggio:sollecito:${l.id}` : primoGiro;
    if (await alreadySent(rowId)) continue;

    if (giro === 2) {
      // Il sollecito va SOLO a chi ha già ricevuto il primo messaggio: chi non
      // l'ha mai ricevuto va contattato con il primo giro, non con un secondo.
      if (!(await alreadySent(primoGiro))) continue;
      // E solo a chi non ha risposto: se ha scritto, se ne occupa una persona.
      if (hannoRisposto.has(normalizePhone(l.phone))) continue;
    }

    jobs.push({
      rowId,
      clientId: cliente?.id,
      name: `${l.firstName} ${l.lastName}`.trim(),
      phone: normalizePhone(l.phone),
      params: [
        sanitizeParam(l.firstName || `${l.firstName} ${l.lastName}`),
        sanitizeParam(etichettaOmaggio(l.treatment), 'la tua seduta omaggio'),
      ],
    });
  }

  return runJobs('omaggio', jobs, dryRun);
}

// ---- Orchestratore ------------------------------------------

export interface RunOptions {
  which?: TemplateKey | 'all';
  /** Campagna omaggio: 1 = primo invio, 2 = sollecito a chi non ha risposto. */
  giro?: 1 | 2;
  /** Esegue anche se l'automazione è spenta in configurazione (tasto "Prova ora"). */
  force?: boolean;
  /** Forza la simulazione a prescindere dalla configurazione. */
  dryRun?: boolean;
}

export async function runWaAutomations(opts: RunOptions = {}): Promise<RunResult[]> {
  const cfg = await getWaAutomationsConfig();
  const which = opts.which || 'all';
  const dryRun = opts.dryRun ?? cfg.dryRun;
  const results: RunResult[] = [];

  // 'omaggio' non è fra gli interruttori di configurazione: è una campagna una
  // tantum e si lancia solo a mano, quindi qui conta solo `force`.
  const acceso = (key: TemplateKey) => (key === 'omaggio' ? false : Boolean(cfg[key as keyof WaAutomationsConfig]));
  const wants = (key: TemplateKey) => (which === 'all' || which === key) && (opts.force || acceso(key));

  if (!waProvider()) {
    return [{ automation: 'reminder', skipped: 'WhatsApp non configurato (manca D360_API_KEY)', dryRun, candidates: 0, sent: 0, failed: 0, details: [] }];
  }

  if (wants('reminder')) results.push(await runReminders(dryRun));
  if (wants('recall')) results.push(await runRecall(cfg, dryRun));
  if (wants('birthday')) results.push(await runBirthdays(cfg, dryRun));
  if (wants('review')) results.push(await runReviewRequests(dryRun));
  if (wants('consensoLaser')) results.push(await runConsensiLaser(dryRun));
  // 'omaggio' non ha un interruttore in configurazione: parte solo a mano
  // dalla pagina Inaugurazione (which='omaggio' + force), mai da sola.
  if (which === 'omaggio' && opts.force) results.push(await runOmaggioInaugurazione(dryRun, opts.giro ?? 1));

  for (const r of results) {
    if (isMarketing(r.automation) && r.sent > 0) {
      console.log(`[wa-automations] ${r.automation}: ${r.sent} messaggi marketing inviati (solo consensi espliciti)`);
    }
  }
  return results;
}

/** Orari (Europe/Rome) in cui lo scheduler lancia ciascuna automazione. */
export const WA_SCHEDULE: Array<{ hhmm: string; which: TemplateKey }> = [
  { hhmm: '09:30', which: 'birthday' },
  { hhmm: '11:00', which: 'recall' },
  { hhmm: '18:00', which: 'reminder' },
  // Dieci minuti dopo il promemoria: due messaggi di fila alla stessa persona
  // si leggono come uno solo mal scritto.
  { hhmm: '18:10', which: 'consensoLaser' },
  { hhmm: '19:30', which: 'review' },
];
