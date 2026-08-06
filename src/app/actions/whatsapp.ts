'use server';

import { prisma } from '@/lib/prisma';
import { waProvider, whatsappMissingVars, sendWhatsApp, sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import {
  listConversations, listMessages, markConversationRead, markConversationUnread, conversationWindow, listUnreadChats,
  clientNameForPhone,
  type WaConversation, type WaMessageRow, type WaUnreadChat,
} from '@/lib/wa-conversations';
import { listD360Templates, createD360Template } from '@/lib/whatsapp360';
import { reviewRedirectUrl } from '@/lib/links';
import { WA_TEMPLATES, type TemplateKey } from '@/lib/wa-templates';
import {
  getWaAutomationsConfig, saveWaAutomationsConfig, runWaAutomations,
  type WaAutomationsConfig, type RunResult,
} from '@/lib/wa-automations';

export async function loadWaConfig(): Promise<WaAutomationsConfig> {
  return getWaAutomationsConfig();
}

export async function saveWaConfig(cfg: WaAutomationsConfig): Promise<{ ok: boolean }> {
  await saveWaAutomationsConfig(cfg);
  return { ok: true };
}

export interface WaStatus {
  provider: '360dialog' | 'evolution' | null;
  missing: string[];
}

export async function loadWaStatus(): Promise<WaStatus> {
  return { provider: waProvider(), missing: whatsappMissingVars() };
}

/**
 * Simulazione: elenca chi verrebbe contattato adesso e con quale testo,
 * senza mandare nulla.
 */
export async function previewAutomation(which: TemplateKey): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: true });
  return res[0] || null;
}

/** Esecuzione reale su richiesta (tasto "Invia ora"). */
export async function runAutomationNow(which: TemplateKey): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: false });
  return res[0] || null;
}

export interface WaInboxMessage {
  phone: string;
  name?: string;
  text: string;
  receivedAt: string;
}

/**
 * Ultimi messaggi ricevuti dai clienti. Serve soprattutto a verificare che il
 * webhook 360dialog sia collegato: se qui non compare nulla dopo aver scritto
 * al numero del centro, il webhook non sta consegnando.
 */
export async function loadWaInbox(limit = 15): Promise<WaInboxMessage[]> {
  const rows = await prisma.adminEntry.findMany({
    where: { kind: 'wa_inbox' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });
  return rows.map(r => {
    const d = (r.data || {}) as { phone?: string; name?: string; text?: string; receivedAt?: string };
    return {
      phone: d.phone || r.entityId || '',
      name: d.name,
      text: d.text || '',
      receivedAt: d.receivedAt || r.createdAt,
    };
  });
}

// ============================================================
// Conversazioni: lettura e risposta manuale
// ============================================================

// Attenzione: in un file 'use server' NON si possono ri-esportare i tipi
// (`export type { ... }`). Next li trasforma in re-export a runtime e, non
// esistendo il simbolo, il modulo esplode in fase di valutazione facendo
// fallire tutte le azioni del file. I tipi si importano da '@/lib/wa-conversations'.

/** Elenco chat, la più recente in cima, con non letti e stato finestra 24h. */
export async function loadConversations(limit = 50): Promise<WaConversation[]> {
  return listConversations(limit);
}

/**
 * Messaggi dei clienti ancora da leggere. Gira in polling da tutto il
 * gestionale: accende il pallino sul menu WhatsApp e, se nessuno risponde,
 * fa scattare l'avviso a schermo.
 */
export async function loadWaUnread(): Promise<WaUnreadChat[]> {
  return listUnreadChats();
}

/** Rimette la conversazione fra quelle da leggere (torna il pallino e l'avviso). */
export async function markConversationUnreadAction(phone: string): Promise<{ ok: boolean }> {
  await markConversationUnread(normalizePhone(phone));
  return { ok: true };
}

/**
 * Thread completo di un numero. Segna anche la conversazione come letta:
 * aprirla in gestionale è esattamente il gesto che azzera i non letti.
 */
export async function loadConversation(phone: string): Promise<{
  messages: WaMessageRow[];
  windowOpen: boolean;
  windowExpiresAt?: string;
  clientName?: string;
}> {
  const normalized = normalizePhone(phone);
  const [messages, win, clientName] = await Promise.all([
    listMessages(normalized),
    conversationWindow(normalized),
    // Il confronto è sulle ultime 9 cifre, ignorando prefissi e spazi: in
    // anagrafica i numeri sono scritti in mille modi diversi.
    clientNameForPhone(normalized),
  ]);
  await markConversationRead(normalized);
  return {
    messages,
    windowOpen: win.open,
    windowExpiresAt: win.expiresAt,
    clientName,
  };
}

/**
 * Risposta scritta a mano dall'operatore.
 *
 * Passa solo entro la finestra 24h: fuori, Meta impone un template approvato e
 * il testo libero verrebbe rifiutato (131047). Meglio dirlo qui che far
 * scrivere un messaggio destinato a non partire.
 */
export async function sendManualReply(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Messaggio vuoto' };
  if (!isSendablePhone(phone)) return { ok: false, error: 'Numero non valido' };

  const normalized = normalizePhone(phone);
  const win = await conversationWindow(normalized);
  if (!win.open) {
    return {
      ok: false,
      error: 'Sono passate più di 24 ore dall\'ultimo messaggio del cliente: Meta non permette più il testo libero. Serve che sia il cliente a riscrivere, oppure un template approvato.',
    };
  }

  const res = await sendWhatsApp(normalized, body, 'manual');
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'Invio fallito' };
}

