'use server';

import { prisma } from '@/lib/prisma';
import { waProvider, whatsappMissingVars, sendWhatsApp, sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import {
  listConversations, listMessages, markConversationRead, markConversationUnread, cancellaConversazione, segnaGestita, conversationWindow, listUnreadChats,
  clientNameForPhone, logOutbound,
  type WaConversation, type WaMessageRow, type WaUnreadChat,
} from '@/lib/wa-conversations';
import { listD360Templates, createD360Template, sendD360Template } from '@/lib/whatsapp360';
import { reviewRedirectUrl } from '@/lib/links';
import { WA_TEMPLATES, templateButtonLabels, type TemplateKey } from '@/lib/wa-templates';
import { chiaveRichiestaRecensione } from '@/lib/wa-automations';
import {
  getWaAutomationsConfig, saveWaAutomationsConfig, runWaAutomations,
  type WaAutomationsConfig, type RunResult,
} from '@/lib/wa-automations';
import { passaggioInCorso, riprendiSegretaria, spegniSegretaria, zittiscilaPerUnaPersona } from '@/lib/wa-segretaria';

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
export async function previewAutomation(which: TemplateKey, giro: 1 | 2 = 1): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: true, giro });
  return res[0] || null;
}

/** Esecuzione reale su richiesta (tasto "Invia ora"). */
export async function runAutomationNow(which: TemplateKey, giro: 1 | 2 = 1): Promise<RunResult | null> {
  const res = await runWaAutomations({ which, force: true, dryRun: false, giro });
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
export async function loadConversations(limit = 300): Promise<WaConversation[]> {
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
  /** Foto della scheda cliente: Meta non dà quella del profilo WhatsApp. */
  clientAvatar?: string;
}> {
  const normalized = normalizePhone(phone);
  const [messages, win, scheda] = await Promise.all([
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
    clientName: scheda?.nome,
    clientAvatar: scheda?.avatar,
  };
}

/**
 * Risposta scritta a mano dall'operatore.
 *
 * Passa solo entro la finestra 24h: fuori, Meta impone un template approvato e
 * il testo libero verrebbe rifiutato (131047). Meglio dirlo qui che far
 * scrivere un messaggio destinato a non partire.
 */
/**
 * Scrive per primi a un cliente che non ci ha mai scritto.
 *
 * Meta lascia iniziare una conversazione solo con un template approvato: il
 * testo libero vale nelle 24 ore dopo un messaggio del cliente, e prima di
 * quel messaggio quelle 24 ore non esistono. Quindi qui si manda un template,
 * scelto fra quelli approvati sul canale.
 *
 * Attenzione a cosa NON fa: mandare il template non apre la finestra. Finché
 * il cliente non risponde, il testo libero resta bloccato — è così per tutti,
 * non è un limite del gestionale.
 */
export async function apriConversazione(params: {
  phone: string;
  /** Nome del template approvato, come compare in Marketing. */
  templateName: string;
  language?: string;
  /** Valori dei segnaposto, in ordine: il primo è di solito il nome. */
  bodyParams?: string[];
  /** Il testo coi segnaposto già risolti: è quello che finisce in archivio. */
  anteprima: string;
}): Promise<{ ok: boolean; error?: string; phone?: string }> {
  if (!isSendablePhone(params.phone)) return { ok: false, error: 'Numero non valido' };
  if (!params.templateName) return { ok: false, error: 'Scegli un messaggio approvato' };

  const numero = normalizePhone(params.phone);
  const res = await sendD360Template(numero, params.templateName, {
    language: params.language || 'it',
    bodyParams: params.bodyParams?.length ? params.bodyParams : undefined,
  });

  // In archivio va il testo che il cliente legge, non il nome tecnico: è quello
  // che l'operatrice deve ritrovare riaprendo la chat.
  await logOutbound({
    phone: numero,
    text: params.anteprima || `[template ${params.templateName}]`,
    source: 'manual',
    messageId: res.messageId,
    ok: res.ok,
    error: res.error,
    template: { name: params.templateName },
  });

  return res.ok ? { ok: true, phone: numero } : { ok: false, error: res.error || 'Invio fallito' };
}

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
  if (!res.ok) return { ok: false, error: res.error || 'Invio fallito' };

  /*
    Da qui in poi parla una persona, e la segretaria sta fuori.

    Il conto riparte a ogni messaggio scritto a mano: se la pausa restasse
    ancorata al momento del passaggio, una conversazione lunga con una collega
    se la vedrebbe scadere addosso, col bot che rientra a metà discorso. Per
    farla tornare prima c'è il pulsante nella chat.
  */
  await zittiscilaPerUnaPersona(normalized).catch(() => {});
  return { ok: true };
}

/** Se la segretaria tace su questo numero, da quando e perché. */
export async function statoSegretaria(phone: string): Promise<{
  muta: boolean;
  spenta: boolean;
  fino?: string;
  motivo?: string;
}> {
  return passaggioInCorso(normalizePhone(phone));
}

/** Spegne la segretaria su questa conversazione soltanto, finché non la si riaccende. */
export async function spegniSegretariaAction(phone: string): Promise<{ ok: boolean }> {
  await spegniSegretaria(normalizePhone(phone));
  return { ok: true };
}

/** Ridà la parola alla segretaria su questo numero, senza aspettare la scadenza. */
export async function riprendiSegretariaAction(phone: string): Promise<{ ok: boolean }> {
  await riprendiSegretaria(normalizePhone(phone));
  return { ok: true };
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
  // Si crea la versione col bottone (`reviewV2`): la prima, senza link, è già
  // approvata e non si può più toccare.
  const tpl = WA_TEMPLATES.reviewV2;
  // Un esempio per ogni {{n}}: senza, Meta rifiuta.
  const example = ['Maria', 'pressoterapia'];
  // L'etichetta viene dal catalogo, così creazione, anteprima e archivio
  // raccontano tutti lo stesso bottone.
  const etichetta = tpl.buttons?.[0]?.text || 'Lascia una recensione';
  const buttons = [{ type: 'URL' as const, text: etichetta, url: reviewRedirectUrl() }];

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
      status: esistente.status,
      error:
        `Il template "${tpl.name}" esiste già ed è ${esistente.status}. ` +
        (esistente.status === 'APPROVED'
          ? 'Va bene così: la campagna recensioni lo usa già.'
          : 'Aspetta che Meta lo approvi, di solito ci vogliono pochi minuti.'),
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
  listino: ['Maria'],
  listinoV2: ['Maria'],
  confirm: ['Maria', 'pulizia viso', 'domani', '15:30'],
  spostato: ['Maria', 'pulizia viso', 'domani', '15:45'],
  reminder: ['Maria', 'pulizia viso', 'domani', '15:30'],
  recall: ['Maria'],
  birthday: ['Maria', 'il 20%', '31/12'],
  copriBuchi: ['Maria', 'Refill unghie', 'oggi alle 16:30'],
  copriBuchiPreso: ['Maria'],
  reviewV2: ['Maria', 'pulizia viso'],
  affiliatoIncasso: ['Raffaele', '50,00 €', '5,00 €'],
  affiliatoMese: ['Raffaele', 'luglio', '48,50 €', '4 persone'],
  review: ['Maria', 'pulizia viso'],
  reviewV3: ['Maria', 'pulizia viso'],
  omaggio: ['Maria', 'pressoterapia'],
  codiceApp: ['123456'],
  buonoRegalo: ['Maria', 'Giulia', '50,00 €', 'RB-2026-AB12', '31/12/2027'],
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
): Promise<{ ok: boolean; error?: string; nome?: string }> {
  if (!isSendablePhone(phone)) {
    console.warn(`[prova] numero scartato prima di partire: "${phone}"`);
    return { ok: false, error: `Numero non valido: "${phone}"` };
  }
  if (!waProvider()) {
    return { ok: false, error: `WhatsApp non configurato: mancano ${whatsappMissingVars().join(', ')}` };
  }

  /*
    La prova deve far arrivare lo stesso messaggio che ricevono le clienti.
    Per la recensione ce ne sono due — quello vecchio senza bottone e quello
    col link — e la prova mandava sempre il vecchio: si controllava una cosa
    diversa da quella che parte davvero, che è il modo migliore per credere
    che vada tutto bene.
  */
  if (key === 'review') key = (await chiaveRichiestaRecensione()).chiave;

  const tpl = WA_TEMPLATES[key];
  const params = ESEMPI_PARAMETRI[key];
  const testo = tpl.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? `{{${i}}}`);
  const numero = normalizePhone(phone);

  /*
    La prova che "non parte e non dice niente" è il caso peggiore: non si sa se
    è colpa del numero, del template o di Meta. Qui si scrive nei log del server
    cosa si è provato a mandare e cosa ha risposto WhatsApp, e l'errore vero
    torna su fino alla schermata invece di finire in un `ok: false` muto.
  */
  try {
    const res = await sendWhatsAppTemplate(numero, key, {
      bodyParams: params,
      fallbackText: testo,
      source: 'manual',
    });
    console.log(`[prova] ${tpl.name} → ${numero}: ${res.ok ? 'accettato da WhatsApp' : `RIFIUTATO — ${res.error}`}`);
    return res.ok
      ? { ok: true, nome: tpl.name }
      : { ok: false, nome: tpl.name, error: res.error || 'Invio fallito' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[prova] ${tpl.name} → ${numero}: eccezione — ${msg}`);
    return { ok: false, nome: tpl.name, error: msg };
  }
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
  /** Testo della versione attiva su 360dialog, coi segnaposto {{n}}. */
  remoteBody?: string;
  remoteFooter?: string;
  /** Bottoni della versione attiva, in forma leggibile. */
  remoteButtons?: string[];
  /** Testo che il catalogo del gestionale si aspetta. */
  localBody: string;
  /** Bottoni che il catalogo si aspetta. */
  localButtons?: string[];
  /**
   * Vero se il testo su 360dialog e quello del catalogo non coincidono. Non è
   * un errore di per sé (qualcuno può aver ritoccato il testo sul Hub), ma è
   * l'unica spia che il messaggio consegnato non è quello che si legge qui.
   */
  diverso?: boolean;
}

/** Un template che sta sul canale ma non nel catalogo del gestionale. */
export interface TemplateExtra {
  name: string;
  status: string;
  category: string;
  language: string;
  body?: string;
  footer?: string;
  buttons?: string[];
}

/** Normalizza per il confronto: gli a capo e gli spazi doppi non contano. */
function normalizzaTesto(s: string | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Confronta i template del catalogo con quelli davvero approvati su 360dialog,
 * e riporta anche il testo di entrambi.
 *
 * Il solo stato non basta: un template può essere "Approvato" e consegnare
 * comunque qualcosa di diverso da quello che il gestionale mostra, perché la
 * versione attiva su Meta e il catalogo interno sono due cose distinte. Vedere
 * i due testi affiancati è l'unico modo, da qui, di sapere cosa riceve davvero
 * un cliente.
 */
export async function checkTemplates(): Promise<{
  ok: boolean; error?: string; checks?: TemplateCheck[]; extra?: TemplateExtra[];
}> {
  const remote = await listD360Templates();
  if (!remote.ok) return { ok: false, error: remote.error };

  const leggibile = (b: { type: string; text?: string; url?: string }) =>
    b.url ? `${b.text || 'Apri'} → ${b.url}` : `${b.text || ''} (${b.type === 'QUICK_REPLY' ? 'risposta rapida' : b.type})`;

  const checks: TemplateCheck[] = (Object.keys(WA_TEMPLATES) as TemplateKey[]).map(key => {
    const tpl = WA_TEMPLATES[key];
    const found = remote.templates.find(t => t.name === tpl.name && t.language === tpl.language);
    // 360dialog risponde in minuscolo ("approved"): senza normalizzare, la UI non
    // riconosce lo stato e mostra la stringa grezza in grigio invece di "Approvato".
    return {
      key, name: tpl.name, category: tpl.category,
      status: (found?.status || 'MISSING').toUpperCase(),
      buttonUrls: found?.buttonUrls,
      remoteBody: found?.body,
      remoteFooter: found?.footer,
      remoteButtons: found?.buttons?.map(leggibile),
      localBody: tpl.body,
      localButtons: templateButtonLabels(key),
      // Solo se il template esiste: un MISSING è già segnalato dallo stato.
      diverso: found?.body ? normalizzaTesto(found.body) !== normalizzaTesto(tpl.body) : undefined,
    };
  });

  // I template creati direttamente sul Hub o dalle campagne non stanno nel
  // catalogo: senza questo elenco, dal gestionale risultavano invisibili.
  // `Set<string>` esplicito: senza, i nomi del catalogo diventano tipi letterali
  // e `has()` rifiuta una stringa qualunque come quella che arriva da 360dialog.
  const nomiCatalogo = new Set<string>(Object.values(WA_TEMPLATES).map(t => t.name));
  const extra: TemplateExtra[] = remote.templates
    .filter(t => !nomiCatalogo.has(t.name))
    .map(t => ({
      name: t.name,
      status: (t.status || 'UNKNOWN').toUpperCase(),
      category: t.category,
      language: t.language,
      body: t.body,
      footer: t.footer,
      buttons: t.buttons?.map(leggibile),
    }));

  return { ok: true, checks, extra };
}

/**
 * Toglie una conversazione dall'archivio del gestionale.
 *
 * Non è una funzione di pulizia estetica: i numeri sbagliati e lo spam
 * restavano in elenco marchiati DA RISPONDERE, e sporcavano l'unica lista che
 * deve restare pulita. Non tocca la chat sul telefono della persona né la sua
 * scheda cliente, e non si torna indietro.
 */
export async function eliminaConversazione(phone: string): Promise<{ ok: boolean; eliminati: number }> {
  const res = await cancellaConversazione(phone);
  return { ok: true, eliminati: res.eliminati };
}

/**
 * "Ho letto": toglie la conversazione dai da rispondere senza scrivere.
 *
 * Serve quando la cliente è stata richiamata al telefono o quando il messaggio
 * non chiedeva niente. Vale fino a adesso: se lei riscrive, la chat torna in
 * lista.
 */
export async function segnaConversazioneGestita(phone: string): Promise<{ ok: boolean }> {
  await segnaGestita(normalizePhone(phone));
  return { ok: true };
}

/**
 * Manda in approvazione i due messaggi per gli affiliati.
 *
 * Come per la recensione: finché Meta non li approva non parte niente, e un
 * template già esistente non si modifica da qui — in quel caso si dice cosa
 * c'è e a che punto sta, invece di fallire in silenzio.
 */
/**
 * Manda in approvazione il messaggio dello spostamento.
 *
 * Finché Meta non l'ha approvato non si perde niente: al suo posto parte la
 * conferma, che l'orario nuovo ce l'ha comunque. Con questo approvato, però,
 * la cliente legge "abbiamo spostato" e capisce al primo colpo.
 */
export async function creaTemplateSpostamento(): Promise<{ ok: boolean; stato?: string; nota?: string; error?: string }> {
  const tpl = WA_TEMPLATES.spostato;
  const remote = await listD360Templates();
  if (remote.ok) {
    const gia = remote.templates.find(t => t.name === tpl.name && t.language.toLowerCase().startsWith('it'));
    if (gia) return { ok: true, stato: gia.status, nota: gia.status === 'APPROVED' ? 'pronto' : 'in attesa di Meta' };
  }
  const esempi = ['Maria', 'pulizia viso', 'giovedì 21 agosto', '15:45'];
  const res = await createD360Template({
    name: tpl.name, category: tpl.category, language: tpl.language, body: tpl.body, example: esempi,
  });
  return res.ok
    ? { ok: true, stato: res.status || 'PENDING', nota: 'mandato a Meta' }
    : { ok: false, error: res.error };
}

export async function creaTemplateAffiliati(): Promise<{ nome: string; stato: string; nota?: string }[]> {
  const chiavi = ['affiliatoIncasso', 'affiliatoMese'] as const;
  const remote = await listD360Templates();
  const esistenti = remote.ok ? remote.templates : [];

  const esiti: { nome: string; stato: string; nota?: string }[] = [];
  for (const k of chiavi) {
    const tpl = WA_TEMPLATES[k];
    const gia = esistenti.find(t => t.name === tpl.name && t.language === tpl.language);
    if (gia) {
      esiti.push({ nome: tpl.name, stato: gia.status, nota: gia.status === 'APPROVED' ? 'pronto' : 'in attesa di Meta' });
      continue;
    }
    // Un esempio per ogni {{n}}: senza, Meta rifiuta il template.
    const esempi = tpl.params.map((_, i) => (i === 0 ? 'Raffaele' : i === 1 ? '50,00 €' : '5,00 €'));
    const res = await createD360Template({
      name: tpl.name, category: tpl.category, language: tpl.language, body: tpl.body, example: esempi,
    });
    esiti.push(res.ok
      ? { nome: tpl.name, stato: res.status || 'PENDING', nota: 'mandato a Meta' }
      : { nome: tpl.name, stato: 'ERRORE', nota: res.error });
  }
  return esiti;
}
