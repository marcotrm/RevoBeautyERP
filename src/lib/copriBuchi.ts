/**
 * Copri buchi: quando resta un posto vuoto in giornata, lo si riempie.
 *
 * Una cliente disdice la mattina l'appuntamento del pomeriggio e restano
 * novanta minuti vuoti. Prima si perdevano. Adesso parte una chiamata a
 * blocchi: dieci clienti attive per volta, mezz'ora di attesa fra un blocco
 * e l'altro, e ci si ferma alla prima che dice sì.
 *
 * Tre scelte che tengono in piedi tutto il resto:
 *
 *  - Si scrive SOLO a chi ha dato il consenso marketing e si è vista di
 *    recente. Alle dormienti si spenderebbero soldi per niente: se non
 *    tornano da sei mesi non tornano per un posto libero fra due ore.
 *  - Si ordina la coda invece di mandare a caso: prima chi quel trattamento
 *    lo fa di solito e chi sarebbe già dovuta tornare. Il primo blocco è
 *    quello che ha più probabilità di rispondere, e spesso finisce lì.
 *  - Vince la prima che risponde, e alla seconda si risponde comunque:
 *    "l'ha appena preso un'altra". Senza, o si presenta o ci resta male.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { normalizePhone, isSendablePhone, sendWhatsAppTemplate } from '@/lib/whatsapp';
import { sanitizeParam } from '@/lib/wa-templates';
import { isInterno } from '@/lib/clientiInterni';

const KIND = 'copri_buchi';

/** Quante clienti per blocco. */
export const BLOCCO = 10;
/** Quanto si aspetta prima del blocco successivo, in minuti. */
export const ATTESA_MINUTI = 30;
/** Oltre questo numero di blocchi si smette: non ha senso scrivere a mezzo paese. */
export const MAX_GIRI = 4;
/** Quanto deve mancare allo slot perché valga la pena provare (minuti). */
export const ANTICIPO_MINIMO = 120;
/** Fascia in cui è lecito scrivere. */
export const ORA_APERTURA = 9;
export const ORA_CHIUSURA = 20;
/** Una stessa cliente non riceve più di un "copri buchi" in questi giorni. */
export const GIORNI_RIPOSO_CLIENTE = 7;
/** Quanto si considera "attiva" una cliente: giorni dall'ultima visita conclusa. */
export const GIORNI_ATTIVA = 60;
/** Costo indicativo di un messaggio promozionale, in euro (serve solo a dare l'ordine di grandezza). */
export const COSTO_MESSAGGIO = 0.07;

export interface ContattoBuco {
  clientId: string;
  nome: string;
  phone: string;
  giro: number;
  inviatoIl: string;
  risposta?: 'si' | 'no';
  rispostoIl?: string;
}

export interface CampagnaBuco {
  id: string;
  creataIl: string;
  stato: 'attiva' | 'riempita' | 'scaduta' | 'annullata';
  /** Il buco da riempire. */
  date: string;
  from: string;
  to: string;
  durata: number;
  operatorId: string;
  operatorName: string;
  /** Cosa si propone. */
  treatmentId: string;
  treatmentName: string;
  prezzo: number;
  /** Da dove è nata: una disdetta o un lancio a mano dall'agenda. */
  origine: 'disdetta' | 'manuale';
  disdettaDi?: string;
  giro: number;
  prossimoGiroIl: string;
  contattate: ContattoBuco[];
  vinta?: { clientId: string; nome: string; phone: string; appointmentId?: string; oraIl: string };
  motivoFine?: string;
}

// ---------------------------------------------------------------
// Lettura e scrittura
// ---------------------------------------------------------------

function rowId(id: string): string {
  return `copri:${id}`;
}

async function salva(c: CampagnaBuco): Promise<void> {
  await prisma.adminEntry.upsert({
    where: { rowId: rowId(c.id) },
    update: { data: c as unknown as object },
    create: {
      rowId: rowId(c.id), kind: KIND, entityId: c.date,
      data: c as unknown as object, createdAt: c.creataIl,
    },
  });
}

