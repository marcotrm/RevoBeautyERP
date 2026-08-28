/**
 * La segretaria di RevoBeauty su WhatsApp.
 *
 * Non è "l'assistente che risponde alle domande" con qualche funzione in più:
 * è la stessa persona che risponde al telefono, con la stessa identità, gli
 * stessi poteri e gli stessi limiti — solo che scrive invece di parlare. Le
 * istruzioni sono le stesse, e si costruiscono in `lib/istruzioniAssistente`.
 *
 * Quello che sa fare: dire quando c'è posto, prenotare, spostare, disdire,
 * dire prezzi e durate, dire dove siamo e quando siamo aperti, e passare la
 * conversazione a una persona quando serve. Quello che non sa fare, e non deve
 * provarci, è tutto il resto: niente medicina, niente sconti, niente promesse.
 *
 * Prima al suo posto c'erano tre cose diverse. Un assistente che rispondeva
 * alle domande ma dichiarava di non prenotare e diceva «scrivi PRENOTA». Un bot
 * a menù numerati che prenotava. Un terzo bot a menù per gli spostamenti. Per
 * la cliente erano tre interlocutori con tre memorie separate nella stessa
 * chat: si presentava, e il secondo le chiedeva di nuovo come si chiama.
 *
 * ── Sulla fonte dei dati ────────────────────────────────────────────────
 * Niente arriva dalla memoria del modello. Orari, prezzi, durate, operatrici
 * disponibili e posti liberi arrivano tutti da uno strumento, che legge il
 * gestionale nel momento in cui viene chiamato — lo stesso motore degli orari
 * dell'app clienti e della pagina /prenota. Se una prenotazione entra
 * dall'app mentre la conversazione è aperta, il posto risulta occupato al
 * messaggio dopo.
 *
 * ── Su chi ha davanti ───────────────────────────────────────────────────
 * Legge la scheda vera: cosa ha fatto le ultime volte, da chi ci va di solito,
 * che pacchetti ha già pagato, che prezzo riservato ha. Serve a tre cose che
 * separano una segretaria da un centralino — capire «il solito», non proporre
 * un'altra operatrice come se niente fosse, e non chiedere soldi a chi quella
 * seduta l'ha già pagata.
 *
 * ── Sul mandare un messaggio solo ───────────────────────────────────────
 * Il turno finisce con UNA chiamata a `rispondiUnaVolta`, mai con due. Il testo
 * che il modello produce fra una chiamata di strumento e l'altra non parte:
 * parte solo l'ultimo. È il motivo per cui la cliente non riceve «ti controllo
 * subito», poi «allora, giovedì c'è posto», poi «alle 15 va bene?» in tre
 * bolle a distanza di secondi.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './prisma';
import { todayRome } from './date';
import { costruisciIstruzioni } from './istruzioniAssistente';
import { getWaAutomationsConfig } from './wa-automations';
import { leggiCentro, orariParlati, eChiuso, type Chiarimento } from './centro';
import { cercaSlot, operatriciSelezionabili, type ServizioRichiesto, type SlotProposto } from './bookingEngine';
import { preparaPrenotazione, scriviAppuntamento, type DatiPrenotazione } from './vocePrenota';
import { spostaAppuntamento, disdiciAppuntamento, prossimiAppuntamenti } from './agendaAgente';
import { firmaConferma, leggiConferma } from './conferma';
import { todayInItaly, PREAVVISO_ORE } from './voice';
import { dataParlata, quandoParlato } from './parlato';
import { sendTelegram } from './telegram';
import { avanzaLead, leadDaTelefono } from './lead';
import { schedaDiChiScrive, type SchedaInChat } from './clienteInChat';
import { packageCoreName } from './packageTreatment';
import { fetchD360Media } from './whatsapp360';
import { trascriviVocale, archiviaTrascrizione, trascrizioneConfigurata } from './trascrizione';
import {
  STRUMENTI_DELICATI, modelloPer, parametriRagionamento, livelloDiPartenza, type Livello,
} from './orchestrazione';
import { listMessages, markConversationUnread, type WaMedia } from './wa-conversations';
import { normalizePhone } from './whatsapp';
import {
  registraArrivo, attendiSilenzio, prendiTurno, rilasciaTurno, rispondiUnaVolta,
} from './wa-antiflood';

const STATO_KIND = 'wa_segretaria';

/**
 * Tetto di risposte al giorno per numero.
 *
 * È più alto di quello del vecchio assistente (venti) perché una prenotazione
 * vera sono otto o dieci battute, e chi si vedeva tagliare la conversazione a
 * metà restava con un appuntamento non preso. Serve comunque: una
 * conversazione impazzita, o un loop, non deve poter svuotare il credito.
 */
const MAX_RISPOSTE_GIORNO = 45;

/** Quante battute della chat si passano al modello. */
const MEMORIA_TURNI = 24;

/** Quanti giri di strumenti al massimo in un turno, prima di rispondere comunque. */
const MAX_GIRI_STRUMENTI = 8;

/** Per quanto tace la segretaria dopo aver passato la conversazione a una persona. */
const MUTO_ORE = 4;



/**
 * Il collaudo: per i primi giorni risponde solo a chi decidi tu.
 *
 * Accendere una cosa che scrive in agenda su TUTTE le clienti insieme, la
 * prima volta, e' una scommessa che non serve fare. Con
 * `WA_SEGRETARIA_SOLO_NUMERI` la segretaria e' accesa davvero — stessi
 * strumenti, stessa agenda — ma risponde solo ai numeri elencati. Agli altri
 * non risponde nessuno, esattamente come ieri: il messaggio resta in chat e lo
 * legge una persona. Nessun cliente vede niente di diverso finche' non togli
 * la variabile.
 */
function numeriDelCollaudo(): string[] {
  return (process.env.WA_SEGRETARIA_SOLO_NUMERI || '')
    .split(',')
    .map(n => n.replace(/\D/g, ''))
    .filter(n => n.length >= 6);
}

function fuoriDalCollaudo(phone: string): boolean {
  const lista = numeriDelCollaudo();
  if (lista.length === 0) return false; // nessun collaudo impostato: risponde a tutti
  const coda = phone.replace(/\D/g, '').slice(-9);
  return !lista.some(n => n.slice(-9) === coda);
}

// ============================================================
// Lo stato della conversazione
// ============================================================

interface Battuta { role: 'user' | 'assistant'; text: string }

interface StatoChat {
  phone: string;
  turni: Battuta[];
  risposteOggi: number;
  giorno: string;
  /** Messaggi arrivati e non ancora letti dal modello (la raffica). */
  pendenti: string[];
  /** Foto arrivate nella stessa raffica, da guardare insieme al testo. */
  fotoPendenti?: Array<{ id: string; mime?: string }>;
  /** Fino a quando la segretaria sta zitta perché ha passato la palla a una persona. */
  mutoFino?: string;
  /** Perché ha passato la palla: è quello che si legge nel gestionale. */
  passataMotivo?: string;
  /**
   * Spenta a mano su QUESTA conversazione, a tempo indeterminato.
   *
   * Diversa dalla pausa: quella scade, questa no. Serve per la cliente che si
   * vuole seguire di persona senza spegnere la segretaria per tutte le altre.
   */
  spenta?: boolean;
  /**
   * Su quale modello gira questa conversazione.
   *
   * Una volta salita non riscende: se dieci minuti fa stava prendendo un
   * appuntamento, la battuta dopo fa parte di quella cosa lì.
   */
  livello?: Livello;
}

const riga = (phone: string) => `wa:segretaria:${phone}`;

async function leggiStato(phone: string): Promise<StatoChat> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: riga(phone) } });
  const s = row?.data as unknown as StatoChat | undefined;
  const oggi = todayRome();
  return {
    phone,
    turni: (s?.turni || []).slice(-MEMORIA_TURNI),
    // Il tetto è giornaliero: a mezzanotte riparte.
    risposteOggi: s?.giorno === oggi ? s.risposteOggi || 0 : 0,
    giorno: oggi,
    pendenti: s?.pendenti || [],
    fotoPendenti: s?.fotoPendenti || [],
    mutoFino: s?.mutoFino,
    passataMotivo: s?.passataMotivo,
    spenta: s?.spenta,
    // Il livello si azzera con la giornata, come il tetto delle risposte: chi
    // torna a scrivere dopo due giorni comincia da una domanda, non da dove
    // aveva lasciato.
    livello: s?.giorno === oggi ? s.livello : undefined,
  };
}

async function scriviStato(s: StatoChat): Promise<void> {
  const data = { ...s, turni: s.turni.slice(-MEMORIA_TURNI) } as unknown as object;
  await prisma.adminEntry.upsert({
    where: { rowId: riga(s.phone) },
    update: { data },
    create: { rowId: riga(s.phone), kind: STATO_KIND, entityId: s.phone, data, createdAt: new Date().toISOString() },
  });
}

// ============================================================
// Gli strumenti
// ============================================================

