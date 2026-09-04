/**
 * AI Gateway dell'app clienti: la porta unica di Revo AI verso i modelli.
 *
 * Non parla con nessun fornitore direttamente: delega a lib/fornitori, lo
 * stesso centralino della segretaria WhatsApp — con lo stesso ripiego che
 * le ha già salvato la voce una volta (un credito finito, un giorno di
 * silenzio). Se il fornitore scelto non ha la chiave o non risponde, si
 * prova il successivo: Revo non resta mai muta per una riga di configurazione.
 *
 * Fornitore: AI_FORNITORE, altrimenti WA_FORNITORE (così l'app segue la
 * segretaria senza doppia configurazione). Modello: AI_MODEL, altrimenti
 * il modello «di lavoro» del centralino — Revo legge e consiglia, non
 * scrive in agenda: il livello economico basta.
 */

import type Anthropic from '@anthropic-ai/sdk';

import { chiedi as chiediFornitore, chiaveMancante, type Fornitore } from '@/lib/fornitori';
import { modelloPer } from '@/lib/orchestrazione';

export interface StrumentoAI {
  nome: string;
  descrizione: string;
  /** JSON Schema dei parametri. */
  parametri: Record<string, unknown>;
  esegui: (input: Record<string, unknown>) => Promise<string>;
}

export interface MessaggioAI {
  ruolo: 'cliente' | 'revo';
  testo: string;
}

export interface RispostaAI {
  testo: string;
  strumentiUsati: string[];
  modello: string;
  costoUsd: number;
}

/** Prezzi indicativi $/1M token, per il registro spese (stima, non fattura). */
const PREZZI: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

/** La catena dei fornitori: lo scelto, poi chiunque abbia la chiave. */
function catenaFornitori(): Fornitore[] {
  const scelto = String(process.env.AI_FORNITORE || process.env.WA_FORNITORE || 'anthropic')
    .toLowerCase() as Fornitore;
  const tutti: Fornitore[] = [scelto, 'omniroute', 'gemini', 'anthropic'];
  const catena: Fornitore[] = [];
  for (const f of tutti) {
    if (!catena.includes(f) && !chiaveMancante(f)) catena.push(f);
  }
  return catena;
}

function modelloDi(fornitore: Fornitore): string {
  return process.env.AI_MODEL || modelloPer('lavoro', fornitore);
}

/**
 * Una conversazione con strumenti: il modello può chiamarli (fino a 4 giri),
 * i risultati tornano dentro, alla fine esce il testo per la cliente.
 */
export async function chiedi(params: {
  sistema: string;
  messaggi: MessaggioAI[];
  strumenti?: StrumentoAI[];
  maxToken?: number;
}): Promise<RispostaAI> {
  const catena = catenaFornitori();
  if (catena.length === 0) throw new Error('Nessun fornitore AI con la chiave configurata');

  const tools: Anthropic.Tool[] = (params.strumenti ?? []).map((s) => ({
    name: s.nome,
    description: s.descrizione,
    input_schema: s.parametri as Anthropic.Tool['input_schema'],
  }));

  const messaggi: Anthropic.MessageParam[] = params.messaggi.map((m) => ({
    role: m.ruolo === 'cliente' ? 'user' : 'assistant',
    content: m.testo,
  }));

  let ultimoErrore: Error | null = null;
  for (const fornitore of catena) {
    const modello = modelloDi(fornitore);
    try {
      return await giroConStrumenti(fornitore, modello, params, tools, [...messaggi]);
    } catch (err) {
      ultimoErrore = err as Error;
      console.warn(`[revo-ai] ${fornitore} non risponde (${ultimoErrore.message.slice(0, 120)}): provo il prossimo`);
    }
  }
  throw ultimoErrore ?? new Error('Nessun fornitore AI ha risposto');
}

async function giroConStrumenti(
  fornitore: Fornitore,
  modello: string,
  params: { sistema: string; strumenti?: StrumentoAI[]; maxToken?: number },
  tools: Anthropic.Tool[],
  messaggi: Anthropic.MessageParam[]
): Promise<RispostaAI> {
  const strumentiUsati: string[] = [];
  let costoUsd = 0;
  const prezzi = PREZZI[modello] ?? { in: 2, out: 10 };

  for (let giro = 0; giro < 4; giro++) {
    const r = await chiediFornitore(fornitore, {
      model: modello,
      system: params.sistema,
      tools,
      messages: messaggi,
      maxTokens: params.maxToken ?? 700,
    });
    costoUsd += (r.tokenIn * prezzi.in + r.tokenOut * prezzi.out) / 1e6;

    if (r.chiamate.length === 0) {
      return { testo: r.testo, strumentiUsati, modello: `${fornitore}/${modello}`, costoUsd };
    }

    // Il modello vuole gli strumenti: si eseguono e si rientra nel giro
    messaggi.push({
      role: 'assistant',
      content: [
        ...(r.testo ? [{ type: 'text' as const, text: r.testo }] : []),
        ...r.chiamate.map((c) => ({
          type: 'tool_use' as const,
          id: c.id,
          name: c.nome,
          input: c.input,
        })),
      ],
    });

    const risultati: Anthropic.ToolResultBlockParam[] = [];
    for (const c of r.chiamate) {
      const strumento = (params.strumenti ?? []).find((s) => s.nome === c.nome);
      strumentiUsati.push(c.nome);
      let esito: string;
      try {
        esito = strumento
          ? await strumento.esegui((c.input ?? {}) as Record<string, unknown>)
          : 'Strumento non disponibile.';
      } catch (err) {
        esito = `Errore dello strumento: ${(err as Error).message}`;
      }
      risultati.push({ type: 'tool_result', tool_use_id: c.id, content: esito });
    }
    messaggi.push({ role: 'user', content: risultati });
  }

  return {
    testo: 'Non sono riuscita a completare il ragionamento: riprova tra un momento.',
    strumentiUsati,
    modello: `${fornitore}/${modello}`,
    costoUsd,
  };
}
