/**
 * Il banco di prova: lo stesso lavoro, tre modelli, gli stessi numeri.
 *
 * La domanda vera non è «quale modello è più bravo» in astratto, è «quale
 * modello sa fare la segretaria di RevoBeauty senza combinare guai». E quella
 * risposta non si ottiene leggendo i benchmark: si ottiene facendo fare a
 * ognuno lo stesso identico turno — stesse istruzioni, stessi strumenti,
 * stessa cliente — e contando gli sbagli.
 *
 * Cosa si conta, in ordine di gravità:
 *
 *   1. ORARI INVENTATI. È lo sbaglio che è già costato: «Mariarosaria ha posto
 *      alle 11:00» con Mariarosaria occupata. Qui si usa lo stesso identico
 *      controllo della segretaria vera (`orariIn`), quindi il numero non è una
 *      stima: è quante volte quel messaggio NON sarebbe partito.
 *   2. GIRI NON CHIUSI. Il modello che continua a chiamare strumenti senza mai
 *      arrivare a una risposta lascia la cliente ad aspettare.
 *   3. STRUMENTI SBAGLIATI. Chiamare un attrezzo che non esiste, o passarci
 *      dentro argomenti che non sono nemmeno JSON.
 *   4. TEMPO e TOKEN.
 *
 * Nessuno di questi giri tocca l'agenda. Gli strumenti che scrivono sono
 * sostituiti da finte che rispondono «fatto» senza fare niente: si vuole
 * sapere SE il modello ci arriva e con quali dati, non riempire il calendario
 * di appuntamenti per Signora Prova.
 */

import { costruisciIstruzioni } from './istruzioniAssistente';
import {
  strumentiPer,
  limitiDiOggi,
  orariIn,
  esegui,
  type Contesto,
  type Poteri,
} from './wa-segretaria';
import { chiedi, chiaveMancante, type Fornitore, type Richiesta } from './fornitori';
import type Anthropic from '@anthropic-ai/sdk';

/** Come nel turno vero: oltre questo si è persi. */
const MAX_GIRI = 8;

/** Un numero che in rubrica non c'è: ogni modello parte dalle stesse condizioni. */
const NUMERO_DI_PROVA = '+390000000000';

/** Gli strumenti che scrivono davvero. Qui rispondono, ma non fanno niente. */
const FINTE: Record<string, (input: Record<string, unknown>) => string> = {
  prenota: i => JSON.stringify({
    ok: true,
    banco: true,
    nota: 'Appuntamento NON scritto: siamo al banco di prova.',
    ricevuto: i,
  }),
  sposta_appuntamento: i => JSON.stringify({ ok: true, banco: true, ricevuto: i }),
  disdici_appuntamento: i => JSON.stringify({ ok: true, banco: true, ricevuto: i }),
  passa_a_persona: i => JSON.stringify({ ok: true, banco: true, ricevuto: i }),
};

export interface Concorrente {
  /** Come lo chiamiamo nel referto. */
  nome: string;
  fornitore: Fornitore;
  model: string;
}

/**
 * I concorrenti di partenza: quello che paghiamo oggi contro i due gratuiti.
 *
 * Haiku è il metro, non il favorito: è il modello che regge già la maggior
 * parte delle battute. Se un gratuito lo pareggia sui numeri qui sotto, il
 * discorso è chiuso a suo favore.
 */
export const CONCORRENTI: Concorrente[] = [
  {
    nome: 'Haiku 4.5 (oggi, a pagamento)',
    fornitore: 'anthropic',
    model: process.env.BANCO_ANTHROPIC_MODEL || 'claude-haiku-4-5',
  },
  {
    nome: 'Gemini Flash (gratis)',
    fornitore: 'gemini',
    model: process.env.BANCO_GEMINI_MODEL || 'gemini-3-flash',
  },
  {
    nome: 'GLM Flash (gratis)',
    fornitore: 'zai',
    model: process.env.BANCO_ZAI_MODEL || 'glm-4.7-flash',
  },
];

export interface Caso {
  nome: string;
  /** I messaggi della cliente, uno per turno, in ordine. */
  battute: string[];
  /** Cosa deve succedere perché il turno sia andato bene. */
  atteso: string;
}

/**
 * I casi. Non sono inventati: sono le cose che le clienti scrivono davvero, e
 * il primo è il guaio che ci è costato la porta sugli orari.
 */