const STRUMENTI: Anthropic.Tool[] = [
  {
    name: 'chi_e',
    description:
      'La scheda di chi sta scrivendo, riconosciuta dal numero: prossimi appuntamenti, ultimi '
      + 'trattamenti fatti (serve per capire «il solito»), operatrice abituale, pacchetti già '
      + 'pagati con le sedute che restano, credito e buoni. '
      + 'Chiamalo SEMPRE per primo: se la persona è già in rubrica non devi chiederle come si chiama.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'info_centro',
    description:
      'Indirizzo, orari di apertura, giorni di chiusura, e le categorie del listino con la fascia di prezzo. '
      + 'Per il prezzo di un singolo trattamento usa "listino".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'listino',
    description:
      'I trattamenti con prezzo e durata veri, separati donna e uomo, PIÙ il prezzo che paga '
      + 'davvero questa cliente (`perQuestaCliente`): zero se ha una seduta dentro un pacchetto '
      + 'aperto, il suo prezzo riservato se ne ha uno in scheda. Quando c\'è, quella è la cifra '
      + 'da dire — il listino no. Cerca per nome ("ceretta", "baffetto") o per categoria. '
      + 'Torna anche gli id, che servono per prenotare.',
    input_schema: {
      type: 'object',
      properties: {
        cerca: { type: 'string', description: 'Parte del nome del trattamento' },
        categoria: { type: 'string', description: 'nails, laser, waxing, facial, body, massage, makeup, consultation, hair' },
      },
    },
  },
  {
    name: 'operatrici',
    description:
      'Chi lavora al centro: nome e id di ognuna, e che cosa sa fare. '
      + 'Chiamalo OGNI VOLTA che la cliente nomina una persona ("c\'e\' Rosaria?", "la vorrei con Michela"), '
      + 'passando in `nome` il nome ESATTO che ha usato lei: ci pensa lo strumento a riconoscerla anche se '
      + 'lo dice per intero, accorciato o attaccato ("Mariarosaria", "Maria Rosaria", "la Cioffi"). '
      + 'Due regole, e non hanno eccezioni: '
      + '(1) se lo strumento dice che quel nome non e\' di nessuna, quella persona da noi non c\'e\' — dillo e '
      + 'chiedi chi intende, non tirare a indovinare e non usare quel nome come se esistesse; '
      + '(2) per sapere se una persona ha posto devi passare il suo `id` come `operatorId` a "quando_c_e_posto". '
      + 'Senza quell\'id gli orari che tornano sono del centro, di chiunque sia libera: attribuirli a una persona '
      + 'e\' dirle una cosa falsa, e la cliente si presenta per trovare qualcun altro.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Il nome come l\'ha detto la cliente, senza aggiustarlo.' },
      },
    },
  },
  {
    name: 'quando_c_e_posto',
    description:
      'Gli orari davvero liberi, guardando i turni veri delle operatrici, le pause e quello che è già in agenda '
      + '(comprese le prenotazioni arrivate dall\'app). Non proporre MAI un orario che non sia uscito da qui. '
      + 'Se non passi `operatorId`, gli orari sono del CENTRO — libera una qualunque — e non puoi dirli come se '
      + 'fossero di una persona: per gli orari di una persona prendi il suo id da "operatrici" e passalo qui. '
      + 'Se il giorno chiesto è pieno ti dà già i primi utili in `maCiSarebbe`: proponili subito, '
      + 'nello stesso messaggio, invece di rispondere solo che non c\'è posto.',
    input_schema: {
      type: 'object',
      properties: {
        trattamenti: {
          type: 'array',
          description: 'Uno o più trattamenti, nell\'ordine in cui li farà. Gli id vengono da "listino".',
          items: {
            type: 'object',
            properties: {
              treatmentId: { type: 'string' },
              operatorId: { type: 'string', description: 'Solo se la cliente ha chiesto una operatrice precisa' },
            },
            required: ['treatmentId'],
          },
        },
        data: { type: 'string', description: 'Un giorno preciso, YYYY-MM-DD. Ometti per i primi giorni utili.' },
        subito: {
          type: 'boolean',
          description: 'True SOLO se la cliente ha detto che vuole il prima possibile: in quel caso non le si chiede mattina o pomeriggio.',
        },
        giorni: { type: 'number', description: 'Quanti giorni guardare avanti se non hai indicato una data (default 7)' },
        dalle: { type: 'string', description: 'Prima ora accettabile, HH:MM' },
        alle: { type: 'string', description: 'Ultima ora accettabile, HH:MM' },
        uomo: { type: 'boolean', description: 'True se il cliente è un uomo: cambiano prezzi e durate' },
      },
      required: ['trattamenti'],
    },
  },
  {
    name: 'verifica_prenotazione',
    description:
      'PRIMO dei due passi per prenotare. Controlla che l\'orario regga e ti restituisce la frase di riepilogo '
      + 'e un gettone. Scrivi quella frase alla cliente e ASPETTA che confermi. Non prenota niente.',
    input_schema: {
      type: 'object',
      properties: {
        trattamenti: {
          type: 'array',
          items: {
            type: 'object',
            properties: { treatmentId: { type: 'string' }, operatorId: { type: 'string' } },
            required: ['treatmentId'],
          },
        },
        data: { type: 'string', description: 'YYYY-MM-DD' },
        ora: { type: 'string', description: 'HH:MM, uno degli orari usciti da quando_c_e_posto' },
        nome: { type: 'string', description: 'Nome e cognome. Serve solo se il numero non è in rubrica.' },
        uomo: { type: 'boolean' },
      },
      required: ['trattamenti', 'data', 'ora'],
    },
  },
  {
    name: 'prenota',
    description:
      'SECONDO passo. Scrive in agenda. Chiamalo solo DOPO che la cliente ha confermato il riepilogo, '
      + 'passando il gettone di "verifica_prenotazione". Senza gettone viene rifiutato.',
    input_schema: {
      type: 'object',
      properties: { gettone: { type: 'string' } },
      required: ['gettone'],
    },
  },
  {
    name: 'sposta_appuntamento',
    description:
      `Sposta un appuntamento già preso. Fino a ${PREAVVISO_ORE} ore prima. `
      + 'Ripeti alla cliente il vecchio e il nuovo orario e aspetta il sì prima di chiamarlo.',
    input_schema: {
      type: 'object',
      properties: {
        appuntamentoId: { type: 'string', description: 'Da "chi_e"' },
        data: { type: 'string', description: 'YYYY-MM-DD' },
        ora: { type: 'string', description: 'HH:MM, uscito da quando_c_e_posto' },
      },
      required: ['appuntamentoId', 'data', 'ora'],
    },
  },
  {
    name: 'disdici_appuntamento',
    description:
      `Disdice un appuntamento. Fino a ${PREAVVISO_ORE} ore prima. `
      + 'Ripeti quale appuntamento stai per disdire e aspetta il sì: stai cancellando qualcosa che esiste.',
    input_schema: {
      type: 'object',
      properties: { appuntamentoId: { type: 'string' } },
      required: ['appuntamentoId'],
    },
  },
  {
    name: 'passa_a_persona',
    description:
      'Avvisa il centro e smetti di rispondere a questo numero per qualche ora. '
      + 'Usalo per: domande mediche, reclami, rimborsi, sconti, appuntamenti sotto le 24 ore, '
      + 'e ogni volta che non sei sicuro. Dopo averlo chiamato, scrivi alla cliente che la farai '
      + 'ricontattare da una collega.',
    input_schema: {
      type: 'object',
      properties: { motivo: { type: 'string', description: 'Una riga per il centro: cosa serve e a chi' } },
      required: ['motivo'],
    },
  },
];

/** Quello che il centro le lascia toccare in agenda, oggi. */
export interface Poteri {
  prenota: boolean;
  sposta: boolean;
  disdice: boolean;
}

/**
 * Gli strumenti che la segretaria ha davvero in mano.
 *
 * Uno strumento spento non viene *sconsigliato*: non viene proprio passato al
 * modello. Non può chiamarlo, non può sbagliarsi, non c'è una regola da
 * ricordarsi di rispettare — la porta non esiste. È la stessa idea del gettone
 * di conferma: le cose che non devono succedere non si scrivono nel prompt, si
 * tolgono dalla stanza.
 */
function strumentiPer(poteri: Poteri): Anthropic.Tool[] {
  return STRUMENTI.filter(t => {
    if (t.name === 'verifica_prenotazione' || t.name === 'prenota') return poteri.prenota;
    if (t.name === 'sposta_appuntamento') return poteri.sposta;
    if (t.name === 'disdici_appuntamento') return poteri.disdice;
    return true;
  });
}

/**
 * Che cosa dirle quando le hanno tolto qualcosa.
 *
 * Senza questo, con la prenotazione spenta, la segretaria arriverebbe fino a
 * «perfetto, giovedì alle 15» e poi non troverebbe lo strumento: la cliente
 * resta convinta di avere un appuntamento che non esiste. Deve saperlo PRIMA,
 * per portare la conversazione dove serve.
 */
function limitiDiOggi(poteri: Poteri): string {
  const righe: string[] = [];

  if (!poteri.prenota) {
    righe.push(
      'OGGI NON PRENDI APPUNTAMENTI NUOVI. Puoi dire tutto: quanto costa, quanto dura, '
      + 'quando ci sarebbe posto. Ma l\'appuntamento lo fissa una collega.\n\n'
      + 'Quindi fai il lavoro fino in fondo e poi passi: capisci bene QUALE trattamento '
      + 'vuole (con le domande che servono, senza indovinare), quando le farebbe comodo, '
      + 'e se è già cliente. Poi chiami "passa_a_persona" scrivendo lì dentro tutto quello '
      + 'che hai capito — trattamento, giorni e ore che le vanno bene, nome — e le dici in '
      + 'una riga che la richiama una collega per fissarlo.\n\n'
      + 'Non dire mai «ti ho preso l\'appuntamento» e non dare per fatta una cosa che non hai fatto.'
    );
  }
  if (!poteri.sposta) {
    righe.push('Non sposti appuntamenti: raccogli quando vorrebbe e passa la conversazione a una collega.');
  }
  if (!poteri.disdice) {
    righe.push('Non disdici appuntamenti: passa sempre la conversazione a una collega.');
  }

  return righe.length > 0 ? `## Che cosa NON puoi fare oggi\n\n${righe.join('\n\n')}` : '';
}

/**
 * Riconosce l'operatrice dal nome come lo dice la cliente.
 *
 * «Mariarosaria», «Maria Rosaria», «rosaria», «la De Lucia» sono la stessa
 * persona: si toglie tutto quello che non e' lettera, si abbassano gli accenti
 * e basta che uno dei due contenga l'altro. Sotto le quattro lettere non si
 * confronta niente — «lu» finirebbe dentro mezza rubrica.
 */
function riconosciOperatrice<T extends { nome: string; nomeBreve: string }>(cercato: string, ops: T[]): T[] {
  const pulisci = (x: string) =>
    x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const q = pulisci(cercato);
  if (q.length < 4) return [];
  return ops.filter(o => {
    const chiavi = [o.nome, o.nomeBreve, o.nome.split(' ').slice(1).join(' ')]
      .map(pulisci)
      .filter(k => k.length >= 4);
    return chiavi.some(k => k.includes(q) || q.includes(k));
  });
}

/**
 * Gli orari scritti in un testo, in forma HH:MM.
 *
 * Serve a una cosa sola: confrontare quello che il modello sta per mandare
 * con quello che gli strumenti gli hanno davvero risposto. Si guardano solo
 * gli orari con i minuti — «alle 10:30» — perche' e' la forma in cui un
 * modello propone un appuntamento; «alle tre» non lo scrive nessuno, e
 * cercare i numeri sciolti farebbe scattare l'allarme su «3 sedute».
 */
function orariIn(testo: string): string[] {
  const trovati: string[] = [];
  const re = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) trovati.push(`${m[1].padStart(2, '0')}:${m[2]}`);
  return trovati;
}

/**
 * Il filtro sull'operatrice, se c'e', deve puntare a una persona che esiste.
 *
 * Un id inventato passava liscio: il motore non trovava nessuno con quel nome
 * fra i candidati e restituiva gli orari come se il filtro non ci fosse, cioe'
 * quelli di chiunque. Da fuori sembrava una risposta sulla persona chiesta.
 * Torna la stringa d'errore da dare al modello, o null se e' tutto a posto.
 */
