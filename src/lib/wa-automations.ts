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

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone, waProvider } from '@/lib/whatsapp';
import { WA_TEMPLATES, sanitizeParam, isMarketing, type TemplateKey } from '@/lib/wa-templates';
import { GIFT_OPTIONS } from '@/lib/giftOptions';

const CONFIG_ROW = 'integration:wa_automations';
const LOG_KIND = 'wa_log';
/** Tetto per singola esecuzione: evita di svuotare il credito per un bug nei filtri. */
const MAX_PER_RUN = 200;

export interface WaAutomationsConfig {
  /**
   * Conferma inviata subito dopo la creazione dell'appuntamento
   * (lib/wa-appointments.ts). Non è a orario: reagisce alla prenotazione.
   * Rispetta comunque `dryRun`.
   */
  confirm: boolean;
  reminder: boolean;
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
}

export const DEFAULT_WA_CONFIG: WaAutomationsConfig = {
  confirm: false,
  reminder: false,
  recall: false,
  birthday: false,
  review: false,
  recallDays: 60,
  recallCooldownDays: 90,
  birthdayDiscount: 'il 20%',
  birthdayValidDays: 30,
  dryRun: true,
  booking: false,
  assistant: false,
};

export async function getWaAutomationsConfig(): Promise<WaAutomationsConfig> {
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: CONFIG_ROW } });
    return { ...DEFAULT_WA_CONFIG, ...((row?.data as Partial<WaAutomationsConfig>) || {}) };
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
}

/** Anteprima leggibile del messaggio, con i {{n}} già sostituiti. */
function renderPreview(key: TemplateKey, params: string[]): string {
  return WA_TEMPLATES[key].body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? `{{${i}}}`);
}

async function runJobs(key: TemplateKey, jobs: Job[], dryRun: boolean): Promise<RunResult> {
  const result: RunResult = { automation: key, dryRun, candidates: jobs.length, sent: 0, failed: 0, details: [] };

  for (const job of jobs.slice(0, MAX_PER_RUN)) {
    const preview = renderPreview(key, job.params);

    if (dryRun) {
      result.details.push({ to: job.phone, name: job.name, ok: true, preview });
      continue;
    }

    const res = await sendWhatsAppTemplate(job.phone, key, {
      bodyParams: job.params,
      fallbackText: preview,
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

  const jobs: Job[] = [];
  for (const a of appts) {
    const phone = a.client?.phone;
    if (!isSendablePhone(phone)) continue;
    const rowId = `wa:reminder:${a.clientId}:${a.id}`;
    if (await alreadySent(rowId)) continue;
    jobs.push({
      rowId,
      clientId: a.clientId,
      name: a.clientName,
      phone: normalizePhone(phone as string),
      params: [
        sanitizeParam(a.client?.firstName || a.clientName.split(' ')[0]),
        sanitizeParam(a.treatmentName, 'il tuo trattamento'),
        sanitizeParam(humanDate(a.date)),
        sanitizeParam(a.startTime),
      ],
    });
  }
  return runJobs('reminder', jobs, dryRun);
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
    });
  }
  return runJobs('birthday', jobs, dryRun);
}

// ---- Richiesta recensione (giorno dopo la visita) -----------

export async function runReviewRequests(dryRun: boolean): Promise<RunResult> {
  const target = shiftDate(todayRome(), -1);
  const appts = await prisma.appointment.findMany({
    where: { date: target, status: 'completed' },
    include: { client: true },
  });

  const jobs: Job[] = [];
  for (const a of appts) {
    const phone = a.client?.phone;
    if (!isSendablePhone(phone)) continue;
    const rowId = `wa:review:${a.clientId}:${a.id}`;
    if (await alreadySent(rowId)) continue;
    jobs.push({
      rowId,
      clientId: a.clientId,
      name: a.clientName,
      phone: normalizePhone(phone as string),
      params: [
        sanitizeParam(a.client?.firstName || a.clientName.split(' ')[0]),
        sanitizeParam(a.treatmentName, 'il tuo trattamento'),
      ],
    });
  }
  return runJobs('review', jobs, dryRun);
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
export async function runOmaggioInaugurazione(dryRun: boolean): Promise<RunResult> {
  const [leads, clients, appts] = await Promise.all([
    prisma.inaugurationLead.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.client.findMany({ select: { id: true, phone: true, email: true, marketingConsent: true } }),
    prisma.appointment.findMany({ where: { status: { not: 'cancelled' } }, select: { clientId: true } }),
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

    const rowId = `wa:omaggio:${l.id}`;
    if (await alreadySent(rowId)) continue;

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
  // 'omaggio' non ha un interruttore in configurazione: parte solo a mano
  // dalla pagina Inaugurazione (which='omaggio' + force), mai da sola.
  if (which === 'omaggio' && opts.force) results.push(await runOmaggioInaugurazione(dryRun));

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
  { hhmm: '19:30', which: 'review' },
];