export async function leggiCampagna(id: string): Promise<CampagnaBuco | null> {
  const r = await prisma.adminEntry.findUnique({ where: { rowId: rowId(id) } });
  return r ? (r.data as unknown as CampagnaBuco) : null;
}

/** Tutte le campagne, dalla più recente. */
export async function elencoCampagne(limite = 40): Promise<CampagnaBuco[]> {
  const righe = await prisma.adminEntry.findMany({
    where: { kind: KIND }, orderBy: { createdAt: 'desc' }, take: limite,
  });
  return righe.map(r => r.data as unknown as CampagnaBuco);
}

export async function campagneAttive(): Promise<CampagnaBuco[]> {
  return (await elencoCampagne(100)).filter(c => c.stato === 'attiva');
}

// ---------------------------------------------------------------
// Chi contattare
// ---------------------------------------------------------------

export interface Candidata {
  clientId: string;
  nome: string;
  phone: string;
  punteggio: number;
  perche: string;
}

const GIORNO = 24 * 60 * 60 * 1000;

function giorniFra(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / GIORNO);
}

/**
 * Le clienti da chiamare, dalla più probabile alla meno.
 *
 * Il punteggio non è un algoritmo furbo, è buon senso messo in fila: chi quel
 * trattamento lo fa di solito risponde più spesso di chi non l'ha mai fatto, e
 * chi è in ritardo sulla propria cadenza è già pronta a tornare.
 */
export async function candidate(c: CampagnaBuco): Promise<Candidata[]> {
  const oggi = todayRome();
  const limiteAttive = new Date(Date.parse(oggi) - GIORNI_ATTIVA * GIORNO).toISOString().slice(0, 10);

  const [clienti, appuntamenti, campagnePrecedenti] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, firstName: true, lastName: true, phone: true, marketingConsent: true, tags: true },
    }),
    prisma.appointment.findMany({
      select: { clientId: true, date: true, status: true, treatmentName: true },
    }),
    elencoCampagne(30),
  ]);

  // Storico per cliente: visite concluse, disdette, ultimo trattamento
  const storico = new Map<string, { visite: string[]; disdette: number; trattamenti: Set<string> }>();
  const impegnateQuelGiorno = new Set<string>();
  for (const a of appuntamenti) {
    if (!a.clientId) continue;
    const s = storico.get(a.clientId) || { visite: [], disdette: 0, trattamenti: new Set<string>() };
    if (a.status === 'completed') {
      s.visite.push(a.date);
      s.trattamenti.add(a.treatmentName);
    } else if (a.status === 'cancelled' || a.status === 'no_show') {
      s.disdette += 1;
    }
    storico.set(a.clientId, s);
    // Chi quel giorno ha già un appuntamento non si disturba: o è già in
    // negozio o ci sta venendo.
    if (a.date === c.date && a.status !== 'cancelled' && a.status !== 'no_show') {
      impegnateQuelGiorno.add(a.clientId);
    }
  }

  // Chi ha ricevuto un "copri buchi" da poco, o è già stata contattata su questo
  const riposo = new Map<string, string>();
  const giaContattate = new Set(c.contattate.map(x => x.clientId));
  const dettoNo = new Set(c.contattate.filter(x => x.risposta === 'no').map(x => x.clientId));
  for (const vecchia of campagnePrecedenti) {
    for (const x of vecchia.contattate) {
      const prec = riposo.get(x.clientId);
      if (!prec || x.inviatoIl > prec) riposo.set(x.clientId, x.inviatoIl);
    }
  }

  const fuori: Candidata[] = [];
  for (const cl of clienti) {
    if (isInterno(cl)) continue;
    if (!cl.marketingConsent) continue;
    if (!isSendablePhone(cl.phone)) continue;
    if (giaContattate.has(cl.id) || dettoNo.has(cl.id)) continue;
    if (impegnateQuelGiorno.has(cl.id)) continue;

    const s = storico.get(cl.id);
    if (!s || s.visite.length === 0) continue;
    const ultima = s.visite.sort()[s.visite.length - 1];
    if (ultima < limiteAttive) continue; // dormiente: si spenderebbe per niente

    const riposoIl = riposo.get(cl.id);
    if (riposoIl && giorniFra(riposoIl.slice(0, 10), oggi) < GIORNI_RIPOSO_CLIENTE) continue;

    // Punteggio: perché proprio lei
    const motivi: string[] = [];
    let punteggio = 0;

    if (s.trattamenti.has(c.treatmentName)) { punteggio += 3; motivi.push('fa questo trattamento'); }

    // Cadenza: ogni quanto torna di solito, e da quanto manca
    if (s.visite.length >= 2) {
      const date = s.visite.sort();
      let somma = 0;
      for (let i = 1; i < date.length; i++) somma += giorniFra(date[i - 1], date[i]);
      const cadenza = Math.round(somma / (date.length - 1));
      const daUltima = giorniFra(ultima, oggi);
      if (cadenza > 0 && daUltima >= cadenza) { punteggio += 2; motivi.push('sarebbe già dovuta tornare'); }
    }

    if (s.disdette === 0) { punteggio += 1; motivi.push('non disdice mai'); }

    // A parità, viene prima chi si è vista di recente
    punteggio += Math.max(0, 1 - giorniFra(ultima, oggi) / 200);

    fuori.push({
      clientId: cl.id,
      nome: `${cl.firstName} ${cl.lastName}`.trim(),
      phone: normalizePhone(cl.phone),
      punteggio,
      perche: motivi.join(', ') || 'cliente attiva',
    });
  }

  return fuori.sort((a, b) => b.punteggio - a.punteggio);
}

