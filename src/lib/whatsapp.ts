/**
 * Invio messaggi WhatsApp. Due provider, scelti in base alle variabili d'ambiente:
 *
 *  1. 360dialog (ufficiale, WhatsApp Business Cloud API) — usato se c'è D360_API_KEY.
 *     È la via corretta per promemoria e marketing: fuori dalla finestra 24h
 *     richiede template approvati (lib/wa-templates.ts).
 *  2. Evolution API (non ufficiale) — fallback storico, stessa infrastruttura
 *     usata per gli allarmi dei distributori su instantcase.
 *
 * Lo stesso numero NON può stare su entrambi: una volta migrato il numero su
 * 360dialog, Evolution smette di funzionare su quel numero.
 *
 * Variabili d'ambiente:
 *  - D360_API_KEY                                    → provider 360dialog
 *  - EVOLUTION_URL / EVOLUTION_INSTANCE / EVOLUTION_APIKEY → provider Evolution
 */

import { d360Configured, d360MissingVars, sendD360Text, sendD360Template, listD360Templates, type TemplateSendOptions } from './whatsapp360';
import {
  WA_TEMPLATES, templateButtonLabels, sanitizeParam,
  NOME_APERTURA, TESTO_APERTURA, NOME_CONTATTO_SITO, TESTO_CONTATTO_SITO,
  type TemplateKey,
} from './wa-templates';
import { logOutbound, type WaSource } from './wa-conversations';

export type WaProvider = '360dialog' | 'evolution' | null;

function evolutionConfigured(): boolean {
  return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_INSTANCE && process.env.EVOLUTION_APIKEY);
}

/** Provider attivo. 360dialog ha la precedenza se configurato. */
export function waProvider(): WaProvider {
  if (d360Configured()) return '360dialog';
  if (evolutionConfigured()) return 'evolution';
  return null;
}

export function whatsappConfigured(): boolean {
  return waProvider() !== null;
}

export function whatsappMissingVars(): string[] {
  if (whatsappConfigured()) return [];
  // Nessuno dei due configurato: indichiamo la via consigliata (360dialog).
  return d360MissingVars();
}

export interface WaSendResult {
  ok: boolean;
  status?: number;
  error?: string;
  messageId?: string;
  provider?: WaProvider;
}

