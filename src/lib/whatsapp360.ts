/**
 * WhatsApp Business Cloud API tramite 360dialog.
 *
 * 360dialog espone la Cloud API di Meta 1:1: cambiano solo l'host e
 * l'autenticazione (header `D360-API-KEY` al posto del Bearer token).
 * Il numero mittente è quello collegato al canale, non si passa nel payload.
 *
 * Variabili d'ambiente richieste:
 *  - D360_API_KEY        chiave API del canale (360dialog Hub → API Settings)
 *  - D360_BASE_URL       opzionale, default https://waba-v2.360dialog.io
 *  - D360_WEBHOOK_TOKEN  segreto per validare il webhook in ingresso
 *
 * Regola Meta da tenere a mente: il testo libero si può mandare SOLO entro 24h
 * dall'ultimo messaggio del cliente. Fuori da quella finestra serve un template
 * approvato (vedi lib/wa-templates.ts).
 */

const DEFAULT_BASE = 'https://waba-v2.360dialog.io';

export function d360Configured(): boolean {
  return Boolean(process.env.D360_API_KEY);
}

export function d360MissingVars(): string[] {
  return process.env.D360_API_KEY ? [] : ['D360_API_KEY'];
}

export interface D360Result {
  ok: boolean;
  messageId?: string;
  status?: number;
  error?: string;
  errorCode?: number;
}

/** Messaggi d'errore Meta tradotti in italiano comprensibile. */
function explainMetaError(code: number | undefined, fallback: string): string {
  switch (code) {
    case 131047:
    case 131026:
      return 'Fuori dalla finestra 24h: serve un template approvato, non testo libero.';
    case 132000:
      return 'Numero di parametri del template diverso da quello approvato.';
    case 132001:
      // Meta dice "does not exist" anche per un template che esiste ma è ancora
      // in revisione: senza questa precisazione si va a cercare un errore di nome
      // o di lingua che non c'è.
      return 'Template non utilizzabile: o non esiste con questo nome/lingua, oppure esiste ma è ancora in revisione da parte di Meta. Controlla lo stato con "Verifica": se è PENDING, va solo aspettato.';
    case 132005:
      return 'Un parametro del template è troppo lungo o contiene a capo/emoji non ammessi.';
    case 131051:
      return 'Tipo di messaggio non supportato dal destinatario.';
    case 131052:
      return 'Il numero destinatario non è su WhatsApp.';
    case 130472:
      return 'Utente escluso dall\'esperimento marketing di Meta: messaggio non consegnabile.';
    case 131056:
      return 'Troppi messaggi verso questo numero in poco tempo: riprova più tardi.';
    case 401:
      return 'D360_API_KEY non valida.';
    case 403:
      return 'Invio non autorizzato dal canale (403). Di solito: canale non ancora abilitato all\'invio, verifica dell\'attività su Meta non completata, o limite di destinatari del numero non verificato.';
    default:
      return fallback;
  }
}

async function d360Post(path: string, payload: unknown): Promise<D360Result> {
  if (!d360Configured()) {
    return { ok: false, error: 'WhatsApp non configurato: manca D360_API_KEY' };
  }
  const base = (process.env.D360_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': process.env.D360_API_KEY as string,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const code = body?.error?.code as number | undefined;
      // Il corpo di 360dialog non ha sempre error.message: senza questo fallback
      // l'unica traccia del motivo reale resta nei log del server.
      const raw = body ? JSON.stringify(body).slice(0, 300) : '';
      const detail = body?.error?.error_data?.details || body?.error?.message
        || (raw ? `HTTP ${res.status} — ${raw}` : `HTTP ${res.status}`);
      console.error('[wa360] errore', res.status, JSON.stringify(body));
      // 360dialog blocca l'invio (ma non la ricezione) quando il canale è insoluto,
      // e lo comunica solo come stringa libera: senza questo caso si legge come un
      // generico problema di autorizzazione.
      if (/lack of payment|blocked due to/i.test(raw)) {
        return {
          ok: false,
          status: res.status,
          error: 'Canale 360dialog bloccato per mancato pagamento: l\'invio è sospeso (la ricezione continua). Regolarizza la posizione su 360dialog Hub → Billing.',
        };
      }

      const explained = explainMetaError(code ?? res.status, detail);
      // Se abbiamo tradotto il codice, alleghiamo comunque il dettaglio grezzo:
      // è quello che serve per capire un 403 senza aprire i log.
      return {
        ok: false,
        status: res.status,
        errorCode: code,
        error: explained === detail ? explained : `${explained} [${detail}]`,
      };
    }

    return { ok: true, status: res.status, messageId: body?.messages?.[0]?.id };
  } catch (err) {
    console.error('[wa360] fetch fallita', err);
    return { ok: false, error: 'Connessione a 360dialog fallita' };
  }
}

/**
 * Testo libero. Funziona solo entro 24h dall'ultimo messaggio del cliente
 * (finestra di servizio). Fuori dalla finestra Meta risponde 131047.
 */
export async function sendD360Text(to: string, text: string): Promise<D360Result> {
  return d360Post('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

export interface TemplateSendOptions {
  /** Parametri posizionali {{1}}, {{2}}, ... del corpo del template. */
  bodyParams?: string[];
  /** Suffisso dinamico per un bottone URL (se il template lo prevede). */
  buttonUrlSuffix?: string;
  language?: string;
}

/** Invia un template approvato. È l'unica via per contattare a freddo. */
export async function sendD360Template(
  to: string,
  templateName: string,
  opts: TemplateSendOptions = {}
): Promise<D360Result> {
  const components: unknown[] = [];

  if (opts.bodyParams?.length) {
    components.push({
      type: 'body',
      parameters: opts.bodyParams.map(text => ({ type: 'text', text })),
    });
  }
  if (opts.buttonUrlSuffix) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: opts.buttonUrlSuffix }],
    });
  }

  return d360Post('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: opts.language || 'it' },
      ...(components.length ? { components } : {}),
    },
  });
}

/** Segna come letto un messaggio in ingresso (spunte blu lato cliente). */
export async function markD360Read(messageId: string): Promise<D360Result> {
  return d360Post('/messages', { messaging_product: 'whatsapp', status: 'read', message_id: messageId });
}

/** Elenca i template del canale con il loro stato di approvazione. */
export async function listD360Templates(): Promise<
  { ok: true; templates: Array<{ name: string; status: string; category: string; language: string }> } | { ok: false; error: string }
> {
  if (!d360Configured()) return { ok: false, error: 'Manca D360_API_KEY' };
  const base = (process.env.D360_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/v1/configs/templates`, {
      headers: { 'D360-API-KEY': process.env.D360_API_KEY as string },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error?.message || `HTTP ${res.status}` };
    type Raw = { name?: string; status?: string; category?: string; language?: string };
    const templates = (body?.waba_templates || body?.data || []).map((t: Raw) => ({
      name: t.name || '',
      status: t.status || 'UNKNOWN',
      category: t.category || '',
      language: t.language || '',
    }));
    return { ok: true, templates };
  } catch {
    return { ok: false, error: 'Connessione a 360dialog fallita' };
  }
}