async function operatriceIgnota(services: ServizioRichiesto[]): Promise<string | null> {
  const chieste = services.map(s => s.operatorId).filter((x): x is string => Boolean(x));
  if (chieste.length === 0) return null;
  const ops = await operatriciSelezionabili();
  const ignote = chieste.filter(id => !ops.some(o => o.id === id));
  if (ignote.length === 0) return null;
  return JSON.stringify({
    errore: 'Quell\'operatrice non esiste. Non inventare un nome: di\' alla cliente chi c\'e\' davvero.',
    operatrici: ops.map(o => ({ id: o.id, nome: o.nome })),
  });
}

/** Legge i trattamenti come li manda il modello. */
function serviziDa(input: unknown): ServizioRichiesto[] {
  const t = (input as { trattamenti?: unknown })?.trattamenti;
  if (!Array.isArray(t)) return [];
  return t
    .filter((x): x is { treatmentId?: unknown; operatorId?: unknown } => Boolean(x) && typeof x === 'object')
    .map(x => ({ treatmentId: String(x.treatmentId || ''), operatorId: x.operatorId ? String(x.operatorId) : null }))
    .filter(x => x.treatmentId);
}

interface Contesto {
  phone: string;
  clienteId: string | null;
  /** Riempita da "passa_a_persona": chiude il turno e fa tacere la segretaria. */
  passata: string | null;
  /** Riempita da "prenota": serve a far avanzare il contatto e a non chiedere due volte. */
  prenotato: { id: string; clientId: string } | null;
  /** `undefined` = non ancora letta, `null` = numero non in rubrica. */
  scheda?: SchedaInChat | null;
}

/**
 * La scheda della cliente, letta una volta per turno.
 *
 * La chiedono tre strumenti diversi — chi è, quanto costa, quando c'è posto —
 * e rileggerla ogni volta significa tre giri di query identiche mentre la
 * cliente aspetta.
 */
async function scheda(ctx: Contesto): Promise<SchedaInChat | null> {
  if (ctx.scheda === undefined) {
    ctx.scheda = await schedaDiChiScrive(ctx.phone).catch(() => null);
    if (ctx.scheda) ctx.clienteId = ctx.scheda.id;
  }
  return ctx.scheda;
}

/**
 * Il pacchetto attivo che copre questo trattamento, se c'è.
 *
 * Il legame nel database non esiste: si confrontano i nomi ripuliti dalle
 * parole di servizio ("pacchetto", "10 sedute", "x5"). Se non combacia niente
 * non si indovina — dire «è già pagato» a chi poi si vede chiedere i soldi in
 * cassa è peggio che non dirlo.
 */
function pacchettoCheCopre(sch: SchedaInChat | null, nomeTrattamento: string) {
  if (!sch?.pacchetti.length) return null;
  const t = packageCoreName(nomeTrattamento);
  if (!t) return null;
  return sch.pacchetti.find(p => {
    const n = packageCoreName(p.nome);
    return n && (n === t || n.includes(t) || t.includes(n));
  }) || null;
}