/**
 * Crea su 360dialog il template della richiesta recensione, col bottone che
 * porta al modulo di Google.
 *
 * Vale solo se il template non esiste ancora: i bottoni Meta li approva
 * insieme al testo, e un template già creato non si modifica da qui (la
 * chiave del canale non arriva alla Partner API di 360dialog). In quel caso
 * torna un errore che dice cosa fare a mano.
 *
 * Appena creato lo stato è PENDING: finché Meta non approva, l'automazione
 * delle recensioni non parte.
 */
export async function creaTemplateRecensione(): Promise<{ ok: boolean; status?: string; error?: string }> {
  const tpl = WA_TEMPLATES.review;
  // Un esempio per ogni {{n}}: senza, Meta rifiuta.
  const example = ['Maria', 'pressoterapia'];
  const buttons = [{ type: 'URL' as const, text: 'Lascia una recensione', url: reviewRedirectUrl() }];

  // Cancellarlo per rifarlo col bottone non è una via d'uscita: Meta blocca
  // il riutilizzo dello stesso nome per 30 giorni, e in quel mese l'automazione
  // delle recensioni resterebbe ferma.
  const remote = await listD360Templates();
  const esistente = remote.ok
    ? remote.templates.find(t => t.name === tpl.name && t.language === tpl.language)
    : undefined;

  if (esistente) {
    return {
      ok: false,
      error:
        `Il template "${tpl.name}" esiste già (${esistente.status}) senza bottone. Con la chiave del canale i ` +
        'template si creano ma non si modificano: la modifica sta sulla Partner API di 360dialog, che vuole ' +
        'un token diverso. Il bottone va aggiunto a mano da 360dialog Hub → Templates, incollando come URL ' +
        `${reviewRedirectUrl()}`,
    };
  }

  const res = await createD360Template({
    name: tpl.name,
    category: tpl.category,
    language: tpl.language,
    body: tpl.body,
    example,
    buttons,
  });
  return res.ok ? { ok: true, status: res.status } : { ok: false, error: res.error };
}

/**
 * Parametri di esempio per provare un template senza avere sotto mano un
 * appuntamento vero. Devono essere quanti quelli approvati: se il numero non
 * combacia Meta risponde 132000 e il messaggio non parte.
 */
const ESEMPI_PARAMETRI: Record<TemplateKey, string[]> = {
  confirm: ['Maria', 'pulizia viso', 'domani', '15:30'],
  reminder: ['Maria', 'pulizia viso', 'domani', '15:30'],
  recall: ['Maria'],
  birthday: ['Maria', 'il 20%', '31/12'],
  review: ['Maria', 'pulizia viso'],
  omaggio: ['Maria', 'pressoterapia'],
};

/**
 * Manda un template a un numero scelto, per vedere com'è fatto davvero.
 *
 * Serve perché "Invia ora" scrive ai clienti veri dell'automazione: per
 * controllare un bottone o un testo appena modificato non si può disturbare
 * chi è venuto ieri. Il messaggio parte per davvero, con parametri finti.
 */
export async function inviaTemplateDiProva(
  phone: string,
  key: TemplateKey
): Promise<{ ok: boolean; error?: string }> {
  if (!isSendablePhone(phone)) return { ok: false, error: 'Numero non valido' };

  const tpl = WA_TEMPLATES[key];
  const params = ESEMPI_PARAMETRI[key];
  const testo = tpl.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? `{{${i}}}`);

  const res = await sendWhatsAppTemplate(normalizePhone(phone), key, {
    bodyParams: params,
    fallbackText: testo,
    source: 'manual',
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error || 'Invio fallito' };
}

export interface TemplateCheck {
  key: TemplateKey;
  name: string;
  category: string;
  /** Stato su 360dialog: APPROVED, PENDING, REJECTED, MISSING. */
  status: string;
  /**
   * Indirizzi dei bottoni nella versione che Meta consegna davvero. Se il
   * bottone è stato aggiunto sul Hub ma la modifica è ancora in revisione, qui
   * non compare: è la differenza fra "l'ho messo" e "arriva ai clienti".
   */
  buttonUrls?: string[];
}

/**
 * Confronta i template del catalogo con quelli davvero approvati su 360dialog.
 * Un'automazione con template MISSING o PENDING non può partire.
 */
export async function checkTemplates(): Promise<{ ok: boolean; error?: string; checks?: TemplateCheck[] }> {
  const remote = await listD360Templates();
  if (!remote.ok) return { ok: false, error: remote.error };

  const checks = (Object.keys(WA_TEMPLATES) as TemplateKey[]).map(key => {
    const tpl = WA_TEMPLATES[key];
    const found = remote.templates.find(t => t.name === tpl.name && t.language === tpl.language);
    // 360dialog risponde in minuscolo ("approved"): senza normalizzare, la UI non
    // riconosce lo stato e mostra la stringa grezza in grigio invece di "Approvato".
    return {
      key, name: tpl.name, category: tpl.category,
      status: (found?.status || 'MISSING').toUpperCase(),
      buttonUrls: found?.buttonUrls,
    };
  });
  return { ok: true, checks };
}