// ---------------------------------------------------------------
// Invio
// ---------------------------------------------------------------

function oraRoma(): { hhmm: string; minuti: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const h = Number(get('hour')), m = Number(get('minute'));
  return { hhmm: `${get('hour')}:${get('minute')}`, minuti: h * 60 + m };
}

/** "oggi alle 16:30" oppure "giovedì 14 alle 16:30": come lo direbbe una persona. */
function quandoLeggibile(date: string, from: string): string {
  const oggi = todayRome();
  if (date === oggi) return `oggi alle ${from}`;
  const domani = new Date(Date.parse(oggi) + GIORNO).toISOString().slice(0, 10);
  if (date === domani) return `domani alle ${from}`;
  const d = new Date(`${date}T12:00:00`);
  const giorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric' }).format(d);
  return `${giorno} alle ${from}`;
}

/**
 * Manda il blocco successivo. Torna quante ne ha contattate.
 *
 * Non manda mai fuori dalla fascia oraria e non manda se allo slot manca
 * troppo poco: un messaggio che arriva quando la cliente non fa più in tempo
 * ad arrivare è solo un costo.
 */
export async function mandaGiro(c: CampagnaBuco, dryRun = false): Promise<{ inviati: number; nomi: string[]; motivo?: string }> {
  const ora = oraRoma();
  if (ora.minuti < ORA_APERTURA * 60 || ora.minuti >= ORA_CHIUSURA * 60) {
    return { inviati: 0, nomi: [], motivo: 'fuori dalla fascia oraria in cui si scrive' };
  }

  const oggi = todayRome();
  const inizioSlot = Number(c.from.slice(0, 2)) * 60 + Number(c.from.slice(3, 5));
  const mancano = c.date === oggi ? inizioSlot - ora.minuti : (Date.parse(c.date) - Date.parse(oggi)) / 60000;
  if (mancano < ANTICIPO_MINIMO) {
    return { inviati: 0, nomi: [], motivo: 'allo slot manca troppo poco' };
  }

  const lista = (await candidate(c)).slice(0, BLOCCO);
  if (lista.length === 0) return { inviati: 0, nomi: [], motivo: 'nessuna cliente da contattare' };

  const quando = quandoLeggibile(c.date, c.from);
  const nomi: string[] = [];

  for (const cand of lista) {
    if (!dryRun) {
      const res = await sendWhatsAppTemplate(cand.phone, 'copriBuchi', {
        bodyParams: [sanitizeParam(cand.nome.split(' ')[0]), sanitizeParam(c.treatmentName), sanitizeParam(quando)],
      });
      if (!res.ok) continue;
    }
    c.contattate.push({
      clientId: cand.clientId, nome: cand.nome, phone: cand.phone,
      giro: c.giro + 1, inviatoIl: new Date().toISOString(),
    });
    nomi.push(cand.nome);
  }

  c.giro += 1;
  c.prossimoGiroIl = new Date(Date.now() + ATTESA_MINUTI * 60_000).toISOString();
  if (!dryRun) await salva(c);
  return { inviati: nomi.length, nomi };
}