async function sendViaEvolution(number: string, text: string): Promise<WaSendResult> {
  const url = `${(process.env.EVOLUTION_URL || '').replace(/\/+$/, '')}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_APIKEY as string },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp] Evolution error', res.status, body);
      return { ok: false, status: res.status, error: `Evolution ${res.status}`, provider: 'evolution' };
    }
    return { ok: true, status: res.status, provider: 'evolution' };
  } catch (err) {
    console.error('[whatsapp] Evolution fetch failed', err);
    return { ok: false, error: 'Connessione a Evolution fallita', provider: 'evolution' };
  }
}

/**
 * Invia un messaggio di testo libero a un numero in formato internazionale
 * (es. 393331234567).
 *
 * Attenzione: su 360dialog il testo libero passa solo entro 24h dall'ultimo
 * messaggio del cliente. Per contatti a freddo usa sendWhatsAppTemplate.
 *
 * Ogni invio finisce nell'archivio conversazioni: è l'unico modo per rileggere
 * dal gestionale quello che assistente e bot hanno risposto da soli, visto che
 * il numero non è più apribile da WhatsApp.
 */
export async function sendWhatsApp(number: string, text: string, source: WaSource = 'system'): Promise<WaSendResult> {
  const provider = waProvider();
  if (!provider) {
    return { ok: false, error: `WhatsApp non configurato: mancano ${whatsappMissingVars().join(', ')}` };
  }
  const res = provider === '360dialog'
    ? { ...(await sendD360Text(number, text)), provider }
    : await sendViaEvolution(number, text);

  await logOutbound({ phone: number, text, source, messageId: res.messageId, ok: res.ok, error: res.error });
  return res;
}

/**
 * Invia un template approvato. Unica via per contattare fuori dalla finestra 24h.
 * Su Evolution i template non esistono: si ripiega sul testo libero.
 */
export async function sendWhatsAppTemplate(
  number: string,
  key: TemplateKey,
  opts: TemplateSendOptions & { fallbackText?: string; source?: WaSource } = {}
): Promise<WaSendResult> {
  const provider = waProvider();
  if (!provider) {
    return { ok: false, error: `WhatsApp non configurato: mancano ${whatsappMissingVars().join(', ')}` };
  }
  const tpl = WA_TEMPLATES[key];

  let res: WaSendResult;
  if (provider === '360dialog') {
    res = { ...(await sendD360Template(number, tpl.name, { language: tpl.language, ...opts })), provider };
  } else if (!opts.fallbackText) {
    res = { ok: false, error: 'Evolution non supporta i template: serve fallbackText', provider };
  } else {
    res = await sendViaEvolution(number, opts.fallbackText);
  }

  // In archivio va il testo che il cliente legge davvero: il template con i
  // parametri già sostituiti, non il nome tecnico. Insieme al testo va anche di
  // che template si tratta e con quali bottoni: il corpo da solo non basta a
  // capire cosa è stato consegnato, perché i bottoni (e per la richiesta
  // recensione l'intero link) non compaiono nel testo.
  await logOutbound({
    phone: number,
    text: opts.fallbackText || `[template ${tpl.name}]`,
    source: opts.source || 'automation',
    messageId: res.messageId,
    ok: res.ok,
    error: res.error,
    // Solo se è partito davvero come template: su Evolution è testo libero e i
    // bottoni non esistono, segnarli sarebbe una bugia in archivio.
    template: provider === '360dialog'
      ? { name: tpl.name, buttons: templateButtonLabels(key) }
      : undefined,
  });
  return res;
}

/**
 * Il primo messaggio a chi ci ha lasciato i contatti e non ci ha mai scritto.
 *
 * Serve una porta a parte perche' qui la finestra 24h e' chiusa per
 * definizione: la conversazione non l'ha aperta nessuno, e Meta lascia passare
 * solo un template approvato. `sendWhatsAppTemplate` non va bene, parla solo
 * dei template delle automazioni; questi due invece li crea a mano chi gestisce
 * il centro, dalla schermata WhatsApp.
 *
 * Si prova prima quello che dice *perche'* stiamo scrivendo. Se Meta non l'ha
 * ancora approvato si ripiega sul buongiorno generico: dice meno, ma parte —
 * ed e' sempre meglio di un contatto lasciato li' ad aspettare l'approvazione.
 */
export async function sendWhatsAppApertura(
  number: string,
  params: { nome: string; motivo?: string },
  source: WaSource = 'automation'
): Promise<WaSendResult> {
  if (waProvider() !== '360dialog') {
    // Su Evolution i template non esistono e la finestra non conta: testo libero.
    return sendWhatsApp(number, TESTO_APERTURA.replace('{{1}}', params.nome), source);
  }

  const nome = sanitizeParam(params.nome, 'ciao');
  const motivo = sanitizeParam(params.motivo || '', 'un\'informazione');

  const elenco = await listD360Templates();
  const approvato = (nomeTpl: string) =>
    elenco.ok && elenco.templates.some(t => t.name === nomeTpl && t.status === 'APPROVED');

  const scelta = approvato(NOME_CONTATTO_SITO)
    ? { name: NOME_CONTATTO_SITO, bodyParams: [nome, motivo], testo: TESTO_CONTATTO_SITO }
    : { name: NOME_APERTURA, bodyParams: [nome], testo: TESTO_APERTURA };

  const res: WaSendResult = {
    ...(await sendD360Template(number, scelta.name, { language: 'it', bodyParams: scelta.bodyParams })),
    provider: '360dialog',
  };

  // In archivio va il testo che la persona legge davvero, coi segnaposto gia'
  // sostituiti: il nome tecnico del template non dice niente a chi rilegge la
  // chat dal gestionale.
  const testoLetto = scelta.bodyParams.reduce(
    (t, v, i) => t.replaceAll(`{{${i + 1}}}`, v),
    scelta.testo
  );
  await logOutbound({
    phone: number, text: testoLetto, source,
    messageId: res.messageId, ok: res.ok, error: res.error,
    template: { name: scelta.name, buttons: [] },
  });
  return res;
}

/** Normalizza un numero italiano in formato internazionale (es. 3331234567 → 393331234567). */
export function normalizePhone(raw: string): string {
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('00')) n = n.slice(2);
  // Un cellulare nazionale ha 9 o 10 cifre e inizia per 3; col prefisso 39
  // diventa di 11-12. Attenzione ai numeri che iniziano per 393 (es.
  // 3934324735): quel "39" è parte del numero, NON il prefisso — per questo
  // si guarda la lunghezza e non l'inizio.
  if ((n.length === 10 || n.length === 9) && n.startsWith('3')) n = '39' + n;
  return n;
}

/** Vero se il numero sembra un cellulare italiano valido e contattabile. */
export function isSendablePhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const n = normalizePhone(raw);
  return /^393\d{8,9}$/.test(n);
}