/** Esegue uno strumento e torna il testo che il modello leggerà. */
async function esegui(nome: string, input: unknown, ctx: Contesto): Promise<string> {
  const dati = (input || {}) as Record<string, unknown>;
  const oggi = todayInItaly();

  /*
    Il sesso decide prezzo e durata su quasi tutto il listino. Se la persona è
    in rubrica lo sa il gestionale, e vale più di quello che ha dedotto il
    modello dal nome: `uomo` nell'input serve solo per chi in rubrica non c'è.
  */
  const inRubrica = await scheda(ctx);
  const sesso: 'male' | 'female' = inRubrica
    ? (inRubrica.uomo ? 'male' : 'female')
    : (dati.uomo === true ? 'male' : 'female');

  switch (nome) {
    case 'chi_e': {
      const [sch, lead] = await Promise.all([scheda(ctx), leadDaTelefono(ctx.phone)]);
      if (!sch) {
        return JSON.stringify({
          inRubrica: false,
          nota: 'Numero non in rubrica: chiedi nome e cognome quando arrivi a prenotare, non prima.',
          dalSito: lead
            ? { chiesto: lead.service || null, messaggio: lead.message || null, quando: lead.createdAt.slice(0, 10) }
            : null,
        });
      }

      const appuntamenti = await prossimiAppuntamenti(sch.id);
      return JSON.stringify({
        inRubrica: true,
        nome: sch.nome,
        nomeCompleto: sch.nomeCompleto,
        uomo: sch.uomo,
        quanteVolte: sch.quanteVolte,
        ultimaVisita: sch.ultimaVisita,
        prossimiAppuntamenti: appuntamenti.map(a => ({
          id: a.id,
          quando: quandoParlato(a.date, a.startTime, oggi),
          data: a.date,
          ora: a.startTime,
          trattamento: a.treatmentName,
          con: a.operatorName.split(' ')[0],
        })),
        /* Serve per capire «il solito»: è la domanda più frequente che c'è, e
           senza storico la risposta è «cosa intendi?». */
        ultimiTrattamenti: sch.storico,
        operatriceAbituale: sch.operatriceAbituale,
        /*
          Le note sono istruzioni, non descrizioni: dicono cosa fare con quel
          dato. Quella sui pacchetti nasce da un caso vero — una cliente con
          dieci Slimsphere pagate a cui si stava per rivendere una seduta sua.
          Le sedute in mano vanno proposte per prime, prima del listino.
        */
        note: [
          sch.operatriceAbituale
            ? `Va quasi sempre da ${sch.operatriceAbituale}: se proponi un orario con un'altra, dillo invece di darlo per scontato.`
            : null,
          sch.pacchetti.length > 0
            ? 'HA SEDUTE GIA\' PAGATE: ' + sch.pacchetti.map(p => `${p.nome} (${p.rimaste} su ${p.totali} da fare)`).join('; ')
              + '. Prima di proporle qualcosa a listino chiedile se vuole usarne una — sono soldi che ha gia\' dato. '
              + 'E se ti chiede quante gliene restano, il numero e\' questo: dillo, non mandarla al centro.'
            : null,
        ].filter(Boolean),
        /* Sedute già pagate. Chiedere i soldi a chi ha un pacchetto aperto è
           l'errore che al banco non succede mai. */
        pacchettiAperti: sch.pacchetti.map(p => ({
          nome: p.nome, sedute: p.rimaste, su: p.totali, omaggio: p.omaggio, scade: p.scade,
        })),
        prezziSuMisura: sch.suMisura.length,
        creditoEuro: sch.creditoEuro || undefined,
        buoniRegaloEuro: sch.buoniEuro || undefined,
        punti: sch.punti || undefined,
        dalSito: lead ? { chiesto: lead.service || null, quando: lead.createdAt.slice(0, 10) } : null,
      });
    }

    case 'operatrici': {
      /*
        Chi lavora qui, con gli id.

        Senza questo elenco il modello non aveva modo di sapere ne' chi c'e'
        ne' come chiederne gli orari: alla domanda «c'e' oggi Mariarosaria?»
        ha risposto «ha posto alle 11:00 o alle 15:30» a un'ora in cui Rosaria
        era occupata da un'ora — e "Mariarosaria" al centro non esiste nemmeno.
        Un orario inventato e' peggio di un «non lo so»: la cliente ci viene.
      */
      const ops = await operatriciSelezionabili();
      const elenco = ops.map(o => ({ id: o.id, nome: o.nome, nomeBreve: o.nomeBreve, sannoFare: o.categorie }));
      const cercato = typeof dati.nome === 'string' ? dati.nome : '';
      const trovate = cercato ? riconosciOperatrice(cercato, ops) : [];

      /*
        Chi se n'e' andata va detto, non scambiato.

        «Michela Tedesco» somiglia a «Michela Cioffi» quanto basta a farle
        passare per la stessa persona, e la cliente si sarebbe sentita
        confermare un appuntamento con una collega diversa senza che nessuno
        glielo dicesse. Qui il cognome e' la prova: se combacia con una che non
        lavora piu' qui, si risponde quello.
      */
      if (cercato) {
        const andate = await prisma.operator.findMany({
          where: { isActive: false, isResource: false },
          select: { firstName: true, lastName: true },
        });
        const exAbbinate = riconosciOperatrice(
          cercato,
          andate.map(o => ({ nome: `${o.firstName} ${o.lastName}`.trim(), nomeBreve: '' })),
        );
        if (exAbbinate.length > 0) {
          return JSON.stringify({
            trovata: null,
            nonPiuQui: exAbbinate[0].nome,
            nota: `${exAbbinate[0].nome} non lavora piu' da noi. Dillo alla cliente con garbo e proponile `
              + 'una delle colleghe, senza far finta che sia un\'altra persona.',
            operatrici: elenco,
          });
        }
      }

      /*
        Il nome come lo dice la cliente.

        In rubrica sta «Rosaria De Lucia», ma al banco la chiamano Maria
        Rosaria e in chat scrivono «mariarosaria» tutto attaccato. E' la stessa
        persona, e farglielo chiedere ogni volta e' una figura: il confronto si
        fa senza spazi e senza accenti, e uno che contiene l'altro basta.
      */
      if (cercato && trovate.length === 1) {
        const t = trovate[0];
        return JSON.stringify({
          trovata: { id: t.id, nome: t.nome, nomeBreve: t.nomeBreve, sannoFare: t.categorie },
          nota: `«${cercato}» e' ${t.nome}: e' lei, non chiedere conferma. `
            + `Per i suoi orari passa operatorId="${t.id}" a "quando_c_e_posto".`,
          operatrici: elenco,
        });
      }
      if (cercato && trovate.length > 1) {
        return JSON.stringify({
          ambiguo: trovate.map(t => ({ id: t.id, nome: t.nome })),
          nota: `«${cercato}» puo' essere piu' di una: chiedi alla cliente quale delle due intende.`,
        });
      }
      if (cercato) {
        return JSON.stringify({
          trovata: null,
          nota: `«${cercato}» non e' nessuna delle nostre. Dillo alla cliente e chiedile chi intende, `
            + 'senza usare quel nome come se fosse una collega.',
          operatrici: elenco,
        });
      }
      return JSON.stringify({
        operatrici: elenco,
        nota: 'Se il nome detto dalla cliente non e\' qui, quella persona non lavora da noi: dillo. '
          + 'Per i suoi orari passa l\'id come operatorId a "quando_c_e_posto".',
      });
    }

    case 'info_centro': {
      const [centro, trattamenti] = await Promise.all([
        leggiCentro(),
        prisma.treatment.findMany({ where: { isActive: true }, select: { category: true, price: true, priceFemale: true } }),
      ]);
      const perCategoria = new Map<string, number[]>();
      for (const t of trattamenti) {
        const p = t.priceFemale ?? t.price;
        perCategoria.set(t.category, [...(perCategoria.get(t.category) || []), p]);
      }
      return JSON.stringify({
        nome: centro.nome,
        indirizzo: centro.indirizzo,
        // Un campo vuoto il modello lo riempie: si e' visto scrivere a una
        // cliente «chiama il centro: 0823… (numero che mi serve dal centro)».
        // Detto a parole, invece, non c'e' niente da completare.
        telefono: centro.telefono || 'NON DISPONIBILE — non inventarlo e non darne uno alla cliente',
        orari: orariParlati(centro.orari),
        oggi: { data: oggi, giorno: dataParlata(oggi, oggi), aperto: !eChiuso(centro, oggi) },
        chiusureFuture: (centro.chiusure || []).filter(d => d >= oggi).sort().slice(0, 8),
        categorie: [...perCategoria.entries()].map(([chiave, prezzi]) => ({
          chiave, quanti: prezzi.length, daEuro: Math.min(...prezzi), aEuro: Math.max(...prezzi),
        })),
        note: centro.noteVoce || '',
      });
    }

    case 'listino': {
      const cerca = typeof dati.cerca === 'string' ? dati.cerca.trim() : '';
      const categoria = typeof dati.categoria === 'string' ? dati.categoria.trim() : '';

      /*
        Si cerca a parole, non per pezzo di frase.

        Prima la ricerca era un `contains` sulla stringa intera. Funziona
        finche' la cliente scrive il nome esatto del gestionale — e non lo
        scrive mai. «Rimuovere e fare la colata» non combacia con niente, e in
        listino ci sono sia «rimozione prodotto» sia «Ricostruzione Acrygel o
        Gel»: due trattamenti che c'erano, trovati zero, e la segretaria
        costretta a rispondere a mano libera.
        Vale anche per le parole del sito, che non sono quelle del gestionale:
        sul sito c'e' scritto «Acrygel Ricostruzione», in gestionale
        «Ricostruzione Acrygel o Gel». Chi legge il sito scrive quello che ha
        letto.

        Quindi: si spezza in parole, basta che ne combaci una, e si ordina per
        quante ne combaciano. Sotto le tre lettere si scarta — «e», «di», «la»
        starebbero dentro mezzo listino.
      */
      const parole = cerca.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(p => p.length >= 3);

      const trattamenti = await prisma.treatment.findMany({
        where: {
          isActive: true,
          ...(categoria ? { category: categoria } : {}),
          ...(parole.length > 0
            ? { OR: parole.map(p => ({ name: { contains: p, mode: 'insensitive' as const } })) }
            : cerca
              ? { name: { contains: cerca, mode: 'insensitive' as const } }
              : {}),
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, category: true, duration: true, price: true,
          durationMale: true, durationFemale: true, priceMale: true, priceFemale: true,
        },
        take: 40,
      });

      /*
        Quello che combacia di piu' sta in cima.

        Chi scrive «ricostruzione gel» trova sia «Ricostruzione Acrygel o Gel»
        (due parole su due) sia «rimozione prodotto» (zero, ma e' entrato per
        un'altra parola della frase): metterli in fila alfabetica vuol dire
        offrire il secondo per primo.
      */
      if (parole.length > 1) {
        const quante = (nome: string) => parole.filter(p => nome.toLowerCase().includes(p)).length;
        trattamenti.sort((a, b) => quante(b.name) - quante(a.name) || a.name.localeCompare(b.name));
      }

      if (trattamenti.length === 0) {
        return JSON.stringify({
          trovati: 0,
          nota: 'Niente con questo nome, nemmeno cercando parola per parola. Non inventare un prezzo ne\' un nome: '
            + 'chiedi alla cliente di dirlo con parole sue («che cosa ti fai di solito?»), oppure usa "passa_a_persona".',
        });
      }

      /*
        Il prezzo che conta è quello DI QUESTA CLIENTE, non quello del cartello.
        Tre casi, in quest'ordine: una seduta già pagata dentro un pacchetto
        aperto, un prezzo scritto su misura nella sua scheda, e solo per ultimo
        il listino. Rispondere «sono 60 euro» a chi ha tre sedute prepagate è
        un errore che al banco non succede mai.
      */
      const sch = await scheda(ctx);

      /*
        «Il gel».

        Al banco non vuol dire niente: può essere una ricostruzione da zero, un
        ritocco, un semipermanente, un acrygel. Le ragazze lo risolvono senza
        pensarci, con due domande. Un modello no: prende il primo della lista e
        va avanti, e l'errore si scopre in cabina con la cliente già seduta e
        mezz'ora di agenda che non torna.

        Quindi quando la ricerca porta più di un trattamento, lo strumento non
        fa finta di niente: dice che è ambiguo, elenca le possibilità, e —  se
        il centro le ha scritte — porta le domande che le distinguono. Sceglie
        la cliente, non il modello.
      */
      /*
        Ambiguo e' un pareggio in cima, non «piu' di uno».

        Cercando a parole entrano anche i mezzi risultati: «ricostruzione gel»
        tira dentro «rimozione prodotto», che e' entrato per un'altra parola
        della frase. Chiamare ambigua quella lista vorrebbe dire far scegliere
        alla cliente fra cose che non c'entrano. Ambiguo e' quando in testa
        restano due trattamenti che combaciano ALLO STESSO MODO — «Refill
        Acrygel o Gel» e «Ricostruzione Acrygel o Gel» per chi scrive «gel»:
        li' la domanda serve davvero.
      */
      const quanteParole = (nome: string) =>
        parole.length > 0 ? parole.filter(p => nome.toLowerCase().includes(p)).length : 1;
      const miglior = trattamenti.length > 0 ? quanteParole(trattamenti[0].name) : 0;
      const aPariMerito = trattamenti.filter(t => quanteParole(t.name) === miglior);
      const ambiguo = aPariMerito.length > 1 && cerca.length > 0;

      let chiarimento: Chiarimento | undefined;
      if (ambiguo) {
        const centro = await leggiCentro().catch(() => null);
        const cercato = cerca.toLowerCase();
        chiarimento = (centro?.chiarimenti || []).find(c =>
          (c.parole || []).some(p => {
            const parola = p.toLowerCase().trim();
            // Sotto le tre lettere non si combacia: una "e" sfuggita nell'elenco
            // starebbe dentro mezzo listino e attaccherebbe la domanda sbagliata
            // a qualunque ricerca.
            if (parola.length < 3) return false;
            return cercato.includes(parola) || parola.includes(cercato);
          })
        );
      }

      /*
        Chi l'ha già fatto non va interrogato.

        Se fra i trattamenti che combaciano ce n'è uno che ha già fatto, «il
        gel» vuol dire quello: si conferma («la ricostruzione gel come
        l'ultima volta?») invece di fare tre domande a una cliente abituale,
        che è il modo più veloce per farla sentire in un call center.
      */
      const giaFatti = (sch?.storico || [])
        .map(v => v.trattamento)
        .filter(fatto => aPariMerito.some(t => t.name.toLowerCase() === fatto.toLowerCase()));

      return JSON.stringify({
        trovati: trattamenti.length,
        ambiguo: ambiguo || undefined,
        ...(ambiguo ? {
          nota: giaFatti.length > 0
            ? `Più di un trattamento si chiama così. Ma questa cliente ha già fatto «${giaFatti[0]}»: `
              + 'conferma quello invece di farle domande — «come l\'ultima volta?» — e chiedi solo se ti dice di no.'
            : 'PIÙ DI UN TRATTAMENTO SI CHIAMA COSÌ. Non sceglierne uno tu: chiedi alla cliente. '
              + 'Sbagliare trattamento vuol dire sbagliare durata, prezzo e operatrice, e ce ne si accorge '
              + 'in cabina con lei già seduta. Una domanda per messaggio.',
          giaFattoDaLei: giaFatti[0] || undefined,
          traQuesti: aPariMerito.map(t => t.name),
          domandaDaFare: chiarimento?.chiedi,
          comeSiSceglie: chiarimento?.scelta,
        } : {}),
        trattamenti: trattamenti.map(t => {
          const misura = sch?.suMisura.find(m => m.treatmentId === t.id);
          const pacchetto = pacchettoCheCopre(sch, t.name);
          const listinoDonna = t.priceFemale ?? t.price;
          const listinoUomo = t.priceMale ?? t.priceFemale ?? t.price;

          return {
            id: t.id,
            nome: t.name,
            categoria: t.category,
            donna: { prezzo: listinoDonna, durata: t.durationFemale ?? t.duration },
            uomo: { prezzo: listinoUomo, durata: t.durationMale ?? t.durationFemale ?? t.duration },
            perQuestaCliente: pacchetto
              ? {
                  daPagare: 0,
                  perche: `già pagato: ${pacchetto.nome}, ${pacchetto.rimaste} ${pacchetto.rimaste === 1 ? 'seduta' : 'sedute'} ancora da fare`,
                  nota: 'Diglielo: non chiedere soldi per una seduta che ha già pagato.',
                }
              : misura
                ? {
                    daPagare: misura.price,
                    perche: 'prezzo riservato, scritto nella sua scheda',
                    nota: 'Di\' solo la cifra. Non dire che è un prezzo speciale e non paragonarlo al listino.',
                  }
                : undefined,
          };
        }),
      });
    }

    case 'quando_c_e_posto': {
      const services = serviziDa(dati);
      if (services.length === 0) return JSON.stringify({ errore: 'Serve almeno un trattamento (usa "listino" per gli id).' });
      const nonValida = await operatriceIgnota(services);
      if (nonValida) return nonValida;

      let dateFrom = oggi;
      let quanti = Math.min(Math.max(1, Number(dati.giorni) || 7), 30);
      if (typeof dati.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dati.data)) {
        if (dati.data < oggi) return JSON.stringify({ errore: 'Quella data è già passata.' });
        dateFrom = dati.data;
        quanti = 1;
      }

      /*
        Quali orari dire per primi: quelli attaccati.

        E' la regola di «Cerca buchi», ed e' la stessa che si applica al banco:
        un appuntamento appiccicato a quello prima non lascia mezz'ora vuota in
        mezzo alla giornata, che poi non si vende a nessuno. A parita', l'ordine
        resta quello dell'orologio.
      */
      const perPrimi = (slots: SlotProposto[]) => [...slots].sort((a, b) => (b.attaccato ? 1 : 0) - (a.attaccato ? 1 : 0));

      const dillo = (g: { date: string; slots: SlotProposto[] }) => ({
        data: g.date,
        giorno: dataParlata(g.date, oggi),
        orari: perPrimi(g.slots).slice(0, 5).map(s => ({
          ora: s.time,
          con: [...new Set(s.assegnazioni.map(a => a.operatorName.split(' ')[0]))].join(' e '),
          attaccato: s.attaccato || undefined,
        })),
      });

      const fascia = {
        oraDa: typeof dati.dalle === 'string' ? dati.dalle : null,
        oraA: typeof dati.alle === 'string' ? dati.alle : null,
      };

      const { giorni, durataTotale, prezzoTotale, vuoti } = await cercaSlot({
        dateFrom, giorni: quanti, services, gender: sesso, ...fascia, maxPerGiorno: 5,
      });

      /*
        Prima mattina o pomeriggio, poi gli orari.

        Sparare quattro orari sparsi su tutta la giornata fa scegliere male: la
        cliente legge il primo che le capita, o chiede «e nel pomeriggio?» e si
        ricomincia. Quando la fascia non l'ha detta lei e ce n'e' in tutte e
        due, qui gli orari non si danno proprio: torna la domanda, e basta.
        Non e' un consiglio al modello — se non ha gli orari non puo' dirli.
      */
      const fasciaDetta = Boolean(fascia.oraDa || fascia.oraA || dati.subito === true);
      if (!fasciaDetta && giorni.length > 0) {
        const conta = (g: { slots: SlotProposto[] }, mattina: boolean) =>
          g.slots.filter(s => (Number(s.time.slice(0, 2)) < 13) === mattina).length;
        const mattina = giorni.reduce((n, g) => n + conta(g, true), 0);
        const pomeriggio = giorni.reduce((n, g) => n + conta(g, false), 0);
        if (mattina > 0 && pomeriggio > 0) {
          return JSON.stringify({
            trovato: true,
            chiediPrima: true,
            daScrivere: 'Preferisci mattina o pomeriggio?',
            quanti: { mattina, pomeriggio },
            giorniConPosto: giorni.map(g => dataParlata(g.date, oggi)),
            nota: 'Gli orari non te li do finche\' non sai la fascia: scrivi "daScrivere" e aspetta. '
              + 'Poi richiama questo strumento con dalle/alle (mattina 09:00-13:00, pomeriggio 13:00-20:00).',
          });
        }
      }

      /*
        «Pieno» e «nessuno ha messo i turni» non sono la stessa cosa.

        Finivano nella stessa frase, e quella frase arrivava alla cliente: si e'
        sentita dire che domani e sabato erano pieni quando il centro era
        aperto e il problema stava altrove. Un giorno senza turni in agenda non
        e' un no da dare a una cliente — e' una cosa che al centro devono
        sapere.
      */
      const senzaTurni = vuoti.filter(v => v.motivo === 'nessunTurno').map(v => dataParlata(v.date, oggi));
      const chiusi = vuoti.filter(v => v.motivo === 'chiuso').map(v => dataParlata(v.date, oggi));
      const agenda = {
        ...(chiusi.length ? { centroChiuso: chiusi } : {}),
        ...(senzaTurni.length ? {
          senzaTurniInAgenda: senzaTurni,
          attenzione: 'In quei giorni il centro e\' APERTO ma in agenda non c\'e\' nessuna operatrice in turno. '
            + 'NON dire alla cliente che e\' pieno: non lo sappiamo. Proponi gli altri giorni, e se lei puo\' '
            + 'solo in quelli usa "passa_a_persona" dicendo che in agenda mancano i turni.',
        } : {}),
      };

      if (giorni.length > 0) {
        return JSON.stringify({
          trovato: true,
          durataMinuti: durataTotale,
          prezzo: prezzoTotale,
          giorni: giorni.slice(0, 4).map(dillo),
          ...agenda,
        });
      }

      /*
        Niente posto nel giorno chiesto: si guarda avanti PRIMA di rispondere.

        Un «quel giorno non c'è posto» secco costringe la cliente a chiedere di
        nuovo, e a ogni giro se ne perde un pezzo per strada. Al banco nessuno
        risponde così: si dice subito qual è il primo giorno buono. Qui la
        seconda ricerca costa una query e fa la differenza fra un bot e una
        segretaria.
      */
      if (quanti === 1) {
        const vicini = await cercaSlot({
          dateFrom, giorni: 14, services, gender: sesso, ...fascia, maxPerGiorno: 4,
        });
        if (vicini.giorni.length > 0) {
          return JSON.stringify({
            trovato: false,
            quelGiornoNo: dataParlata(dateFrom, oggi),
            durataMinuti: vicini.durataTotale,
            prezzo: vicini.prezzoTotale,
            maCiSarebbe: vicini.giorni.slice(0, 3).map(dillo),
            ...agenda,
            nota: 'Dille che quel giorno non c\'è posto e proponi subito il primo utile, in un messaggio solo.',
          });
        }
      }

      return JSON.stringify({
        trovato: false,
        durataMinuti: durataTotale,
        prezzo: prezzoTotale,
        ...agenda,
        nota: 'Niente posto con questi criteri, nemmeno allargando. NON chiudere qui la conversazione e non '
          + 'mandarla a telefonare: chiedile se le va bene un\'altra fascia oraria o un altro giorno, e se lei '
          + 'può solo in quei giorni usa "passa_a_persona" — al banco un buco lo trovano quasi sempre, tu no.',
      });
    }

    case 'verifica_prenotazione': {
      const ignota = await operatriceIgnota(serviziDa(dati));
      if (ignota) return ignota;
      const p = await preparaPrenotazione({
        phone: ctx.phone,
        clientName: dati.nome,
        services: serviziDa(dati),
        date: dati.data,
        startTime: dati.ora,
        gender: sesso,
      });
      if (!p.ok) return JSON.stringify({ ok: false, codice: p.codice, messaggio: p.messaggio });

      const gettone = firmaConferma(p.dati);
      if (!gettone) return JSON.stringify({ ok: false, codice: 'CONFIG', messaggio: 'Prenotazione non configurata: passa al centro.' });

      return JSON.stringify({
        ok: true,
        riepilogo: p.riepilogo,
        daScrivere: `${p.riepilogo} Confermi?`,
        gettone,
        nota: 'Scrivi "daScrivere" alla cliente e aspetta. Chiama "prenota" solo dopo il suo sì.',
      });
    }

    case 'prenota': {
      const confermato = leggiConferma<DatiPrenotazione>(dati.gettone);
      if (!confermato) {
        return JSON.stringify({
          ok: false,
          codice: 'SERVE_CONFERMA',
          messaggio: 'Gettone mancante o scaduto. Rifai "verifica_prenotazione", riscrivi il riepilogo e fatti confermare di nuovo.',
        });
      }
      const esito = await scriviAppuntamento(confermato, {
        createdBy: 'wa-segretaria',
        nota: 'Prenotazione su WhatsApp',
        canale: 'segretaria WhatsApp',
      });
      if (!esito.ok) return JSON.stringify({ ok: false, codice: esito.codice, messaggio: esito.messaggio });

      ctx.prenotato = { id: esito.appuntamento.id, clientId: esito.appuntamento.clientId };
      /*
        Nessuna conferma automatica qui: la segretaria sta per scriverlo in
        chat lei stessa, e un template identico subito dopo è il doppione
        classico che fa disattivare le notifiche.
      */
      return JSON.stringify({
        ok: true,
        confermato: quandoParlato(esito.appuntamento.date, esito.appuntamento.startTime, oggi),
        con: esito.appuntamento.operatorName.split(' ')[0],
        trattamento: esito.appuntamento.treatmentName,
        prezzo: esito.appuntamento.price,
        nota: 'Fatto. Diglielo in una frase. Non chiedere altre conferme.',
      });
    }

    case 'sposta_appuntamento': {
      const esito = await spostaAppuntamento({
        appointmentId: String(dati.appuntamentoId || ''),
        newDate: String(dati.data || ''),
        newTime: String(dati.ora || ''),
      });
      return esito.ok
        ? JSON.stringify({ ok: true, spostatoA: quandoParlato(esito.date, esito.startTime, oggi), con: esito.operatorName.split(' ')[0] })
        : JSON.stringify({ ok: false, codice: esito.codice, messaggio: esito.messaggio });
    }

    case 'disdici_appuntamento': {
      const esito = await disdiciAppuntamento(String(dati.appuntamentoId || ''));
      return esito.ok
        ? JSON.stringify({ ok: true, disdetto: quandoParlato(esito.date, esito.startTime, oggi), trattamento: esito.treatmentName })
        : JSON.stringify({ ok: false, codice: esito.codice, messaggio: esito.messaggio });
    }

    case 'passa_a_persona': {
      const motivo = String(dati.motivo || 'senza motivo indicato').slice(0, 400);
      ctx.passata = motivo;
      const sch = await scheda(ctx);
      const chi = sch ? sch.nomeCompleto : ctx.phone;

      /*
        A chi passa la palla, davvero.

        Telegram è il modo veloce, ma è configurabile: se non lo è —  o se il
        bot è stato tolto, o il token è scaduto — `sendTelegram` risponde
        ok:false e non se ne accorge nessuno. Una chiamata d'aiuto che finisce
        nel vuoto è peggio di non averla fatta: la segretaria ha detto alla
        cliente «ti fa sapere una collega», e la collega non sa niente.

        Quindi il posto sicuro è il gestionale: la conversazione torna DA
        LEGGERE nella schermata WhatsApp, con il numerino sul menù. Quello si
        vede sempre, anche senza Telegram, anche domani mattina.
      */
      await markConversationUnread(ctx.phone).catch(() => {});

      const avvisato = await sendTelegram(
        `🙋 *Serve una persona su WhatsApp*\n\n${chi} (${ctx.phone})\n\n${motivo}\n\n`
        + `_La chat è segnata da leggere nel gestionale._`
      ).catch(() => ({ ok: false as const, error: 'errore' }));

      if (!avvisato.ok) {
        console.log(`[wa-segretaria] ${ctx.phone}: passata a una persona, Telegram non ha avvisato (${avvisato.error}) — resta la chat da leggere`);
      }

      return JSON.stringify({
        ok: true,
        nota: 'Il centro è stato avvisato e la chat risulta da leggere. Scrivi alla cliente che la fai '
          + 'ricontattare da una collega, in una frase, e fermati.',
      });
    }

    default:
      return JSON.stringify({ errore: `Strumento sconosciuto: ${nome}` });
  }
}

