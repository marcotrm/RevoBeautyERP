/**
 * Parlare con un modello qualunque usando sempre la forma di Anthropic.
 *
 * Il gestionale è scritto in "anthropichese": strumenti con `input_schema`,
 * risposte a blocchi, `tool_use` e `tool_result`. Riscrivere la segretaria per
 * ogni fornitore sarebbe follia — e soprattutto renderebbe impossibile il
 * confronto, perché due modelli con due prompt diversi non si possono mettere
 * uno accanto all'altro e dire quale sbaglia di più.
 *
 * Quindi la forma resta una sola e qui dentro si traduce:
 *
 *   - anthropic  → l'SDK, come sempre;
 *   - zai        → lo stesso SDK con un altro indirizzo: Z.ai espone un
 *                  endpoint che parla il protocollo Anthropic, quindi non
 *                  serve tradurre niente, solo cambiare `baseURL`;
 *   - gemini     → Google non parla anthropichese ma espone un endpoint in
 *                  forma OpenAI: lì la traduzione va fatta a mano, ed è tutta
 *                  in `perGemini` / `daGemini`.
 *
 * Il risultato è sempre la stessa cosa: del testo, zero o più chiamate a
 * strumenti, e quanto è costato.
 */

import Anthropic from '@anthropic-ai/sdk';

export type Fornitore = 'anthropic' | 'zai' | 'gemini' | 'omniroute';

export interface Chiamata {
  id: string;
  nome: string;
  input: unknown;
}

export interface Richiesta {
  model: string;
  /**
   * A blocchi come li vuole Anthropic, o una stringa sola.
   *
   * I blocchi servono alla cache: il pezzo che non cambia mai — istruzioni e
   * strumenti — porta il segnaposto e dal secondo giro costa un decimo. Chi
   * parla in forma OpenAI la cache a blocchi non ce l'ha, e li' i blocchi
   * vengono semplicemente incollati uno dopo l'altro.
   */
  system: string | Anthropic.TextBlockParam[];
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  /**
   * Roba che capisce solo Anthropic: `thinking`, `output_config`.
   *
   * Non e' un di piu' opzionale, e' una trappola: Haiku 4.5 non conosce
   * `effort` e risponde 400 se glielo mandi. Passando da un altro fornitore
   * questi campi non hanno senso e vengono lasciati fuori.
   */
  extra?: Record<string, unknown>;
}

export interface Risposta {
  testo: string;
  chiamate: Chiamata[];
  tokenIn: number;
  tokenOut: number;
  /** Quante volte il fornitore ha detto «riprova» prima di rispondere. */
  ritentativi: number;
}

/**
 * «Riprova più tardi» non è un caso limite: sui piani gratuiti è la risposta
 * normale. Chi vuole sapere se un modello gratuito regge un lavoro vero deve
 * ritentare come ritenterebbe in produzione, altrimenti misura la fortuna e
 * non il modello.
 *
 * Ma i tentativi si contano e finiscono nel referto: un modello che risponde
 * solo al terzo colpo ha comunque lasciato la cliente ad aspettare quindici
 * secondi, e quello è un difetto, non un dettaglio tecnico.
 */
const RITENTA = 3;
const ATTESE_MS = [1500, 4000, 9000];

function daRitentare(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return / 429| 503| 529|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(m);
}

async function insistendo(fai: () => Promise<Risposta>): Promise<Risposta> {
  let ultimo: unknown;
  for (let n = 0; n <= RITENTA; n++) {
    try {
      const r = await fai();
      return { ...r, ritentativi: n };
    } catch (e) {
      ultimo = e;
      if (n === RITENTA || !daRitentare(e)) break;
      await new Promise(ok => setTimeout(ok, ATTESE_MS[n]));
    }
  }
  throw ultimo;
}