// ---------------------------------------------------------------
// Creazione e avanzamento
// ---------------------------------------------------------------

export async function creaCampagna(params: {
  date: string; from: string; to: string;
  operatorId: string; operatorName: string;
  treatmentId: string; treatmentName: string; prezzo: number;
  origine: 'disdetta' | 'manuale';
  disdettaDi?: string;
}): Promise<CampagnaBuco> {
  const inizio = Number(params.from.slice(0, 2)) * 60 + Number(params.from.slice(3, 5));
  const fine = Number(params.to.slice(0, 2)) * 60 + Number(params.to.slice(3, 5));
  const c: CampagnaBuco = {
    id: `${params.date}-${params.operatorId}-${params.from}`.replace(/[^a-zA-Z0-9-]/g, ''),
    creataIl: new Date().toISOString(),
    stato: 'attiva',
    date: params.date, from: params.from, to: params.to, durata: Math.max(fine - inizio, 0),
    operatorId: params.operatorId, operatorName: params.operatorName,
    treatmentId: params.treatmentId, treatmentName: params.treatmentName, prezzo: params.prezzo,
    origine: params.origine, disdettaDi: params.disdettaDi,
    giro: 0,
    prossimoGiroIl: new Date().toISOString(),
    contattate: [],
  };
  await salva(c);
  return c;
}

export async function chiudiCampagna(id: string, stato: CampagnaBuco['stato'], motivo: string): Promise<void> {
  const c = await leggiCampagna(id);
  if (!c || c.stato !== 'attiva') return;
  c.stato = stato;
  c.motivoFine = motivo;
  await salva(c);
}

/**
 * Fa avanzare le campagne aperte. La chiama lo scheduler ogni minuto: manda il
 * blocco successivo a chi è scaduta l'attesa, e chiude quelle senza più senso.
 */
export async function avanzaCampagne(): Promise<{ id: string; azione: string }[]> {
  const fatti: { id: string; azione: string }[] = [];
  const oggi = todayRome();
  const ora = oraRoma();

  for (const c of await campagneAttive()) {
    // Slot passato: non c'è più niente da riempire
    const inizio = Number(c.from.slice(0, 2)) * 60 + Number(c.from.slice(3, 5));
    if (c.date < oggi || (c.date === oggi && inizio - ora.minuti < ANTICIPO_MINIMO)) {
      await chiudiCampagna(c.id, 'scaduta', 'lo slot è passato senza che nessuna rispondesse');
      fatti.push({ id: c.id, azione: 'chiusa: slot passato' });
      continue;
    }
    if (c.giro >= MAX_GIRI) {
      await chiudiCampagna(c.id, 'scaduta', `nessuna risposta dopo ${MAX_GIRI} blocchi`);
      fatti.push({ id: c.id, azione: 'chiusa: giri finiti' });
      continue;
    }
    if (new Date(c.prossimoGiroIl).getTime() > Date.now()) continue;

    const r = await mandaGiro(c);
    if (r.inviati > 0) {
      fatti.push({ id: c.id, azione: `blocco ${c.giro}: ${r.inviati} messaggi` });
    } else if (r.motivo === 'nessuna cliente da contattare') {
      await chiudiCampagna(c.id, 'scaduta', 'finite le clienti da contattare');
      fatti.push({ id: c.id, azione: 'chiusa: nessuna candidata' });
    }
  }
  return fatti;
}

// ---------------------------------------------------------------
// Risposte
// ---------------------------------------------------------------