/**
 * Le foto che la cliente manda.
 *
 * Prima finivano nel vuoto: il webhook lasciava cadere qualunque allegato
 * senza didascalia, quindi chi mandava la foto delle unghie che vuole rifare
 * — che è il modo normale di chiedere quella cosa — non riceveva risposta.
 *
 * Adesso la segretaria le guarda. Con un limite che non è tecnico ma di
 * mestiere, e sta nelle istruzioni: qui non si fa medicina, e da una foto non
 * si valuta niente comunque. Una foto di unghie serve a capire che modello
 * vuole; una foto di pelle serve solo a fissare la visita.
 */
const MIME_GUARDABILI = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Quante foto guardare in un turno, e quanto grandi. */
const MAX_FOTO = 2;
const MAX_BYTE_FOTO = 3_500_000;

async function scaricaFoto(
  foto: Array<{ id: string; mime?: string }>
): Promise<Anthropic.ImageBlockParam[]> {
  const blocchi: Anthropic.ImageBlockParam[] = [];

  for (const f of foto.slice(-MAX_FOTO)) {
    const scaricata = await fetchD360Media(f.id).catch(() => null);
    if (!scaricata?.ok) continue;
    if (scaricata.body.byteLength > MAX_BYTE_FOTO) continue;

    const tipo = (scaricata.mimeType || f.mime || '').split(';')[0].trim();
    if (!MIME_GUARDABILI.has(tipo)) continue;

    blocchi.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: tipo as Anthropic.Base64ImageSource['media_type'],
        data: Buffer.from(scaricata.body).toString('base64'),
      },
    });
  }

  return blocchi;
}