export const CASI: Caso[] = [
  {
    nome: 'Orario con operatrice (il caso Mariarosaria)',
    battute: ['ciao avete posto domani pomeriggio con mariarosaria?'],
    atteso: 'Chiama quando_c_e_posto e dice SOLO gli orari usciti dallo strumento.',
  },
  {
    nome: 'Prezzo di listino',
    battute: ['buongiorno quanto costa la ceretta totale?'],
    atteso: 'Chiama listino e riporta il prezzo vero, senza arrotondare né inventare.',
  },
  {
    nome: 'Prenotazione intera',
    battute: [
      'vorrei prenotare una manicure',
      'giovedì mattina se possibile',
      'va benissimo, mi chiamo Anna Esposito',
    ],
    atteso: 'Cerca il posto, chiede conferma, e usa verifica_prenotazione prima di prenota.',
  },
  {
    nome: 'Orari di apertura',
    battute: ['a che ora chiudete il sabato?'],
    atteso: 'Chiama info_centro. Nessun orario deve uscire da fuori.',
  },
  {
    nome: 'Disdetta',
    battute: ['ciao volevo disdire l appuntamento di venerdì'],
    atteso: 'Non disdice al buio: guarda che appuntamenti ci sono e chiede conferma.',
  },
  {
    nome: 'Raffica (tre messaggi in dieci secondi)',
    battute: ['ciao\nsenti volevo sapere una cosa\nfate anche la laser?'],
    atteso: 'Risponde una volta sola, a tutto.',
  },
  {
    nome: 'Domanda a cui non deve rispondere da sola',
    battute: ['ho una dermatite in corso, posso fare lo stesso la ceretta?'],
    atteso: 'Non fa la dottoressa: passa a una collega.',
  },
];

export interface EsitoCaso {
  caso: string;
  atteso: string;
  risposta: string;
  strumenti: string[];
  giri: number;
  orariInventati: string[];
  chiuso: boolean;
  ritentativi: number;
  ms: number;
  tokenIn: number;
  tokenOut: number;
  errore?: string;
}

export interface Referto {
  concorrente: string;
  model: string;
  fornitore: Fornitore;
  disponibile: boolean;
  casi: EsitoCaso[];
  totali: {
    orariInventati: number;
    giriNonChiusi: number;
    errori: number;
    ritentativi: number;
    msMedi: number;
    tokenIn: number;
    tokenOut: number;
  };
}

/** Un turno solo, esattamente come lo fa la segretaria — ma senza scrivere niente. */
async function unTurno(
  c: Concorrente,
  istruzioni: string,
  poteri: Poteri,
  conversazione: Anthropic.MessageParam[],
  domanda: string,
  orariLeciti: Set<string>
): Promise<Omit<EsitoCaso, 'caso' | 'atteso'>> {
  const ctx: Contesto = {
    phone: NUMERO_DI_PROVA,
    clienteId: null,
    passata: null,
    prenotato: null,
  };

  const strumenti = strumentiPer(poteri);
  const usati: string[] = [];
  const partito = Date.now();
  let tokenIn = 0;
  let tokenOut = 0;
  let testo = '';
  let giri = 0;
  let chiuso = false;
  let ritentativi = 0;

  for (const o of orariIn(domanda)) orariLeciti.add(o);

  try {
    for (giri = 1; giri <= MAX_GIRI; giri++) {
      const richiesta: Richiesta = {
        model: c.model,
        maxTokens: 1200,
        system: [istruzioni, limitiDiOggi(poteri)].filter(Boolean).join('\n\n'),
        tools: strumenti,
        messages: conversazione,
      };

      const r = await chiedi(c.fornitore, richiesta);
      ritentativi += r.ritentativi;
      tokenIn += r.tokenIn;
      tokenOut += r.tokenOut;
      testo = r.testo || testo;

      if (r.chiamate.length === 0) {
        chiuso = true;
        conversazione.push({ role: 'assistant', content: r.testo || '(niente)' });
        break;
      }

      conversazione.push({
        role: 'assistant',
        content: [
          ...(r.testo ? [{ type: 'text' as const, text: r.testo }] : []),
          ...r.chiamate.map(ch => ({
            type: 'tool_use' as const,
            id: ch.id,
            name: ch.nome,
            input: (ch.input ?? {}) as Record<string, unknown>,
          })),
        ],
      });

      const risultati: Anthropic.ToolResultBlockParam[] = [];
      for (const ch of r.chiamate) {
        usati.push(ch.nome);
        let uscita: string;
        try {
          uscita = FINTE[ch.nome]
            ? FINTE[ch.nome]((ch.input ?? {}) as Record<string, unknown>)
            : await esegui(ch.nome, ch.input, ctx);
        } catch (e) {
          uscita = JSON.stringify({ errore: e instanceof Error ? e.message : String(e) });
        }
        /*
          Gli orari che escono dagli strumenti diventano leciti: è la stessa
          regola della segretaria vera. Tutto quello che il modello scriverà e
          che non è passato di qui, se lo è inventato.
        */
        for (const o of orariIn(uscita)) orariLeciti.add(o);
        risultati.push({ type: 'tool_result', tool_use_id: ch.id, content: uscita });
      }

      conversazione.push({ role: 'user', content: risultati });
    }
  } catch (e) {
    return {
      risposta: testo,
      strumenti: usati,
      giri,
      orariInventati: [],
      chiuso: false,
      ritentativi,
      ms: Date.now() - partito,
      tokenIn,
      tokenOut,
      errore: e instanceof Error ? e.message : String(e),
    };
  }

  return {
    risposta: testo,
    strumenti: usati,
    giri,
    orariInventati: orariIn(testo).filter(o => !orariLeciti.has(o)),
    chiuso,
    ritentativi,
    ms: Date.now() - partito,
    tokenIn,
    tokenOut,
  };
}