const SI = /^(s[iì]\b|lo prendo|prendo io|va bene|ci sono|ok\b|certo|volentieri)/i;
const NO = /^(no\b|non stavolta|non posso|magari|un'?altra volta)/i;

export interface EsitoRisposta {
  gestita: boolean;
  nota?: string;
  campagnaId?: string;
}

/**
 * Una cliente ha risposto a un "copri buchi".
 *
 * La prima che dice sì prende il posto: l'appuntamento si crea qui, subito,
 * perché fra il messaggio e la reception che se ne accorge passano minuti che
 * il posto non ha.
 */
export async function rispostaCopriBuchi(params: {
  phone: string; text: string; payloadId: string;
}): Promise<EsitoRisposta> {
  const phone = normalizePhone(params.phone);
  const testo = (params.text || '').trim();
  const dallaTastiera = `${params.payloadId} ${testo}`;
  const dice = SI.test(dallaTastiera) || /prendo/i.test(dallaTastiera)
    ? 'si'
    : NO.test(dallaTastiera) ? 'no' : null;
  if (!dice) return { gestita: false };

  // La campagna a cui stava rispondendo: la più recente che l'ha contattata.
  const tutte = await elencoCampagne(30);
  const mia = tutte.find(c => c.contattate.some(x => x.phone === phone));
  if (!mia) return { gestita: false };

  const contatto = mia.contattate.find(x => x.phone === phone)!;
  contatto.risposta = dice;
  contatto.rispostoIl = new Date().toISOString();

  if (dice === 'no') {
    await salva(mia);
    return { gestita: true, nota: 'ha detto no, esce dai giri successivi', campagnaId: mia.id };
  }

  // Ha detto sì, ma il posto potrebbe essere già andato
  if (mia.stato !== 'attiva' || mia.vinta) {
    await salva(mia);
    await sendWhatsAppTemplate(phone, 'copriBuchiPreso', {
      bodyParams: [sanitizeParam(contatto.nome.split(' ')[0])],
    });
    return { gestita: true, nota: 'posto già preso, avvisata', campagnaId: mia.id };
  }

  // Prima a rispondere: il posto è suo. L'appuntamento si crea adesso.
  const cliente = await prisma.client.findUnique({ where: { id: contatto.clientId } });
  const trattamento = await prisma.treatment.findUnique({ where: { id: mia.treatmentId } }).catch(() => null);
  const adesso = new Date().toISOString();
  let appointmentId: string | undefined;
  try {
    const creato = await prisma.appointment.create({
      data: {
        clientId: contatto.clientId,
        clientName: contatto.nome,
        operatorId: mia.operatorId,
        operatorName: mia.operatorName,
        treatmentId: mia.treatmentId,
        treatmentName: mia.treatmentName,
        treatmentCategory: trattamento?.category || 'consultation',
        date: mia.date,
        startTime: mia.from,
        endTime: mia.to,
        duration: mia.durata,
        status: 'confirmed',
        price: mia.prezzo,
        color: '#22C55E',
        notes: 'Preso da Copri buchi: posto liberato e offerto su WhatsApp.',
        createdAt: adesso,
        updatedAt: adesso,
        createdBy: 'copri-buchi',
      },
    });
    appointmentId = creato.id;
  } catch (e) {
    console.error('[copri-buchi] appuntamento non creato', e);
  }

  mia.vinta = { clientId: contatto.clientId, nome: contatto.nome, phone, appointmentId, oraIl: adesso };
  mia.stato = 'riempita';
  mia.motivoFine = `presa da ${contatto.nome}`;
  await salva(mia);

  // Conferma alla vincitrice, con lo stesso messaggio che usa l'agenda
  await sendWhatsAppTemplate(phone, 'confirm', {
    bodyParams: [
      sanitizeParam(contatto.nome.split(' ')[0]),
      sanitizeParam(mia.treatmentName),
      sanitizeParam(mia.date.split('-').reverse().join('/')),
      sanitizeParam(mia.from),
    ],
  });

  return {
    gestita: true,
    nota: `posto assegnato a ${contatto.nome}${cliente ? '' : ' (scheda non trovata)'}`,
    campagnaId: mia.id,
  };
}

/** Il conto in euro di una campagna: messaggi mandati per il costo di uno. */
export function costoStimato(c: CampagnaBuco): number {
  return Math.round(c.contattate.length * COSTO_MESSAGGIO * 100) / 100;
}
