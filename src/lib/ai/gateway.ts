/**
 * AI Gateway: l'unica porta verso i modelli linguistici.
 *
 * Nessun file fuori da qui importa o chiama un fornitore AI direttamente.
 * Il fornitore e il modello si scelgono con le variabili d'ambiente
 * (AI_PROVIDER, AI_MODEL): cambiare cervello non deve toccare il codice.
 *
 * v1: adapter Anthropic (la chiave c'è già in produzione). L'interfaccia
 * è neutra — messaggi, strumenti, risposta — così l'adapter OpenAI/Google
 * è un file in più, non una riscrittura.
 */

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

const MODELLO = () => process.env.AI_MODEL || 'claude-sonnet-5';

/** Prezzi indicativi $/1M token per il registro costi (aggiornare a listino). */
const PREZZI: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};

interface BloccoAnthropic {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
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
  const chiave = process.env.ANTHROPIC_API_KEY;
  if (!chiave) throw new Error('ANTHROPIC_API_KEY non configurata');

  const modello = MODELLO();
  const strumenti = params.strumenti ?? [];
  const strumentiUsati: string[] = [];
  let costoUsd = 0;

  type Msg = { role: 'user' | 'assistant'; content: unknown };
  const messaggi: Msg[] = params.messaggi.map((m) => ({
    role: m.ruolo === 'cliente' ? 'user' : 'assistant',
    content: m.testo,
  }));

  for (let giro = 0; giro < 4; giro++) {
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': chiave,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modello,
        max_tokens: params.maxToken ?? 700,
        system: params.sistema,
        messages: messaggi,
        tools: strumenti.map((s) => ({
          name: s.nome,
          description: s.descrizione,
          input_schema: s.parametri,
        })),
      }),
    });

    if (!risposta.ok) {
      const errore = await risposta.text().catch(() => '');
      throw new Error(`AI ${risposta.status}: ${errore.slice(0, 200)}`);
    }

    const dati = (await risposta.json()) as {
      content: BloccoAnthropic[];
      stop_reason: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const prezzi = PREZZI[modello] ?? { in: 3, out: 15 };
    costoUsd +=
      ((dati.usage?.input_tokens ?? 0) * prezzi.in + (dati.usage?.output_tokens ?? 0) * prezzi.out) / 1e6;

    if (dati.stop_reason !== 'tool_use') {
      const testo = dati.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { testo, strumentiUsati, modello, costoUsd };
    }

    // Il modello vuole usare gli strumenti: si eseguono e si torna dentro
    messaggi.push({ role: 'assistant', content: dati.content });
    const risultati: unknown[] = [];
    for (const blocco of dati.content) {
      if (blocco.type !== 'tool_use' || !blocco.name) continue;
      const strumento = strumenti.find((s) => s.nome === blocco.name);
      strumentiUsati.push(blocco.name);
      let esito: string;
      try {
        esito = strumento
          ? await strumento.esegui(blocco.input ?? {})
          : 'Strumento non disponibile.';
      } catch (err) {
        esito = `Errore dello strumento: ${(err as Error).message}`;
      }
      risultati.push({ type: 'tool_result', tool_use_id: blocco.id, content: esito });
    }
    messaggi.push({ role: 'user', content: risultati });
  }

  return {
    testo: 'Non sono riuscita a completare il ragionamento: riprova tra un momento.',
    strumentiUsati, modello, costoUsd,
  };
}
