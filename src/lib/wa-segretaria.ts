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
import { leggiCentro, orariParlati, eChiuso } from './centro';
import { cercaSlot, type ServizioRichiesto } from './bookingEngine';
import { preparaPrenotazione, scriviAppuntamento, type DatiPrenotazione } from './vocePrenota';
import { spostaAppuntamento, disdiciAppuntamento, prossimiAppuntamenti } from './agendaAgente';
import { firmaConferma, leggiConferma } from './conferma';
import { findClientByPhone, todayInItaly, PREAVVISO_ORE } from './voice';
import { dataParlata, quandoParlato } from './parlato';
import { sendTelegram } from './telegram';
import { avanzaLead, leadDaTelefono } from './lead';
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

function modello(): string {
  return process.env.WA_SEGRETARIA_MODEL || 'claude-opus-5';
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
  /** Fino a quando la segretaria sta zitta perché ha passato la palla a una persona. */
  mutoFino?: string;
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
    mutoFino: s?.mutoFino,
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
      'Chi sta scrivendo, riconosciuto dal numero, con i suoi prossimi appuntamenti. '
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
      'I trattamenti con prezzo e durata veri, separati donna e uomo. '
      + 'Cerca per nome ("ceretta", "baffetto") o per categoria. Torna anche gli id, che servono per prenotare.',
    input_schema: {
      type: 'object',
      properties: {
        cerca: { type: 'string', description: 'Parte del nome del trattamento' },
        categoria: { type: 'string', description: 'nails, laser, waxing, facial, body, massage, makeup, consultation, hair' },
      },
    },
  },
  {
    name: 'quando_c_e_posto',
    description:
      'Gli orari davvero liberi, guardando i turni veri delle operatrici, le pause e quello che è già in agenda '
      + '(comprese le prenotazioni arrivate dall\'app). Non proporre MAI un orario che non sia uscito da qui.',
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
}