/**
 * Quello che il centro e la cliente si sono gia' detti, prima di oggi.
 *
 * Senza questo la segretaria comincia da zero con una persona con cui il
 * centro parla da mesi: le chiede come si chiama, le ripropone una cosa che
 * aveva gia' rifiutato, le dice «ciao!» a una conversazione aperta da tre
 * settimane. La scheda cliente dice chi e' e cosa ha fatto in cabina; solo la
 * chat dice cosa vi siete detti.
 *
 * Si legge una volta sola, quando la memoria della segretaria per quel numero
 * e' vuota: da li' in poi la conversazione se la tiene lei.
 *
 * I messaggi in uscita non partiti (`ok: false`) restano fuori: la cliente non
 * li ha mai letti, e farglieli credere detti e' peggio che non averli.
 */
async function storicoDaArchivio(phone: string): Promise<Battuta[]> {
  const messaggi = await listMessages(phone, 80).catch(() => []);
  return messaggi
    .filter(m => m.text?.trim() && (m.direction === 'in' || m.ok !== false))
    .slice(-MEMORIA_TURNI)
    .map(m => ({
      role: m.direction === 'in' ? ('user' as const) : ('assistant' as const),
      /*
        Quando ha risposto una persona, si dice.

        Non e' un dettaglio di forma: cambia cosa deve fare adesso. Se una
        collega ha gia' promesso un orario o ha gia' preso in mano la
        questione, la segretaria non deve ricominciare da capo ne'
        contraddirla — e senza questa riga quelle frasi le sembrano sue.
      */
      text: m.direction === 'out' && m.source === 'manual'
        ? `(scritto da una collega del centro) ${m.text.trim()}`
        : m.text.trim(),
    }));
}

// ============================================================
// Il turno
// ============================================================

/** Quello che la segretaria deve sapere di QUESTA chat, oltre alle istruzioni generali. */
async function contestoDiChat(phone: string): Promise<string> {
  const adesso = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const righe = [
    `Adesso è ${adesso} (data di oggi: ${todayInItaly()}).`,
    `Stai scrivendo su WhatsApp al numero ${phone}.`,
  ];

  /*
    Aperto o chiuso ADESSO, detto qui, come fatto.

    Prima il modello aveva l'ora corrente e — solo se chiamava `info_centro` —
    gli orari, e doveva incrociarli da sé. Un giovedì alle 15:21, col centro
    aperto fino alle 19, ha scritto a una cliente «il centro adesso è chiuso,
    riapre domani alle 9». Non era un dato sbagliato: era un conto che nessuno
    gli aveva fatto. Adesso glielo facciamo noi, e non c'è più niente da
    dedurre.

    Stessa cosa per il telefono: se in anagrafica non c'è, va detto che non
    c'è. Lasciato vuoto e basta, si è visto scrivere a una cliente «chiama il
    centro: 0823… (numero che mi serve dal centro)» — il segnaposto, testuale,
    dentro WhatsApp.
  */
  const centro = await leggiCentro().catch(() => null);
  if (centro) {
    const oggi = todayInItaly();
    const dow = new Date(oggi + 'T12:00:00').getDay();
    const orarioOggi = centro.orari?.[String(dow === 0 ? 7 : dow)] ?? null;
    const minutiAdesso = Number(
      new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date())
    ) * 60 + Number(
      new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', minute: '2-digit' }).format(new Date())
    );
    const inMinuti = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

    if (eChiuso(centro, oggi)) {
      righe.push('OGGI IL CENTRO È CHIUSO (giorno di riposo o chiusura straordinaria).');
    } else if (orarioOggi && minutiAdesso >= inMinuti(orarioOggi.apre) && minutiAdesso < inMinuti(orarioOggi.chiude)) {
      righe.push(`IN QUESTO MOMENTO IL CENTRO È APERTO (oggi ${orarioOggi.apre}–${orarioOggi.chiude}). Non dire che è chiuso.`);
    } else if (orarioOggi) {
      righe.push(`In questo momento il centro è chiuso: oggi l'orario è ${orarioOggi.apre}–${orarioOggi.chiude}.`);
    }

    righe.push(
      centro.telefono
        ? `Il numero del centro è ${centro.telefono}: è l'UNICO che puoi dare.`
        : 'Nei dati NON c\'è nessun numero di telefono del centro. Non scriverne uno: non esiste un numero '
          + 'da dare. Se serve parlare con una persona usa "passa_a_persona", non mandare la cliente a chiamare.'
    );
  }

  const lead = await leadDaTelefono(phone).catch(() => null);
  if (lead && !lead.clientId) {
    righe.push(
      `Questa persona ha lasciato i contatti sul sito il ${lead.createdAt.slice(0, 10)}`
      + (lead.service ? ` per: ${lead.service}.` : '.')
      + (lead.message ? ` Ha scritto: «${lead.message.slice(0, 300)}».` : '')
      + ' Le abbiamo scritto noi per primi: non fare finta che sia stata lei a cominciare.'
    );
  }

  return righe.join('\n');
}

interface EsitoTurno { risposto: boolean; motivo?: string }

/** Come è finito un giro: con una risposta, o con la richiesta di salire di modello. */
type EsitoGiro =
  | { tipo: 'risposta'; testo: string }
  | { tipo: 'niente' }
  | { tipo: 'sali'; strumento: string };

