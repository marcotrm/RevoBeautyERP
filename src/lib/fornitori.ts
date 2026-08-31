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

export type Fornitore = 'anthropic' | 'zai' | 'gemini';

export interface Chiamata {
  id: string;
  nome: string;
  input: unknown;
}

export interface Richiesta {
  model: string;
  system: string;
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
  maxTokens: number;
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
};

export function chiaveMancante(f: Fornitore): boolean {
  return !process.env[CASA[f].chiave];
}

export async function chiedi(f: Fornitore, r: Richiesta): Promise<Risposta> {
  const chiave = process.env[CASA[f].chiave];
  if (!chiave) throw new Error(`Manca ${CASA[f].chiave}`);
  return insistendo(() => (f === 'gemini' ? viaGemini(chiave, r) : viaAnthropic(f, chiave, r)));
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
    messages: r.messages,
  });

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

interface MessaggioOpenAI {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | Array<Record<string, unknown>> | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

function perGemini(r: Richiesta): MessaggioOpenAI[] {
  const fuori: MessaggioOpenAI[] = [{ role: 'system', content: r.system }];

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
        chiamate.push({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
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

function daGemini(dati: Record<string, unknown>): Risposta {
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
    return { id: String(c.id || `chiamata_${++contatore}`), nome: String(fn.name || ''), input };
  });

  return {
    testo: typeof messaggio.content === 'string' ? messaggio.content.trim() : '',
    chiamate,
    tokenIn: uso.prompt_tokens || 0,
    tokenOut: uso.completion_tokens || 0,
    ritentativi: 0,
  };
}

async function viaGemini(chiave: string, r: Richiesta): Promise<Risposta> {
  const risposta = await fetch(`${CASA.gemini.indirizzo}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: r.model,
      max_tokens: r.maxTokens,
      messages: perGemini(r),
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
    throw new Error(`Gemini ${risposta.status}: ${corpo.slice(0, 300)}`);
  }

  return daGemini(JSON.parse(corpo) as Record<string, unknown>);
}