/** Da dove si prende la chiave e a quale indirizzo si bussa. */
const CASA: Record<Fornitore, { chiave: string; indirizzo?: string }> = {
  anthropic: { chiave: 'ANTHROPIC_API_KEY' },
  zai: { chiave: 'Z_AI_API', indirizzo: 'https://api.z.ai/api/anthropic' },
  gemini: {
    chiave: 'GEMINI_API_KEY',
    indirizzo: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
  /*
    Il centralino: un indirizzo solo davanti a molti fornitori, che sceglie
    da se' e ripiega su un altro quando uno cade. Serve a non restare mai
    muti — e' successo, un credito finito e la segretaria zitta per un
    giorno intero.

    L'indirizzo e' una variabile perche' e' un servizio del centro, non un
    posto fisso su internet.
  */
  omniroute: {
    chiave: 'OMNIROUTE_API_KEY',
    indirizzo: process.env.OMNIROUTE_URL || '',
  },
};

/** Chi parla la forma di OpenAI invece di quella di Anthropic. */
const FORMA_OPENAI = new Set<Fornitore>(['gemini', 'omniroute']);

export function chiaveMancante(f: Fornitore): boolean {
  return !process.env[CASA[f].chiave];
}

export async function chiedi(f: Fornitore, r: Richiesta): Promise<Risposta> {
  const chiave = process.env[CASA[f].chiave];
  if (!chiave) throw new Error(`Manca ${CASA[f].chiave}`);
  return insistendo(() => (FORMA_OPENAI.has(f) ? viaOpenAI(f, chiave, r) : viaAnthropic(f, chiave, r)));
}

/* ------------------------------------------------------------------ */
/* Anthropic e Z.ai: stessa lingua, indirizzo diverso                   */
/* ------------------------------------------------------------------ */

async function viaAnthropic(f: Fornitore, chiave: string, r: Richiesta): Promise<Risposta> {
  const client = new Anthropic({ apiKey: chiave, baseURL: CASA[f].indirizzo, maxRetries: 1 });

  const risposta = await client.messages.create({
    model: r.model,
    max_tokens: r.maxTokens,
    system: r.system,
    tools: r.tools,
    ...(r.extra || {}),
    messages: r.messages,
  } as Anthropic.MessageCreateParamsNonStreaming);

  return {
    testo: risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim(),
    chiamate: risposta.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ id: b.id, nome: b.name, input: b.input })),
    tokenIn: risposta.usage.input_tokens,
    tokenOut: risposta.usage.output_tokens,
    ritentativi: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Gemini: forma OpenAI, quindi si traduce                              */
/* ------------------------------------------------------------------ */

/**
 * Nomi finti per le chiamate agli strumenti.
 *
 * L'SDK di Anthropic dà un `id` a ogni `tool_use` e si aspetta di ritrovarlo
 * nel `tool_result`. OpenAI fa lo stesso con `tool_call_id`, ma non tutti i
 * cloni lo rimandano indietro: se manca, un id inventato in modo stabile
 * tiene comunque appaiate domanda e risposta.
 */
let contatore = 0;

/**
 * La firma del pensiero di Gemini.
 *
 * Dalla 3 in poi Gemini «pensa» prima di chiamare uno strumento, firma quel
 * ragionamento e attacca la firma alla chiamata in un campo che nel formato
 * OpenAI non esiste: `tool_calls[N].extra_content.google.thought_signature`.
 * Al giro successivo pretende di ritrovarla, e se non c'è rifiuta tutto con
 *
 *     400 Function call is missing a thought_signature in functionCall parts
 *
 * Cioè: il modello risponde benissimo al primo colpo e muore al secondo, che
 * è esattamente dove vive una segretaria — chiedi gli orari, leggi il
 * risultato, rispondi. Ci sono inciampati VS Code, Codex e la libreria
 * ufficiale di OpenAI, tutti per lo stesso motivo: chi ricostruisce la
 * chiamata campo per campo butta via quello che non conosce.
 *
 * Noi la chiamata la ricostruiamo davvero — dentro passa per la forma di
 * Anthropic, che una firma non ce l'ha — quindi la firma si tiene qui a
 * parte, appesa all'id della chiamata. Il tetto serve a non far crescere la
 * mappa all'infinito in un processo che non si spegne mai.
 */
const FIRME = new Map<string, string>();
const MAX_FIRME = 500;

function ricorda(id: string, firma: string | undefined): void {
  if (!firma) return;
  if (FIRME.size >= MAX_FIRME) {
    const primo = FIRME.keys().next();
    if (!primo.done) FIRME.delete(primo.value);
  }
  FIRME.set(id, firma);
}

interface MessaggioOpenAI {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<Record<string, unknown>> | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
    extra_content?: { google: { thought_signature: string } };
  }>;
  tool_call_id?: string;
}