async function eseguiTurno(
  phone: string,
  messaggi: string[],
  foto: Array<{ id: string; mime?: string }>,
  stato: StatoChat,
  livello: Livello,
  ctx: Contesto,
  poteri: Poteri
): Promise<EsitoGiro> {
  const client = new Anthropic();
  const model = modelloPer(livello);

  const [istruzioni, contesto] = await Promise.all([
    costruisciIstruzioni('whatsapp'),
    contestoDiChat(phone),
  ]);

  /*
    La raffica diventa un messaggio solo. Non è una semplificazione: le tre
    righe che la cliente ha scritto in dieci secondi sono UNA cosa che voleva
    dire, e leggerle insieme è l'unico modo di rispondere una volta sola con
    tutto dentro.
  */
  const domanda = messaggi.join('\n').trim();

  /*
    Le foto viaggiano solo in questo turno. In memoria resta la riga di testo:
    tenersi le immagini in tutta la conversazione costerebbe a ogni battuta,
    e quello che conta — che cosa si sono detti guardandola — sta già nelle
    parole.
  */
  const immagini = foto.length > 0 ? await scaricaFoto(foto) : [];
  const contenuto: Anthropic.ContentBlockParam[] = immagini.length > 0
    ? [...immagini, { type: 'text', text: domanda || 'Ti ha mandato questa foto, senza scriverci niente.' }]
    : [{ type: 'text', text: domanda }];

  const conversazione: Anthropic.MessageParam[] = [
    ...stato.turni.map(t => ({ role: t.role, content: t.text })),
    { role: 'user' as const, content: contenuto },
  ];

  let testoFinale = '';

  /*
    Gli orari che il modello ha il diritto di scrivere.

    Sono quelli usciti dagli strumenti in questo turno, piu' quelli che ha
    scritto la cliente (se chiede «posso alle 16?», rispondere «alle 16 non
    c'e' posto» deve restare possibile). Tutto il resto e' inventato.

    Non e' teoria: «Mariarosaria oggi ha posto alle 11:00 o alle 15:30» e
    «domani alle 10:30 oppure alle 17:00» sono partiti davvero, con Rosaria
    occupata alle 11:00 e nessuno libero alle 10:30. Le istruzioni scritte
    negli strumenti non bastano — un modello economico le legge e poi tira a
    indovinare lo stesso. Questo invece non e' un consiglio: e' una porta.
  */
  const orariLeciti = new Set<string>(orariIn(domanda));
  for (const t of stato.turni) if (t.role === 'user') for (const o of orariIn(t.text)) orariLeciti.add(o);
  let giaCorretto = false;

  for (let giro = 0; giro < MAX_GIRI_STRUMENTI; giro++) {
    const risposta = await client.messages.create({
      model,
      max_tokens: 1200,
      /*
        Il prompt è in due blocchi, e la divisione non è estetica.

        La cache è un confronto di prefisso: si paga per intero la prima volta
        e un decimo dalla seconda, ma un solo byte diverso all'inizio la
        annulla tutta. Le istruzioni e gli strumenti non cambiano mai da una
        battuta all'altra: stanno prima, con il segnaposto. I dati di questa
        chat — che contengono l'ora, quindi cambiano da soli ogni minuto —
        stanno dopo, dove non possono invalidare niente.

        Non è un dettaglio da centesimi: un turno con gli strumenti sono fino a
        otto chiamate, e ognuna rimanda istruzioni e strumenti da capo. Senza
        cache si paga otto volte la stessa pagina.
      */
      system: [
        { type: 'text', text: istruzioni, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: [limitiDiOggi(poteri), `## Questa conversazione\n\n${contesto}`].filter(Boolean).join('\n\n'),
        },
      ],
      tools: strumentiPer(poteri),
      /*
        Pensa quanto serve, ma non è un compito di matematica: è una segretaria
        che deve rispondere in fretta a «quanto costa la ceretta». Le decisioni
        delicate — prenotare, spostare, disdire — non le protegge lo sforzo del
        modello ma il gettone di conferma, che è una porta e non un consiglio.
      */
      /*
        I parametri di ragionamento non sono uguali per tutti i modelli, e
        sbagliarli non degrada: rifiuta la richiesta. Li sceglie
        `parametriRagionamento` insieme al modello, che è la stessa decisione.
      */
      ...parametriRagionamento(model),
      messages: conversazione,
    });

    const testo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('\n').trim();

    const richieste = risposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (richieste.length === 0) {
      const inventati = [...new Set(orariIn(testo))].filter(o => !orariLeciti.has(o));
      if (inventati.length > 0) {
        console.error(`[wa-segretaria] ${phone}: orari non verificati nel messaggio (${inventati.join(', ')}) — non lo mando`);
        if (!giaCorretto) {
          /*
            Una seconda possibilita', con l'errore in faccia. Quasi sempre
            basta: il modello richiama lo strumento e riscrive gli orari veri.
          */
          giaCorretto = true;
          conversazione.push({ role: 'assistant', content: testo });
          conversazione.push({
            role: 'user',
            content: [{
              type: 'text',
              text: 'CONTROLLO DEL GESTIONALE: nel messaggio che hai scritto ci sono orari che nessuno '
                + `strumento ti ha dato (${inventati.join(', ')}). Quel messaggio NON e' stato mandato. `
                + 'Chiama "quando_c_e_posto" con i parametri giusti — e se la cliente ha nominato una persona, '
                + 'prendi prima il suo id da "operatrici" — poi riscrivi usando SOLO gli orari tornati dallo '
                + 'strumento. Se non ci sono orari, dillo: e\' meglio di un orario inventato.',
            }],
          });
          continue;
        }
        // Ha insistito: il turno non produce niente. Meglio il silenzio (e la
        // chat che resta da leggere al banco) di un appuntamento inesistente.
        return livello === 'lavoro'
          ? { tipo: 'sali', strumento: 'orari non verificati' }
          : { tipo: 'niente' };
      }
      // Fine del ragionamento: questo è quello che la cliente legge.
      testoFinale = testo;
      break;
    }

    /*
      Il modello economico ha allungato la mano su qualcosa che scrive.

      Qui non si discute e non si chiede conferma: si butta via il turno e si
      rifà con la testa buona, dalla stessa conversazione. Continuare — far
      confermare al modello grosso una decisione già presa dal piccolo — non
      servirebbe a niente: il giorno e l'ora li ha scelti lui due righe fa.
    */
    if (livello === 'lavoro') {
      const delicato = richieste.find(r => STRUMENTI_DELICATI.has(r.name));
      if (delicato) return { tipo: 'sali', strumento: delicato.name };
    }

    /*
      Il testo prodotto MENTRE sta ancora usando gli strumenti non parte: è il
      «un attimo che controllo» che al telefono serve e in chat è solo una
      bolla in più. Resta nella conversazione perché il modello si ricordi di
      averlo pensato, ma alla cliente arriva solo l'ultimo messaggio.
    */
    conversazione.push({ role: 'assistant', content: risposta.content });

    const risultati: Anthropic.ToolResultBlockParam[] = [];
    /*
      Quando la ricerca torna a mani vuote, il turno risale.

      «Non c'è posto» è la frase che fa perdere una cliente, ed è anche il
      momento in cui il modello piccolo comincia a inventare: si e' visto
      dichiarare il centro chiuso di giovedi' pomeriggio e dettare un numero di
      telefono che non esiste, pur di chiudere il discorso. Se la risposta e'
      un no, la scrive la testa buona — che semmai passa la palla a una
      collega invece di mandare via la cliente.
    */
    let ricercaAVuoto = false;

    for (const r of richieste) {
      let contenuto: string;
      try {
        contenuto = await esegui(r.name, r.input, ctx);
      } catch (err) {
        console.error(`[wa-segretaria] strumento ${r.name} in errore`, err);
        contenuto = JSON.stringify({ errore: 'Lo strumento non ha risposto. Non inventare il dato: passa al centro.' });
      }

      /*
        Cosa ha chiesto e cosa si è sentito rispondere, nel log.

        Senza questa riga «il bot ha detto una cosa falsa» non si può né
        confermare né smentire: non si sa se abbia letto male il gestionale o
        se se lo sia inventato, e sono due bug diversi con due rimedi diversi.
      */
      console.log(
        `[wa-segretaria] ${ctx.phone} · ${r.name}(${JSON.stringify(r.input).slice(0, 200)})`
        + ` → ${contenuto.slice(0, 300)}`
      );

      // Quello che lo strumento ha davvero risposto diventa l'unico orario dicibile.
      for (const o of orariIn(contenuto)) orariLeciti.add(o);

      if (r.name === 'quando_c_e_posto' && contenuto.includes('"trovato":false')) ricercaAVuoto = true;

      risultati.push({ type: 'tool_result', tool_use_id: r.id, content: contenuto });
    }

    if (livello === 'lavoro' && ricercaAVuoto) {
      return { tipo: 'sali', strumento: 'quando_c_e_posto (nessun posto trovato)' };
    }

    conversazione.push({ role: 'user', content: risultati });

    // Se il turno finisce senza altro testo, almeno questo è già stato detto.
    if (testo) testoFinale = testo;
  }

  return testoFinale
    ? { tipo: 'risposta', testo: testoFinale }
    : { tipo: 'niente' };
}

/**
 * Il turno completo: sceglie chi risponde, semmai lo rifà con la testa buona,
 * e manda UN messaggio.
 *
 * L'invio sta qui e in nessun altro posto. È il motivo per cui una escalation
 * non produce due messaggi: il giro del modello economico che finisce con
 * «sali» non ha ancora scritto niente a nessuno.
 */
async function turno(
  phone: string,
  messaggi: string[],
  foto: Array<{ id: string; mime?: string }>,
  statoIniziale: StatoChat,
  daVocale: boolean,
  poteri: Poteri
): Promise<EsitoTurno> {
  let stato = statoIniziale;
  const ctx: Contesto = { phone, clienteId: null, passata: null, prenotato: null };

  /*
    La conversazione si rilegge dall'archivio OGNI VOLTA, non solo la prima.

    `turni` e' la memoria del bot, e contiene solo quello che ha detto lui e
    quello che gli e' stato detto mentre rispondeva. Non contiene i messaggi
    scritti a mano dalle ragazze dal gestionale: quelli non ci sono mai
    entrati. E siccome prima l'archivio si leggeva solo a `turni` vuoto, dopo
    la prima risposta la segretaria restava cieca su tutto quello che avevano
    scritto le colleghe — per sempre.

    Si e' visto: il 26 agosto la cliente aveva gia' detto che trattamento
    voleva, il 28 ha scritto «possibile oggi verso le 11» e si e' sentita
    chiedere «per quale trattamento?». La risposta giusta era due messaggi
    sopra, nella stessa chat.

    L'archivio invece e' quello che la cliente ha davvero davanti sul
    telefono, chiunque l'abbia scritto. E' l'unica versione che conta, e
    adesso e' quella che legge anche lei. `turni` resta come rete: se
    l'archivio non risponde, meglio la memoria parziale che nessuna.
  */
  const storico = await storicoDaArchivio(phone);
  if (storico.length > 0) {
    stato = { ...stato, turni: storico };
  }

  const partenza = livelloDiPartenza({
    conFoto: foto.length > 0,
    daVocale,
    giaSalita: stato.livello === 'testa',
  });

  let livello = partenza.livello;
  let esito = await eseguiTurno(phone, messaggi, foto, stato, livello, ctx, poteri);

  if (esito.tipo === 'sali') {
    console.log(`[wa-segretaria] ${phone}: sale sul modello grosso (ha chiesto ${esito.strumento})`);
    livello = 'testa';
    // Il contesto si rifà pulito: quello di prima porta dentro le tracce di un
    // turno che stiamo buttando via.
    const ctxPulito: Contesto = { phone, clienteId: null, passata: null, prenotato: null };
    esito = await eseguiTurno(phone, messaggi, foto, stato, livello, ctxPulito, poteri);
    Object.assign(ctx, ctxPulito);
  } else {
    console.log(`[wa-segretaria] ${phone}: risponde il modello di ${livello} (${partenza.perche})`);
  }

  if (esito.tipo !== 'risposta') {
    return { risposto: false, motivo: 'il modello non ha prodotto una risposta' };
  }

  const inviato = await rispondiUnaVolta(phone, esito.testo, 'assistant');
  if (!inviato.inviato) return { risposto: false, motivo: inviato.motivo };

  // Lo stato si salva DOPO l'invio riuscito: se il messaggio non è partito, la
  // conversazione non deve risultare andata avanti.
  await scriviStato({
    ...stato,
    turni: [
      ...stato.turni,
      { role: 'user', text: foto.length > 0 ? `[foto] ${messaggi.join('\n')}`.trim() : messaggi.join('\n') },
      { role: 'assistant', text: esito.testo },
    ],
    risposteOggi: stato.risposteOggi + 1,
    pendenti: [],
    fotoPendenti: [],
    livello,
    mutoFino: ctx.passata
      ? new Date(Date.now() + MUTO_ORE * 3_600_000).toISOString()
      : stato.mutoFino,
    passataMotivo: ctx.passata || stato.passataMotivo,
  });

  // Il contatto arrivato dal sito avanza da solo: chi ha già prenotato non va
  // richiamato dal centro.
  if (ctx.prenotato) {
    await avanzaLead(phone, 'prenotato', {
      appointmentId: ctx.prenotato.id,
      clientId: ctx.prenotato.clientId,
      nota: 'appuntamento preso dalla segretaria su WhatsApp',
    }).catch(() => {});
  } else {
    await avanzaLead(phone, 'in_chat').catch(() => {});
  }

  return { risposto: true };
}

// ============================================================
// La porta d'ingresso
// ============================================================

export interface EsitoSegretaria { handled: boolean; reason?: string }

/**
 * Un messaggio in arrivo.
 *
 * Non lancia mai: il webhook deve rispondere 200 comunque, altrimenti Meta
 * riconsegna e la cliente riceve tutto due volte.
 */