export async function corri(concorrenti: Concorrente[] = CONCORRENTI): Promise<Referto[]> {
  const istruzioni = await costruisciIstruzioni('whatsapp');
  /*
    Poteri pieni: si vuole vedere se il modello arriva a prenotare e con quali
    dati. Che poi non prenoti davvero lo garantiscono le finte, non il prompt.
  */
  const poteri: Poteri = { prenota: true, sposta: true, disdice: true };

  const referti: Referto[] = [];

  for (const c of concorrenti) {
    if (chiaveMancante(c.fornitore)) {
      referti.push({
        concorrente: c.nome,
        model: c.model,
        fornitore: c.fornitore,
        disponibile: false,
        casi: [],
        totali: {
          orariInventati: 0, giriNonChiusi: 0, errori: 0,
          ritentativi: 0, msMedi: 0, tokenIn: 0, tokenOut: 0,
        },
      });
      continue;
    }

    const casi: EsitoCaso[] = [];

    for (const caso of CASI) {
      /*
        La conversazione si porta dietro i turni precedenti, come in chat vera:
        un modello che alla terza battuta si è dimenticato il trattamento è un
        modello che non fa questo lavoro, e si vede solo così.
      */
      const conversazione: Anthropic.MessageParam[] = [];
      const orariLeciti = new Set<string>();
      let ultimo: Omit<EsitoCaso, 'caso' | 'atteso'> | null = null;

      for (const battuta of caso.battute) {
        conversazione.push({ role: 'user', content: battuta });
        ultimo = await unTurno(c, istruzioni, poteri, conversazione, battuta, orariLeciti);
        if (ultimo.errore) break;
      }

      casi.push({ caso: caso.nome, atteso: caso.atteso, ...ultimo! });
    }

    referti.push({
      concorrente: c.nome,
      model: c.model,
      fornitore: c.fornitore,
      disponibile: true,
      casi,
      totali: {
        orariInventati: casi.reduce((s, x) => s + x.orariInventati.length, 0),
        giriNonChiusi: casi.filter(x => !x.chiuso && !x.errore).length,
        errori: casi.filter(x => x.errore).length,
        ritentativi: casi.reduce((s, x) => s + x.ritentativi, 0),
        msMedi: Math.round(casi.reduce((s, x) => s + x.ms, 0) / (casi.length || 1)),
        tokenIn: casi.reduce((s, x) => s + x.tokenIn, 0),
        tokenOut: casi.reduce((s, x) => s + x.tokenOut, 0),
      },
    });
  }

  return referti;
}

/** Il referto in una tabella che si legge dai log di Railway senza strumenti. */
export function tabella(referti: Referto[]): string {
  const righe: string[] = ['', '=== BANCO DI PROVA ==='];

  for (const r of referti) {
    if (!r.disponibile) {
      righe.push(`\n${r.concorrente}: CHIAVE MANCANTE, non provato.`);
      continue;
    }
    const t = r.totali;
    righe.push(
      `\n${r.concorrente}  [${r.model}]`,
      `  orari inventati: ${t.orariInventati}   giri non chiusi: ${t.giriNonChiusi}   errori: ${t.errori}   ritentativi: ${t.ritentativi}`,
      `  tempo medio: ${t.msMedi}ms   token: ${t.tokenIn} in / ${t.tokenOut} out`
    );
    for (const c of r.casi) {
      const male = [
        c.errore ? `ERRORE ${c.errore.slice(0, 120)}` : '',
        c.orariInventati.length > 0 ? `INVENTA ${c.orariInventati.join(' ')}` : '',
        !c.chiuso && !c.errore ? 'NON CHIUDE' : '',
      ].filter(Boolean).join(' | ');
      righe.push(`   - ${c.caso}: ${male || 'ok'}  (${c.strumenti.join(',') || 'nessuno strumento'})`);
      righe.push(`     «${c.risposta.replace(/\s+/g, ' ').slice(0, 200)}»`);
    }
  }

  return righe.join('\n');
}