function perOpenAI(r: Richiesta): MessaggioOpenAI[] {
  const sistema = typeof r.system === 'string'
    ? r.system
    : r.system.map(b => b.text).join('\n\n');
  const fuori: MessaggioOpenAI[] = [{ role: 'system', content: sistema }];

  for (const m of r.messages) {
    if (typeof m.content === 'string') {
      fuori.push({ role: m.role, content: m.content });
      continue;
    }

    /*
      Un turno dell'assistente può contenere testo e chiamate insieme; un turno
      della cliente può contenere immagini, testo e i risultati degli strumenti.
      In forma OpenAI queste cose stanno in messaggi separati, quindi un blocco
      di Anthropic può diventare più righe.
    */
    const testo: string[] = [];
    const pezzi: Array<Record<string, unknown>> = [];
    const chiamate: NonNullable<MessaggioOpenAI['tool_calls']> = [];
    const risultati: MessaggioOpenAI[] = [];

    for (const b of m.content) {
      if (b.type === 'text') {
        testo.push(b.text);
        pezzi.push({ type: 'text', text: b.text });
      } else if (b.type === 'image' && b.source.type === 'base64') {
        pezzi.push({
          type: 'image_url',
          image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` },
        });
      } else if (b.type === 'tool_use') {
        const firma = FIRME.get(b.id);
        chiamate.push({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
          ...(firma ? { extra_content: { google: { thought_signature: firma } } } : {}),
        });
      } else if (b.type === 'tool_result') {
        risultati.push({
          role: 'tool',
          tool_call_id: b.tool_use_id,
          content: typeof b.content === 'string'
            ? b.content
            : (b.content || [])
                .map(c => (c.type === 'text' ? c.text : ''))
                .join('\n'),
        });
      }
    }

    if (m.role === 'assistant') {
      if (testo.length > 0 || chiamate.length > 0) {
        fuori.push({
          role: 'assistant',
          content: testo.join('\n') || null,
          ...(chiamate.length > 0 ? { tool_calls: chiamate } : {}),
        });
      }
    } else if (pezzi.length > 0) {
      // Con una sola parte di testo si manda la stringa nuda: alcuni cloni
      // rifiutano l'array quando non ci sono immagini.
      fuori.push({
        role: 'user',
        content: pezzi.length === 1 && pezzi[0].type === 'text'
          ? (pezzi[0].text as string)
          : pezzi,
      });
    }

    fuori.push(...risultati);
  }

  return fuori;
}

function daOpenAI(dati: Record<string, unknown>): Risposta {
  const scelte = (dati.choices as Array<Record<string, unknown>> | undefined) || [];
  const messaggio = (scelte[0]?.message || {}) as Record<string, unknown>;
  const uso = (dati.usage || {}) as Record<string, number>;

  const grezze = (messaggio.tool_calls as Array<Record<string, unknown>> | undefined) || [];
  const chiamate: Chiamata[] = grezze.map(c => {
    const fn = (c.function || {}) as Record<string, string>;
    let input: unknown = {};
    try {
      input = JSON.parse(fn.arguments || '{}');
    } catch {
      // Argomenti non JSON: è un errore del modello, non nostro. Lo si lascia
      // arrivare allo strumento, che risponderà «non ho capito» — ed è
      // esattamente il tipo di sbaglio che il banco di prova deve contare.
      input = { _nonJson: fn.arguments };
    }
    const id = String(c.id || `chiamata_${++contatore}`);
    const extra = (c.extra_content || {}) as { google?: { thought_signature?: string } };
    ricorda(id, extra.google?.thought_signature);
    return { id, nome: String(fn.name || ''), input };
  });

  return {
    testo: typeof messaggio.content === 'string' ? messaggio.content.trim() : '',
    chiamate,
    tokenIn: uso.prompt_tokens || 0,
    tokenOut: uso.completion_tokens || 0,
    ritentativi: 0,
  };
}

async function viaOpenAI(f: Fornitore, chiave: string, r: Richiesta): Promise<Risposta> {
  const risposta = await fetch(`${CASA[f].indirizzo}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: r.model,
      max_tokens: r.maxTokens,
      messages: perOpenAI(r),
      tools: r.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    }),
  });

  const corpo = await risposta.text();
  if (!risposta.ok) {
    throw new Error(`${f} ${risposta.status}: ${corpo.slice(0, 300)}`);
  }

  const esito = daOpenAI(JSON.parse(corpo) as Record<string, unknown>);

  /*
    La spia sulla firma del pensiero.
    
    Se un domani Gemini rifiutasse ancora le chiamate, questa riga dice subito
    di chi e' la colpa: «0 firmate su 2» vuol dire che il campo non arriva e il
    percorso compatibile OpenAI non basta; «2 su 2» vuol dire che la firma c'e'
    e il guasto e' altrove. Senza, si tira a indovinare due volte.
  */
  if (f === 'gemini' && esito.chiamate.length > 0) {
    const firmate = esito.chiamate.filter(c => FIRME.has(c.id)).length;
    console.log(`[gemini] ${esito.chiamate.length} chiamate, ${firmate} con firma del pensiero`);
  }

  return esito;
}