export async function handleSegretariaMessage(params: {
  phone: string;
  text: string;
  messageId?: string;
  contactName?: string;
  /** Allegato, se il messaggio ne aveva uno. */
  media?: WaMedia;
}): Promise<EsitoSegretaria> {
  const { phone, text, messageId, media } = params;

  try {
    const cfg = await getWaAutomationsConfig();
    if (!cfg.segretaria) return { handled: false, reason: 'segretaria spenta' };

    /*
      La fascia oraria, quando c'e'.

      Fuori fascia non risponde, ma la conversazione resta DA LEGGERE nel
      gestionale: chi scrive alle nove di sera non deve sparire, deve solo
      aspettare una persona. Un silenzio senza traccia sarebbe peggio di una
      risposta tardiva.

      La fascia puo' anche scavalcare la mezzanotte (22:00-02:00): non e' il
      caso di un centro estetico, ma costa una riga e evita che un giorno
      qualcuno la imposti cosi' e si ritrovi la segretaria muta sempre.
    */
    if (cfg.segretariaDalle || cfg.segretariaAlle) {
      const adesso = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date()).replace('.', ':');
      const dalle = cfg.segretariaDalle || '00:00';
      const alle = cfg.segretariaAlle || '23:59';
      const dentro = dalle <= alle
        ? adesso >= dalle && adesso <= alle
        : adesso >= dalle || adesso <= alle;

      if (!dentro) {
        await markConversationUnread(phone).catch(() => {});
        return { handled: false, reason: `fuori orario della segretaria (${dalle}-${alle}), sono le ${adesso}` };
      }
    }
    if (fuoriDalCollaudo(phone)) return { handled: false, reason: 'collaudo: numero non in elenco' };
    if (!process.env.ANTHROPIC_API_KEY) return { handled: false, reason: 'manca ANTHROPIC_API_KEY' };
    if (!text.trim() && !media) return { handled: false, reason: 'messaggio vuoto' };

    // Riconsegna di Meta: già letto, già risposto.
    if (!(await registraArrivo(phone, messageId))) {
      return { handled: true, reason: 'messaggio già elaborato' };
    }

    /*
      Il vocale si ascolta.

      In Italia una richiesta su due arriva così, e prima cadeva nel vuoto: la
      cliente mandava quaranta secondi di audio, non riceveva niente, lo
      rimandava, poi scriveva «ci sei?».

      La trascrizione prende il posto del testo e da lì in poi il turno è
      identico a quello di un messaggio scritto — attesa del silenzio compresa,
      così «vocale + poi scrivo anche la data» diventa una risposta sola.

      Quello che NON si fa è fidarsi: sotto la soglia di confidenza si torna a
      chiedere di riscrivere, e la prenotazione passa comunque dal gettone, che
      obbliga a mettere il riepilogo per iscritto prima di toccare l'agenda. Un
      cognome storpiato dall'audio si ferma lì, come al telefono.
    */
    let testoUtile = text;
    let daVocale = false;

    if (media?.kind === 'audio' && !media.caption && trascrizioneConfigurata()) {
      const detto = await trascriviVocale(media);
      if (detto.ok) {
        testoUtile = detto.testo;
        daVocale = true;
        // In chat, sotto il vocale, resta scritto cosa ha detto: dal gestionale
        // quel numero su WhatsApp non si apre più, e «🎤 Messaggio vocale» a chi
        // rilegge la conversazione non dice niente.
        await archiviaTrascrizione({ phone, messageId, testo: detto.testo });
      } else {
        console.log(`[wa-segretaria] ${phone}: vocale non trascritto (${detto.motivo})`);
      }
    }

    /*
      Quello che resta senza parole: vocali non trascritti, video, documenti.

      La riga di risposta parte una volta sola — `rispondiUnaVolta` rifiuta lo
      stesso testo entro dieci minuti — quindi tre vocali di fila non diventano
      tre risposte identiche.
    */
    if (media && media.kind !== 'image' && !media.caption && !daVocale) {
      if (media.kind === 'sticker') return { handled: true, reason: 'sticker: niente da rispondere' };

      const cosa = media.kind === 'audio' ? 'il vocale' : 'quello che hai mandato';
      const esito = await rispondiUnaVolta(
        phone,
        `Scusa, ${cosa} non riesco ad aprirlo da qui. Me lo scrivi in due righe? `
        + 'Così ti rispondo subito. Altrimenti ci risente una collega dal centro.',
        'assistant'
      );
      sendTelegram(
        `🎤 *Allegato su WhatsApp da leggere*\n\n${phone} ha mandato ${media.kind === 'audio' ? 'un vocale' : `un ${media.kind}`}. `
        + 'La segretaria non è riuscita a leggerlo: guardalo dalla chat nel gestionale.'
      ).catch(() => {});
      return esito.inviato ? { handled: true } : { handled: false, reason: esito.motivo };
    }

    let stato = await leggiStato(phone);

    if (stato.spenta) {
      return { handled: false, reason: 'segretaria spenta a mano su questa conversazione' };
    }
    if (stato.mutoFino && stato.mutoFino > new Date().toISOString()) {
      // L'ora serve: nel log «passata a una persona» da solo sembra un blocco
      // definitivo, e invece scade — chi guarda deve sapere quando.
      const fino = new Date(stato.mutoFino).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
      });
      return { handled: false, reason: `passata a una persona, tace fino alle ${fino}` };
    }
    if (stato.risposteOggi >= MAX_RISPOSTE_GIORNO) {
      return { handled: false, reason: 'tetto giornaliero raggiunto per questo numero' };
    }

    // Il messaggio entra in coda PRIMA dell'attesa: chi risponderà per tutti
    // deve trovarci dentro anche questo, foto compresa.
    await scriviStato({
      ...stato,
      pendenti: [
        ...stato.pendenti,
        // Il modello deve sapere che quella riga arriva da un vocale: sui nomi
        // e sugli orari deve chiedere conferma invece di darli per buoni.
        daVocale ? `(vocale) ${testoUtile}` : testoUtile,
      ].filter(Boolean).slice(-12),
      fotoPendenti: media?.kind === 'image'
        ? [...(stato.fotoPendenti || []), { id: media.id, mime: media.mimeType }].slice(-4)
        : stato.fotoPendenti,
    });

    /*
      Si aspetta che la cliente abbia finito di scrivere. Se nel frattempo
      arriva un altro messaggio, a rispondere sarà quello: torniamo indietro
      senza dire niente, ed è esattamente il punto — una raffica di tre
      messaggi deve produrre UNA risposta, non tre.
    */
    if (!(await attendiSilenzio(phone, messageId))) {
      return { handled: true, reason: 'arrivato un altro messaggio: risponde quello' };
    }

    if (!(await prendiTurno(phone))) {
      return { handled: true, reason: 'un altro turno è già in corso su questo numero' };
    }

    try {
      stato = await leggiStato(phone);
      const messaggi = stato.pendenti.length > 0 ? stato.pendenti : [testoUtile].filter(Boolean);
      const esito = await turno(phone, messaggi, stato.fotoPendenti || [], stato, daVocale, {
        prenota: cfg.segretariaPrenota !== false,
        sposta: cfg.segretariaSposta !== false,
        disdice: cfg.segretariaDisdice !== false,
      });
      return esito.risposto
        ? { handled: true }
        : { handled: false, reason: esito.motivo };
    } finally {
      await rilasciaTurno(phone);
    }
  } catch (err) {
    console.error('[wa-segretaria] errore', err);
    await rilasciaTurno(phone).catch(() => {});
    return { handled: false, reason: err instanceof Error ? err.message : 'errore' };
  }
}

/** Vero se su questo numero la segretaria ha una conversazione in corso oggi. */
export async function segretariaInConversazione(phone: string): Promise<boolean> {
  const stato = await leggiStato(phone).catch(() => null);
  return Boolean(stato && stato.turni.length > 0 && stato.giorno === todayRome());
}

/**
 * Se la segretaria sta tacendo su questo numero, e perché.
 *
 * Serve al gestionale: senza, il passaggio a una persona è una porta che si
 * apre da sola e non si richiude. La cliente scrive, non le risponde più
 * nessuno, e dalla schermata WhatsApp non si capisce se sia rotto qualcosa o
 * se sia voluto. Qui c'è la risposta, con l'ora in cui la pausa scade.
 */
export async function passaggioInCorso(phone: string): Promise<{
  muta: boolean;
  spenta: boolean;
  fino?: string;
  motivo?: string;
}> {
  const stato = await leggiStato(normalizePhone(phone)).catch(() => null);
  if (stato?.spenta) return { muta: true, spenta: true };
  if (!stato?.mutoFino || stato.mutoFino <= new Date().toISOString()) return { muta: false, spenta: false };
  return { muta: true, spenta: false, fino: stato.mutoFino, motivo: stato.passataMotivo };
}

/**
 * Spegne la segretaria su QUESTA conversazione e basta.
 *
 * La pausa dopo un passaggio scade da sola; questa no. È per la cliente che
 * si vuole seguire di persona — una lamentela, una cosa delicata, una prova —
 * senza togliere la segretaria a tutte le altre.
 */
export async function spegniSegretaria(phone: string): Promise<void> {
  const normalizzato = normalizePhone(phone);
  const stato = await leggiStato(normalizzato);
  await scriviStato({ ...stato, spenta: true, passataMotivo: 'spenta a mano dal gestionale' });
  console.log(`[wa-segretaria] ${normalizzato}: spenta a mano su questa conversazione`);
}

/**
 * Ridà la parola alla segretaria su questo numero, subito.
 *
 * La usa chi ha finito di rispondere a mano: la pausa di quattro ore serve a
 * non parlarle sopra mentre ci sta parlando una persona, non a tenerla ferma
 * quando quella persona ha già chiuso.
 */
export async function riprendiSegretaria(phone: string): Promise<void> {
  const normalizzato = normalizePhone(phone);
  const stato = await leggiStato(normalizzato);
  await scriviStato({ ...stato, mutoFino: undefined, passataMotivo: undefined, spenta: false });
  console.log(`[wa-segretaria] ${normalizzato}: la segretaria riprende la conversazione`);
}

/**
 * Mentre una persona scrive a mano, la segretaria resta fuori.
 *
 * Senza questo la pausa scade a un'ora fissa dal passaggio: se la collega sta
 * ancora scrivendo alla cliente quando scattano le quattro ore, il bot rientra
 * a metà di una conversazione umana e risponde sopra. Ogni messaggio scritto a
 * mano fa ripartire il conto.
 */
export async function zittiscilaPerUnaPersona(phone: string): Promise<void> {
  const normalizzato = normalizePhone(phone);
  const stato = await leggiStato(normalizzato);
  await scriviStato({
    ...stato,
    mutoFino: new Date(Date.now() + MUTO_ORE * 3_600_000).toISOString(),
    passataMotivo: stato.passataMotivo || 'sta rispondendo una persona dal gestionale',
  });
}