/** Esegue uno strumento e torna il testo che il modello leggerà. */
async function esegui(nome: string, input: unknown, ctx: Contesto): Promise<string> {
  const dati = (input || {}) as Record<string, unknown>;
  const oggi = todayInItaly();
  const sesso: 'male' | 'female' = dati.uomo === true ? 'male' : 'female';

  switch (nome) {
    case 'chi_e': {
      const cliente = await findClientByPhone(ctx.phone);
      const lead = await leadDaTelefono(ctx.phone);
      if (!cliente) {
        return JSON.stringify({
          inRubrica: false,
          nota: 'Numero non in rubrica: chiedi nome e cognome quando arrivi a prenotare, non prima.',
          dalSito: lead
            ? { chiesto: lead.service || null, messaggio: lead.message || null, quando: lead.createdAt.slice(0, 10) }
            : null,
        });
      }
      ctx.clienteId = cliente.id;
      const appuntamenti = await prossimiAppuntamenti(cliente.id);
      return JSON.stringify({
        inRubrica: true,
        nome: cliente.firstName,
        nomeCompleto: `${cliente.firstName} ${cliente.lastName}`.trim(),
        uomo: cliente.gender === 'M',
        prossimiAppuntamenti: appuntamenti.map(a => ({
          id: a.id,
          quando: quandoParlato(a.date, a.startTime, oggi),
          data: a.date,
          ora: a.startTime,
          trattamento: a.treatmentName,
          con: a.operatorName.split(' ')[0],
        })),
        dalSito: lead ? { chiesto: lead.service || null, quando: lead.createdAt.slice(0, 10) } : null,
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
        telefono: centro.telefono,
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
      const trattamenti = await prisma.treatment.findMany({
        where: {
          isActive: true,
          ...(categoria ? { category: categoria } : {}),
          ...(cerca ? { name: { contains: cerca, mode: 'insensitive' as const } } : {}),
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, category: true, duration: true, price: true,
          durationMale: true, durationFemale: true, priceMale: true, priceFemale: true,
        },
        take: 40,
      });
      if (trattamenti.length === 0) {
        return JSON.stringify({ trovati: 0, nota: 'Niente con questo nome. Non inventare: chiedi alla cliente di dirlo con parole sue, o passa al centro.' });
      }
      return JSON.stringify({
        trovati: trattamenti.length,
        trattamenti: trattamenti.map(t => ({
          id: t.id,
          nome: t.name,
          categoria: t.category,
          donna: { prezzo: t.priceFemale ?? t.price, durata: t.durationFemale ?? t.duration },
          uomo: { prezzo: t.priceMale ?? t.priceFemale ?? t.price, durata: t.durationMale ?? t.durationFemale ?? t.duration },
        })),
      });
    }

    case 'quando_c_e_posto': {
      const services = serviziDa(dati);
      if (services.length === 0) return JSON.stringify({ errore: 'Serve almeno un trattamento (usa "listino" per gli id).' });

      let dateFrom = oggi;
      let quanti = Math.min(Math.max(1, Number(dati.giorni) || 7), 30);
      if (typeof dati.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dati.data)) {
        if (dati.data < oggi) return JSON.stringify({ errore: 'Quella data è già passata.' });
        dateFrom = dati.data;
        quanti = 1;
      }

      const { giorni, durataTotale, prezzoTotale } = await cercaSlot({
        dateFrom,
        giorni: quanti,
        services,
        gender: sesso,
        oraDa: typeof dati.dalle === 'string' ? dati.dalle : null,
        oraA: typeof dati.alle === 'string' ? dati.alle : null,
        maxPerGiorno: 5,
      });

      if (giorni.length === 0) {
        return JSON.stringify({
          trovato: false,
          durataMinuti: durataTotale,
          prezzo: prezzoTotale,
          nota: 'Niente posto con questi criteri. Chiedi alla cliente se va bene un altro giorno o un\'altra fascia oraria.',
        });
      }

      return JSON.stringify({
        trovato: true,
        durataMinuti: durataTotale,
        prezzo: prezzoTotale,
        giorni: giorni.slice(0, 4).map(g => ({
          data: g.date,
          giorno: dataParlata(g.date, oggi),
          orari: g.slots.slice(0, 5).map(s => ({
            ora: s.time,
            con: [...new Set(s.assegnazioni.map(a => a.operatorName.split(' ')[0]))].join(' e '),
          })),
        })),
      });
    }

    case 'verifica_prenotazione': {
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
      const cliente = await findClientByPhone(ctx.phone);
      const chi = cliente ? `${cliente.firstName} ${cliente.lastName}`.trim() : ctx.phone;
      sendTelegram(
        `🙋 *Serve una persona su WhatsApp*\n\n${chi} (${ctx.phone})\n\n${motivo}`
      ).catch(() => {});
      return JSON.stringify({
        ok: true,
        nota: `Il centro è stato avvisato. Scrivi alla cliente che la fai ricontattare da una collega, in una frase, e fermati.`,
      });
    }

    default:
      return JSON.stringify({ errore: `Strumento sconosciuto: ${nome}` });
  }
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

async function turno(phone: string, messaggi: string[], stato: StatoChat): Promise<EsitoTurno> {
  const client = new Anthropic();

  const [istruzioni, contesto] = await Promise.all([
    costruisciIstruzioni('whatsapp'),
    contestoDiChat(phone),
  ]);

  const ctx: Contesto = { phone, clienteId: null, passata: null, prenotato: null };

  /*
    La raffica diventa un messaggio solo. Non è una semplificazione: le tre
    righe che la cliente ha scritto in dieci secondi sono UNA cosa che voleva
    dire, e leggerle insieme è l'unico modo di rispondere una volta sola con
    tutto dentro.
  */
  const domanda = messaggi.join('\n').trim();

  const conversazione: Anthropic.MessageParam[] = [
    ...stato.turni.map(t => ({ role: t.role, content: t.text })),
    { role: 'user' as const, content: domanda },
  ];

  let testoFinale = '';

  for (let giro = 0; giro < MAX_GIRI_STRUMENTI; giro++) {
    const risposta = await client.messages.create({
      model: modello(),
      max_tokens: 1200,
      system: `${istruzioni}\n\n## Questa conversazione\n\n${contesto}`,
      tools: STRUMENTI,
      messages: conversazione,
    });

    const testo = risposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('\n').trim();

    const richieste = risposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (richieste.length === 0) {
      // Fine del ragionamento: questo è quello che la cliente legge.
      testoFinale = testo;
      break;
    }

    /*
      Il testo prodotto MENTRE sta ancora usando gli strumenti non parte: è il
      «un attimo che controllo» che al telefono serve e in chat è solo una
      bolla in più. Resta nella conversazione perché il modello si ricordi di
      averlo pensato, ma alla cliente arriva solo l'ultimo messaggio.
    */
    conversazione.push({ role: 'assistant', content: risposta.content });

    const risultati: Anthropic.ToolResultBlockParam[] = [];
    for (const r of richieste) {
      let contenuto: string;
      try {
        contenuto = await esegui(r.name, r.input, ctx);
      } catch (err) {
        console.error(`[wa-segretaria] strumento ${r.name} in errore`, err);
        contenuto = JSON.stringify({ errore: 'Lo strumento non ha risposto. Non inventare il dato: passa al centro.' });
      }
      risultati.push({ type: 'tool_result', tool_use_id: r.id, content: contenuto });
    }
    conversazione.push({ role: 'user', content: risultati });

    // Se il turno finisce senza altro testo, almeno questo è già stato detto.
    if (testo) testoFinale = testo;
  }

  if (!testoFinale) {
    return { risposto: false, motivo: 'il modello non ha prodotto una risposta' };
  }

  const inviato = await rispondiUnaVolta(phone, testoFinale, 'assistant');
  if (!inviato.inviato) return { risposto: false, motivo: inviato.motivo };

  // Lo stato si salva DOPO l'invio riuscito: se il messaggio non è partito, la
  // conversazione non deve risultare andata avanti.
  await scriviStato({
    ...stato,
    turni: [...stato.turni, { role: 'user', text: domanda }, { role: 'assistant', text: testoFinale }],
    risposteOggi: stato.risposteOggi + 1,
    pendenti: [],
    mutoFino: ctx.passata
      ? new Date(Date.now() + MUTO_ORE * 3_600_000).toISOString()
      : stato.mutoFino,
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
}): Promise<EsitoSegretaria> {
  const { phone, text, messageId } = params;

  try {
    const cfg = await getWaAutomationsConfig();
    if (!cfg.segretaria) return { handled: false, reason: 'segretaria spenta' };
    if (!process.env.ANTHROPIC_API_KEY) return { handled: false, reason: 'manca ANTHROPIC_API_KEY' };
    if (!text.trim()) return { handled: false, reason: 'messaggio vuoto' };

    // Riconsegna di Meta: già letto, già risposto.
    if (!(await registraArrivo(phone, messageId))) {
      return { handled: true, reason: 'messaggio già elaborato' };
    }

    let stato = await leggiStato(phone);

    if (stato.mutoFino && stato.mutoFino > new Date().toISOString()) {
      return { handled: false, reason: 'conversazione passata a una persona' };
    }
    if (stato.risposteOggi >= MAX_RISPOSTE_GIORNO) {
      return { handled: false, reason: 'tetto giornaliero raggiunto per questo numero' };
    }

    // Il messaggio entra in coda PRIMA dell'attesa: chi risponderà per tutti
    // deve trovarci dentro anche questo.
    await scriviStato({ ...stato, pendenti: [...stato.pendenti, text].slice(-12) });

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
      const messaggi = stato.pendenti.length > 0 ? stato.pendenti : [text];
      const esito = await turno(phone, messaggi, stato);
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
