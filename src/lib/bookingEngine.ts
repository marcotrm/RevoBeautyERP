/**
 * Motore della prenotazione online — uno solo, usato sia dalla pagina web
 * /prenota sia dalla app clienti.
 *
 * Cosa sa fare che il vecchio calcolo non sapeva:
 *  - più trattamenti nella stessa seduta, uno di fila all'altro;
 *  - operatrice scelta dalla cliente, oppure "la prima disponibile";
 *  - rispetta il TURNO vero dell'operatrice (orari e pausa), la settimana
 *    personalizzata in Staff → Turni, e le fasce bloccate in agenda;
 *  - propone solo chi quel lavoro lo sa fare (vedi competenzePerOperatrice).
 *
 * Il vecchio calcolo guardava solo apertura/chiusura del centro: offriva le
 * 15:00 a chi è in pausa e le 16:00 a chi stacca alle 14. Qui non succede.
 */

import { prisma } from '@/lib/prisma';
import { toMinutes, toHHMM, todayInItaly } from '@/lib/voice';
import { mondayISO } from '@/lib/weekSchedule';
import { leggiConfig, type ConfigApp } from '@/lib/appSettings';
import { leggiCentro, eChiuso, type Centro } from '@/lib/centro';

/**
 * La cornice della prenotazione — apertura, chiusura, passo degli orari,
 * preavviso — si imposta in App Clienti → Prenotazione. Qui dentro non c'è
 * nessun orario scritto a mano.
 */
type Regole = ConfigApp['prenotazione'];

/** Stati che occupano davvero il tempo di un'operatrice. */
const STATI_OCCUPANTI = ['confirmed', 'pending', 'in_progress', 'in_cabin', 'completed'];

export interface ServizioRichiesto {
  treatmentId: string;
  /** Operatrice voluta dalla cliente; vuoto = la prima disponibile. */
  operatorId?: string | null;
}

export interface AssegnazioneServizio {
  treatmentId: string;
  treatmentName: string;
  operatorId: string;
  operatorName: string;
  startTime: string;
  endTime: string;
  duration: number;
  price: number;
  /**
   * Di chi è questo trattamento quando si prenota in due: 0 la prima persona,
   * 1 l'amica. Con una persona sola è sempre 0.
   */
  gruppo?: number;
}

export interface SlotProposto {
  time: string;      // inizio della seduta
  endTime: string;   // fine dell'ultimo trattamento
  durataTotale: number;
  prezzoTotale: number;
  /** Chi fa cosa e quando: è quello che poi si salva sull'appuntamento. */
  assegnazioni: AssegnazioneServizio[];
  /**
   * Vero se comincia esattamente quando l'operatrice si libera (o all'inizio
   * del suo turno): è il posto che non lascia buchi in agenda.
   */
  attaccato?: boolean;
}

interface Turno {
  isWorking?: boolean;
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
}
interface Fascia { from: number; to: number }

/**
 * Le fasce in cui l'operatrice è davvero al lavoro quel giorno: il turno meno
 * la pausa. Turno assente = si assume disponibile per tutta l'apertura, così
 * una settimana non ancora pianificata non blocca le prenotazioni.
 */
function fasceDiLavoro(turno: Turno | undefined, finestra: { da: number; a: number }): Fascia[] {
  const apertura = finestra.da;
  const chiusura = finestra.a;
  if (!turno) return [{ from: apertura, to: chiusura }];
  if (turno.isWorking === false) return [];

  const inizio = Math.max(apertura, turno.startTime ? toMinutes(turno.startTime) : apertura);
  const fine = Math.min(chiusura, turno.endTime ? toMinutes(turno.endTime) : chiusura);
  if (fine <= inizio) return [];

  if (turno.breakStart && turno.breakEnd) {
    const pFrom = toMinutes(turno.breakStart);
    const pTo = toMinutes(turno.breakEnd);
    const fasce: Fascia[] = [];
    if (pFrom > inizio) fasce.push({ from: inizio, to: Math.min(pFrom, fine) });
    if (pTo < fine) fasce.push({ from: Math.max(pTo, inizio), to: fine });
    return fasce.filter(f => f.to > f.from);
  }
  return [{ from: inizio, to: fine }];
}

export function durataDi(
  t: { duration: number; durationMale: number | null; durationFemale: number | null },
  gender: 'male' | 'female',
): number {
  return gender === 'male'
    ? (t.durationMale ?? t.durationFemale ?? t.duration)
    : (t.durationFemale ?? t.duration);
}

export function prezzoDi(
  t: { price: number; priceMale: number | null; priceFemale: number | null },
  gender: 'male' | 'female',
): number {
  return gender === 'male'
    ? (t.priceMale ?? t.priceFemale ?? t.price)
    : (t.priceFemale ?? t.price);
}

interface Operatrice {
  id: string; firstName: string; lastName: string; schedule: unknown;
  specializations: string[]; avatar: string | null; color: string;
}
interface Contesto {
  operatori: Operatrice[];
  /** turni personalizzati per lunedì della settimana */
  settimane: { operatorId: string; weekStart: string; schedule: unknown }[];
  /** occupato[data][operatorId] = fasce già prese */
  occupatoPerData: Map<string, Map<string, Fascia[]>>;
  /** competenze[operatorId] = categorie che sa fare */
  competenze: Map<string, Set<string>>;
  /** Orari e passo impostati in App Clienti → Prenotazione. */
  regole: Regole;
  /**
   * Quando il centro è davvero aperto: orari per giorno della settimana e
   * ferie, impostati in Assistente.
   *
   * Erano già lì e li diceva l'assistente alle clienti — ma il motore non li
   * guardava: calcolava su una fascia unica uguale per tutti i giorni, presa
   * dalle impostazioni della prenotazione. Due verità sullo stesso fatto, e
   * nessuna che avvisasse quando divergevano: l'assistente diceva «siamo
   * aperti fino alle otto» e poi non trovava posto dopo le sei, oppure
   * offriva un appuntamento in un giorno di ferie.
   */
  centro: Centro;
}

/**
 * La finestra di apertura di UN giorno.
 *
 * Vince quello che il centro ha scritto in Assistente, perché è il dato che
 * qualcuno tiene aggiornato e che l'assistente dice alle clienti. La fascia
 * unica delle impostazioni resta la rete di sicurezza per i giorni che nessuno
 * ha configurato.
 *
 * `null` vuol dire chiuso: quel giorno non esce nessun orario.
 */
function aperturaDelGiorno(ctx: Contesto, date: string): { da: number; a: number } | null {
  // Ferie e chiusure straordinarie: prima di tutto il resto.
  if (eChiuso(ctx.centro, date)) return null;

  const dow = new Date(date + 'T12:00:00').getDay();
  const orario = ctx.centro.orari?.[String(dow === 0 ? 7 : dow)];

  /*
    Gli orari del centro sono l'unica verita', e non hanno una seconda opinione.

    Prima, quando per un giorno non c'era scritto niente, si ripiegava sulla
    fascia unica delle impostazioni di prenotazione: due dati che dicevano la
    stessa cosa in due punti diversi, e quando divergevano vinceva quello che
    nessuno stava guardando. Adesso vale quello che c'e' scritto in
    Assistente → orari: se un giorno non c'e', quel giorno il centro e' chiuso.
    Niente riserva, niente sorprese.
  */
  if (!orario) return null;

  const da = toMinutes(orario.apre);
  const a = toMinutes(orario.chiude);
  return a > da ? { da, a } : null;
}

/**
 * Chi sa fare cosa.
 *
 * In Staff, su ogni operatrice si spuntano le categorie che sa fare. La regola
 * è quella che serve al centro senza obbligare a compilare tutto:
 *
 *   una categoria spuntata da qualcuno diventa SUA — la fanno solo le
 *   operatrici che l'hanno spuntata. Le categorie che nessuno ha spuntato
 *   restano di tutte.
 *
 * Così basta spuntare "Unghie" a Michela Cioffi perché l'onicotecnica sparisca
 * dalle altre, senza dover elencare a Luisa tutte le cose che sa fare.
 */
export function competenzePerOperatrice(
  operatori: { id: string; specializations: string[] }[],
  categorieEsistenti: string[],
): Map<string, Set<string>> {
  const rivendicate = new Set<string>();
  for (const o of operatori) for (const c of o.specializations) rivendicate.add(c);

  const mappa = new Map<string, Set<string>>();
  for (const o of operatori) {
    const sue = new Set(o.specializations);
    for (const c of categorieEsistenti) if (!rivendicate.has(c)) sue.add(c);
    mappa.set(o.id, sue);
  }
  return mappa;
}

/**
 * Carica in UNA volta tutto ciò che serve per un intervallo di giorni.
 * Riempire un calendario di due settimane girando giorno per giorno voleva
 * dire ottanta interrogazioni al database: così sono quattro.
 */
async function caricaContesto(dateFrom: string, dateTo: string, regole: Regole, ignoraAppointmentId?: string | null): Promise<Contesto> {
  const centro = await leggiCentro().catch(() => null);
  const settimaneCoinvolte = new Set<string>();
  for (let d = new Date(dateFrom + 'T12:00:00'); d <= new Date(dateTo + 'T12:00:00'); d.setDate(d.getDate() + 7)) {
    settimaneCoinvolte.add(mondayISO(d));
  }
  settimaneCoinvolte.add(mondayISO(new Date(dateTo + 'T12:00:00')));

  const [operatori, settimane, appuntamenti, blocchi, categorie] = await Promise.all([
    prisma.operator.findMany({
      where: { isActive: true, isResource: false },
      select: {
        id: true, firstName: true, lastName: true, schedule: true,
        specializations: true, avatar: true, color: true,
      },
      orderBy: { firstName: 'asc' },
    }),
    prisma.operatorWeekSchedule.findMany({ where: { weekStart: { in: [...settimaneCoinvolte] } } }),
    prisma.appointment.findMany({
      where: {
        date: { gte: dateFrom, lte: dateTo }, status: { in: STATI_OCCUPANTI },
        ...(ignoraAppointmentId ? { id: { not: ignoraAppointmentId } } : {}),
      },
      select: { date: true, operatorId: true, startTime: true, endTime: true, services: true },
    }),
    prisma.agendaBlock.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      select: { date: true, operatorId: true, startTime: true, endTime: true },
    }),
    prisma.treatment.findMany({
      where: { isActive: true }, select: { category: true }, distinct: ['category'],
    }),
  ]);

  // Tempo già occupato, giorno per giorno. Contano anche i trattamenti che un
  // appuntamento condiviso ha affidato a un'altra operatrice.
  const occupatoPerData = new Map<string, Map<string, Fascia[]>>();
  const aggiungi = (data: string, opId: string, from: number, to: number) => {
    let perData = occupatoPerData.get(data);
    if (!perData) { perData = new Map(); occupatoPerData.set(data, perData); }
    const arr = perData.get(opId) || [];
    arr.push({ from, to });
    perData.set(opId, arr);
  };
  for (const a of appuntamenti) {
    const servizi = (a.services as unknown as { duration?: number; operatorId?: string }[] | null) || [];
    if (servizi.length > 0) {
      let cursore = toMinutes(a.startTime);
      for (const s of servizi) {
        const fine = cursore + (s.duration || 0);
        aggiungi(a.date, s.operatorId || a.operatorId, cursore, fine);
        cursore = fine;
      }
    } else {
      aggiungi(a.date, a.operatorId, toMinutes(a.startTime), toMinutes(a.endTime));
    }
  }
  for (const b of blocchi) aggiungi(b.date, b.operatorId, toMinutes(b.startTime), toMinutes(b.endTime));

  return {
    operatori, settimane, occupatoPerData, regole,
    // Senza i dati del centro si ricade sulla fascia unica: peggio di prima
    // no, uguale a prima sì.
    centro: centro || { nome: '', orari: undefined, chiusure: [] },
    competenze: competenzePerOperatrice(operatori, categorie.map(c => c.category)),
  };
}

/**
 * Sotto la mezz'ora, il tempo lasciato libero prima di un appuntamento non è
 * un posto: non ci sta dentro nessun trattamento e resta vuoto fino a sera.
 */
const BUCHETTO_MAX = 30;

/**
 * Vero se cominciare a quell'ora lascia un buchetto dietro di sé.
 *
 * Il riferimento è l'inizio della fascia di lavoro in cui si cade — dopo la
 * pausa la fascia riparte, quindi la pausa non è un buco — spostato in avanti
 * fino alla fine dell'ultimo impegno. Se quel riferimento è prima del primo
 * orario proponibile (il centro non è ancora aperto, la cliente ha chiesto il
 * pomeriggio, oggi c'è il preavviso) non si può attaccare niente e non è colpa
 * di nessuno: si lascia passare.
 */
function lasciaBuchetto(
  opId: string | undefined, inizio: number, dalle: number,
  lavoro: Map<string, Fascia[]>, occupato: Map<string, Fascia[]>,
): boolean {
  if (!opId) return false;
  const fascia = (lavoro.get(opId) || []).find(f => inizio >= f.from && inizio <= f.to);
  if (!fascia) return false;
  let rif = fascia.from;
  for (const o of occupato.get(opId) || []) {
    if (o.to <= inizio && o.to > rif) rif = o.to;
  }
  if (rif < dalle) return false;
  const buco = inizio - rif;
  return buco > 0 && buco < BUCHETTO_MAX;
}

/** Fasce di lavoro di ogni operatrice in una certa data (settimana personalizzata > turno base). */
function lavoroDelGiorno(ctx: Contesto, date: string): Map<string, Fascia[]> {
  const giorno = new Date(date + 'T12:00:00');
  const dow = giorno.getDay(); // 0=Dom
  const weekStart = mondayISO(giorno);
  const lavoro = new Map<string, Fascia[]>();

  /*
    Il turno si ritaglia sull'apertura DI QUEL GIORNO.

    Prima si ritagliava sulla fascia unica: un'operatrice in turno fino alle
    venti veniva tagliata alle diciannove perche' cosi' diceva un'altra
    impostazione, e quell'ora sparita non la vedeva nessuno — ne' in agenda,
    dove il turno risultava intero, ne' fra gli orari proposti, dove semplicemente
    non compariva.
  */
  const finestra = aperturaDelGiorno(ctx, date);
  if (!finestra) {
    for (const op of ctx.operatori) lavoro.set(op.id, []);
    return lavoro;
  }

  for (const op of ctx.operatori) {
    // La domenica non e' piu' cablata qui: se il centro apre di domenica lo
    // dice `centro.orari`, e `aperturaDelGiorno` sopra ha gia' deciso.
    const perSettimana = ctx.settimane.find(w => w.operatorId === op.id && w.weekStart === weekStart);
    const settimana = perSettimana?.schedule as Record<string, Turno> | null | undefined;

    /*
      Settimana pianificata: i giorni lasciati vuoti sono riposo.

      È la stessa regola del pianificatore dei turni, dove una casella vuota
      vale zero ore. Senza, chi compila la settimana solo per tre giorni si
      ritrovava proposta anche negli altri — e il gestionale prenotava
      appuntamenti a chi quel giorno non c'è.
    */
    if (settimana && Object.keys(settimana).length > 0) {
      const turno = settimana[String(dow)];
      lavoro.set(op.id, turno ? fasceDiLavoro(turno, finestra) : []);
      continue;
    }

    const mappa = op.schedule as Record<string, Turno> | null;
    lavoro.set(op.id, fasceDiLavoro(mappa?.[String(dow)], finestra));
  }
  return lavoro;
}

/** Vero se l'operatrice è libera e in turno per tutto l'intervallo. */
function libera(opId: string, from: number, to: number, lavoro: Map<string, Fascia[]>, occupato: Map<string, Fascia[]>): boolean {
  const inTurno = (lavoro.get(opId) || []).some(f => from >= f.from && to <= f.to);
  if (!inTurno) return false;
  return !(occupato.get(opId) || []).some(o => from < o.to && to > o.from);
}

export interface RichiestaDisponibilita {
  date: string;
  services: ServizioRichiesto[];
  gender: 'male' | 'female';
  /** Fascia oraria preferita dalla cliente, es. dalle 14:00 alle 19:00. */
  oraDa?: string | null;
  oraA?: string | null;
  /**
   * Un appuntamento da NON contare fra gli occupati: serve allo spostamento,
   * dove il posto vecchio dell'appuntamento stesso deve risultare libero.
   */
  ignoraAppointmentId?: string | null;
}

/**
 * Gli orari in cui l'intera seduta (tutti i trattamenti di fila) sta in piedi.
 *
 * L'assegnazione delle operatrici si cerca con backtracking: se la prima
 * combinazione non regge se ne prova un'altra, invece di arrendersi. Con
 * cinque operatrici e due-tre trattamenti è istantaneo, e non capita di
 * sentirsi dire "non c'è posto" quando invece basta scambiare due nomi.
 */
interface Passo {
  treatmentId: string; treatmentName: string; category: string; operatorId: string | null;
  duration: number; price: number;
  /**
   * Chi sa fare QUESTO trattamento, non la sua categoria.
   *
   * Vuoto: lo fanno tutte. È la stessa regola che applicano l'agenda e «Cerca
   * buchi» leggendo `operatorSkills`, e che qui mancava: il motore guardava
   * solo le categorie spuntate in Staff, quindi dentro «Unghie» assegnava la
   * ricostruzione a chiunque sapesse fare le unghie — anche a chi in listino
   * quella riga non ce l'ha spuntata.
   */
  abili: string[];
}

/** Trasforma i trattamenti richiesti nella sequenza da incastrare, con durate e prezzi del sesso giusto. */
async function preparaPassi(services: ServizioRichiesto[], gender: 'male' | 'female'): Promise<Passo[] | null> {
  const richiesti = services.filter(s => s.treatmentId);
  if (richiesti.length === 0) return null;

  const trattamenti = await prisma.treatment.findMany({
    where: { id: { in: richiesti.map(s => s.treatmentId) }, isActive: true },
  });
  const perId = new Map(trattamenti.map(t => [t.id, t]));
  // Un trattamento sparito o disattivato: meglio nessuno slot che uno sbagliato
  if (richiesti.some(s => !perId.has(s.treatmentId))) return null;

  return richiesti.map(s => {
    const t = perId.get(s.treatmentId)!;
    return {
      treatmentId: t.id,
      treatmentName: t.name,
      category: t.category,
      operatorId: s.operatorId || null,
      /*
        Il posto da riservare è durata + preparazione. Se il bot proponesse
        mezz'ora dove in cabina ne servono quaranta minuti, prenoterebbe sopra
        il trattamento seguente — e a scoprirlo sarebbe la ragazza al banco,
        con le due clienti già lì.
      */
      duration: Math.max(5, durataDi(t, gender) + (t.preparazione || 0)),
      price: prezzoDi(t, gender),
      abili: leggiAbili(t.operatorSkills),
    };
  });
}

/**
 * Chi e' abilitato a un trattamento, dalle spunte del listino.
 *
 * `operatorSkills` e' JSON e arriva dal database senza garanzie di forma: una
 * riga scritta a mano o rimasta da una versione vecchia non deve far cadere
 * una ricerca di disponibilita'. Quello che non si riesce a leggere vale come
 * «nessuna spunta», che e' il caso permissivo — meglio proporre un'operatrice
 * in piu' che far sparire un trattamento dall'agenda senza dirlo a nessuno.
 */
function leggiAbili(grezzo: unknown): string[] {
  if (!Array.isArray(grezzo)) return [];
  return grezzo
    .map(v => (v && typeof v === 'object' && 'operatorId' in v ? String((v as { operatorId: unknown }).operatorId || '') : ''))
    .filter(Boolean);
}

/**
 * Gli orari buoni di UN giorno, con il contesto già caricato.
 *
 * `gruppi` è una lista di catene: dentro una catena i trattamenti si fanno uno
 * dopo l'altro (la stessa persona), fra catene si va in parallelo (lei e
 * l'amica, che cominciano insieme con due operatrici diverse).
 */
function slotDelGiorno(
  ctx: Contesto, date: string, gruppi: Passo[][], oraDa?: string | null, oraA?: string | null,
): SlotProposto[] {
  const lavoro = lavoroDelGiorno(ctx, date);
  const occupato = ctx.occupatoPerData.get(date) || new Map<string, Fascia[]>();
  const nomeDi = new Map(ctx.operatori.map(o => [o.id, `${o.firstName} ${o.lastName}`.trim()]));

  // La seduta finisce quando finisce la catena più lunga: se lei fa due ore e
  // l'amica quaranta minuti, il posto va tenuto per due ore.
  const durataTotale = Math.max(...gruppi.map(g => g.reduce((s, p) => s + p.duration, 0)));
  const prezzoTotale = gruppi.reduce((s, g) => s + g.reduce((x, p) => x + p.price, 0), 0);

  // Se il giorno è oggi, si parte da adesso più il preavviso
  let minimoOggi = 0;
  if (date === todayInItaly()) {
    const adesso = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
    minimoOggi = toMinutes(adesso) + ctx.regole.preavvisoMinuti;
  }
  /*
    Quando il centro e' aperto QUEL giorno — non la fascia unica di sempre.

    Se e' chiuso (ferie, o giorno dichiarato chiuso in Assistente) non esce
    niente: e' l'unica risposta giusta, e prima invece il motore offriva
    tranquillamente un appuntamento a Ferragosto.
  */
  const apertura = aperturaDelGiorno(ctx, date);
  if (!apertura) return [];

  const dalle = Math.max(apertura.da, oraDa ? toMinutes(oraDa) : 0, minimoOggi);
  const alle = Math.min(apertura.a, oraA ? toMinutes(oraA) : apertura.a);

  const slots: SlotProposto[] = [];
  const passo = Math.max(5, ctx.regole.passoMinuti);

  /*
    Dove far cominciare la seduta.

    La griglia da un quarto d'ora, da sola, lascia i buchi: se un'operatrice si
    libera alle 12:25 il primo orario proposto è 12:30 e quei cinque minuti non
    li recupera più nessuno — ripetuto tre volte al giorno diventa mezz'ora di
    cabina vuota. Quindi ai soliti orari tondi si aggiungono i momenti in cui
    qualcuno si libera davvero: la fine di ogni appuntamento e l'inizio di ogni
    turno. Sono quelli che attaccano il nuovo appuntamento al precedente.
  */
  const attacchi = new Set<number>();
  for (const [, fasce] of lavoro) for (const f of fasce) attacchi.add(f.from);
  for (const [, fasce] of occupato) for (const f of fasce) attacchi.add(f.to);

  const inizi: number[] = [];
  for (let t = dalle; t + durataTotale <= alle; t += passo) inizi.push(t);
  for (const t of attacchi) {
    if (t >= dalle && t + durataTotale <= alle && !inizi.includes(t)) inizi.push(t);
  }
  inizi.sort((a, b) => a - b);

  for (const inizio of inizi) {
    const assegnate: AssegnazioneServizio[] = [];

    /*
      Si prova a incastrare tutte le catene: prima persona, poi l'amica, con
      backtracking. Ogni catena riparte dall'ora d'inizio scelta, e la stessa
      operatrice non può stare su due trattamenti sovrapposti — controllo che
      vale anche fra una persona e l'altra, ed è quello che rende impossibile
      proporre Michela a tutte e due nello stesso momento.
    */
    const prova = (g: number, i: number, cursore: number): boolean => {
      if (g >= gruppi.length) return true;
      const catena = gruppi[g];
      if (i >= catena.length) {
        if (g + 1 >= gruppi.length) return true;
        /*
          Insieme se si può, altrimenti una dopo l'altra.

          Due amiche che vogliono la stessa cosa dalla stessa operatrice non
          possono cominciare nello stesso momento — e rispondere "non c'è
          posto" sarebbe una bugia: il posto c'è, una alle 10 e l'altra appena
          finisce la prima. Si prova prima la partenza in parallelo (vengono
          insieme, escono insieme) e solo se non regge si accodano.
        */
        if (prova(g + 1, 0, inizio)) return true;
        return prova(g + 1, 0, cursore);
      }
      const p = catena[i];
      const fine = cursore + p.duration;
      /*
        Chi puo' davvero fare QUESTO trattamento.

        Due criteri, e il piu' preciso vince. Se in listino quel trattamento ha
        le spunte — la colonna «chi lo fa» —, quelle sono l'elenco completo e
        basta: sono state messe guardando la riga, una per una. Se non ce l'ha,
        si scende alle categorie spuntate in Staff, che e' il criterio grosso.

        Prima valevano tutte e due insieme, e le due cose si tagliavano a
        vicenda: bastava che una sola operatrice avesse spuntato «Unghie» in
        Staff perche' la categoria diventasse sua, e da quel momento la
        pedicure con Luisa e Rosaria spuntate in listino non la poteva fare
        nessuno — nessuno slot, mai, e nessun messaggio a dirlo. Erano cinque
        trattamenti, due dei quali completamente irraggiungibili da WhatsApp,
        dall'app e dalla pagina di prenotazione.
      */
      const candidate = ctx.operatori.filter(o =>
        (!p.operatorId || o.id === p.operatorId)
        && (p.abili.length > 0 ? p.abili.includes(o.id) : ctx.competenze.get(o.id)?.has(p.category)));

      for (const op of candidate) {
        if (!libera(op.id, cursore, fine, lavoro, occupato)) continue;
        // La stessa operatrice non può stare su due trattamenti sovrapposti
        const gia = assegnate.some(a => a.operatorId === op.id
          && toMinutes(a.startTime) < fine && toMinutes(a.endTime) > cursore);
        if (gia) continue;

        assegnate.push({
          treatmentId: p.treatmentId,
          treatmentName: p.treatmentName,
          operatorId: op.id,
          operatorName: nomeDi.get(op.id) || '',
          startTime: toHHMM(cursore),
          endTime: toHHMM(fine),
          duration: p.duration,
          price: p.price,
          gruppo: g,
        });
        if (prova(g, i + 1, fine)) return true;
        assegnate.pop();
      }
      return false;
    };

    if (prova(0, 0, inizio)) {
      /*
        Niente proposte che lascino un buchetto.

        Se l'operatrice si libera alle 12:25, proporre le 12:45 vuol dire venti
        minuti di cabina ferma: troppo pochi perché ci entri qualcosa, e persi
        fino a sera. In agenda quell'orario ora è vietato — il gestionale non lo
        fa salvare — quindi proporlo qui vorrebbe dire mandare le ragazze a
        sbattere contro un blocco.

        Il conto si fa su chi prende il primo trattamento: è l'unico buco che
        dipende dall'ora d'inizio.
      */
      if (lasciaBuchetto(assegnate[0]?.operatorId, inizio, dalle, lavoro, occupato)) continue;

      // La fine vera è quella dell'ultimo trattamento assegnato: con due
      // persone accodate non è più la catena più lunga, è la somma.
      const fineVera = assegnate.reduce((m, a) => Math.max(m, toMinutes(a.endTime)), inizio);
      slots.push({
        attaccato: attacchi.has(inizio),
        time: toHHMM(inizio),
        endTime: toHHMM(fineVera),
        durataTotale: fineVera - inizio,
        prezzoTotale,
        assegnazioni: [...assegnate],
      });
    }
  }

  return slots;
}

export async function slotDisponibili(req: RichiestaDisponibilita): Promise<{
  slots: SlotProposto[];
  durataTotale: number;
  prezzoTotale: number;
}> {
  const passi = await preparaPassi(req.services, req.gender);
  if (!passi) return { slots: [], durataTotale: 0, prezzoTotale: 0 };

  const { prenotazione } = await leggiConfig();
  const ctx = await caricaContesto(req.date, req.date, prenotazione, req.ignoraAppointmentId);
  return {
    slots: slotDelGiorno(ctx, req.date, [passi], req.oraDa, req.oraA),
    durataTotale: passi.reduce((s, p) => s + p.duration, 0),
    prezzoTotale: passi.reduce((s, p) => s + p.price, 0),
  };
}

export interface RicercaSlot {
  /** Da che giorno cercare (compreso). */
  dateFrom: string;
  /** Quanti giorni guardare in avanti. */
  giorni: number;
  /** Come in RichiestaDisponibilita: l'appuntamento che si sta spostando. */
  ignoraAppointmentId?: string | null;
  services: ServizioRichiesto[];
  /**
   * I trattamenti della seconda persona, quando si prenota in due.
   *
   * Non è una seconda ricerca: si cerca un orario in cui stanno in piedi
   * tutte e due insieme, con operatrici diverse. Vuoto = una persona sola.
   */
  services2?: ServizioRichiesto[];
  gender: 'male' | 'female';
  /** Giorni della settimana accettati: 1=Lun … 6=Sab. Vuoto = tutti. */
  giorniSettimana?: number[];
  oraDa?: string | null;
  oraA?: string | null;
  /** Quanti orari al massimo restituire per giorno. */
  maxPerGiorno?: number;
}

export interface GiornoDisponibile {
  date: string;
  slots: SlotProposto[];
}

/**
 * Perché un giorno è uscito a mani vuote.
 *
 * Tre cose diversissime finivano nella stessa risposta — «non c'è posto» — e
 * quella risposta arrivava tale e quale alla cliente. Una cliente si è sentita
 * dire che domani e sabato erano pieni: nessuno può sapere, da lì, se il
 * centro fosse chiuso, se in agenda non ci fossero turni, o se davvero fosse
 * tutto occupato. Sono tre problemi con tre rimedi diversi, e due su tre non
 * sono un no da dare alla cliente.
 */
export type MotivoVuoto =
  /** Il centro quel giorno è chiuso: riposo, ferie, festivo. */
  | 'chiuso'
  /** Il centro è aperto ma in agenda nessuna operatrice ha turno. */
  | 'nessunTurno'
  /** C'è chi lavora, ma per quella seduta non resta un buco abbastanza lungo. */
  | 'pieno';

/** Perché in quel giorno non è uscito niente. Si guarda l'agenda, e basta. */
function perchéVuoto(ctx: Contesto, date: string): MotivoVuoto {
  if (!aperturaDelGiorno(ctx, date)) return 'chiuso';
  const lavoro = lavoroDelGiorno(ctx, date);
  const qualcunoInTurno = [...lavoro.values()].some(fasce => fasce.length > 0);
  return qualcunoInTurno ? 'pieno' : 'nessunTurno';
}

/**
 * "Quando posso venire?" — la ricerca vera: guarda avanti nei prossimi giorni
 * e riporta solo quelli in cui la seduta ci sta, rispettando i giorni della
 * settimana e la fascia oraria che la cliente ha indicato.
 */
export async function cercaSlot(req: RicercaSlot): Promise<{
  giorni: GiornoDisponibile[];
  durataTotale: number;
  prezzoTotale: number;
  /** Per ogni giorno guardato e rimasto vuoto, perché. */
  vuoti: Array<{ date: string; motivo: MotivoVuoto }>;
}> {
  const passi = await preparaPassi(req.services, req.gender);
  if (!passi) return { giorni: [], durataTotale: 0, prezzoTotale: 0, vuoti: [] };

  const passi2 = req.services2?.length ? await preparaPassi(req.services2, req.gender) : null;
  if (req.services2?.length && !passi2) return { giorni: [], durataTotale: 0, prezzoTotale: 0, vuoti: [] };
  const gruppi = passi2 ? [passi, passi2] : [passi];

  const { prenotazione } = await leggiConfig();
  // Quanto avanti guardare: il centro decide il tetto, chi chiama può solo
  // restare sotto — altrimenti l'app aprirebbe l'agenda di sei mesi.
  const quanti = Math.min(Math.max(1, req.giorni || prenotazione.giorniAvanti), Math.max(1, prenotazione.giorniAvanti));
  const date: string[] = [];
  const cursore = new Date(req.dateFrom + 'T12:00:00');
  for (let i = 0; i < quanti; i++) {
    const dow = cursore.getDay();
    // I giorni di chiusura non si filtrano qui: li conosce `centro.orari`, e un
    // giorno chiuso esce comunque a mani vuote. Filtrarlo anche qui vorrebbe
    // dire tenere l'elenco dei giorni di apertura in due posti.
    const vaBene = !req.giorniSettimana?.length || req.giorniSettimana.includes(dow);
    if (vaBene) {
      date.push(`${cursore.getFullYear()}-${String(cursore.getMonth() + 1).padStart(2, '0')}-${String(cursore.getDate()).padStart(2, '0')}`);
    }
    cursore.setDate(cursore.getDate() + 1);
  }
  if (date.length === 0) return { giorni: [], durataTotale: 0, prezzoTotale: 0, vuoti: [] };

  const ctx = await caricaContesto(date[0], date[date.length - 1], prenotazione, req.ignoraAppointmentId);
  const max = Math.min(Math.max(1, req.maxPerGiorno || 40), 100);

  const giorni: GiornoDisponibile[] = [];
  const vuoti: Array<{ date: string; motivo: MotivoVuoto }> = [];
  for (const d of date) {
    const slots = slotDelGiorno(ctx, d, gruppi, req.oraDa, req.oraA);
    if (slots.length > 0) giorni.push({ date: d, slots: distribuisci(slots, max) });
    else vuoti.push({ date: d, motivo: perchéVuoto(ctx, d) });
  }

  return {
    giorni,
    vuoti,
    // Con due persone il tempo è quello della più lunga, il prezzo la somma.
    durataTotale: Math.max(...gruppi.map(g => g.reduce((s, p) => s + p.duration, 0))),
    prezzoTotale: gruppi.reduce((s, g) => s + g.reduce((x, p) => x + p.price, 0), 0),
  };
}

/**
 * Quando gli orari sono troppi, si tagliano prendendoli in giro per la
 * giornata — non i primi.
 *
 * Prima si faceva `slice(0, max)`: con un tetto di dodici orari e un
 * trattamento da mezz'ora, i dodici finivano tutti fra le dieci e l'una e il
 * pomeriggio non veniva proposto mai. In agenda l'operatrice era libera fino a
 * sera, e "Cerca buchi" rispondeva che c'era posto solo la mattina.
 *
 * Qui si tiene il primo, l'ultimo e il resto spalmato in mezzo: il tetto serve
 * a non mandare in giro cento orari, non a dimezzare la giornata.
 */
function distribuisci(slots: SlotProposto[], max: number): SlotProposto[] {
  if (slots.length <= max || max < 2) return slots.slice(0, Math.max(1, max));
  const passo = (slots.length - 1) / (max - 1);
  const scelti: SlotProposto[] = [];
  for (let i = 0; i < max; i++) {
    const s = slots[Math.round(i * passo)];
    if (s && s !== scelti[scelti.length - 1]) scelti.push(s);
  }
  return scelti;
}

export interface OperatriceScelta {
  id: string;
  nome: string;
  /** Solo il nome di battesimo: sotto la faccina "Michela" sta, "Michela Cioffi" no. */
  nomeBreve: string;
  /** Foto tonda, se caricata in Staff. */
  avatar: string | null;
  /** Colore dell'operatrice: sfondo del cerchio quando la foto non c'è. */
  colore: string;
  /** Le categorie che sa fare davvero (regola di competenzePerOperatrice). */
  categorie: string[];
}

/**
 * Le operatrici che la cliente può scegliere nella prenotazione online, con
 * foto e categorie già risolte: la pagina filtra la fila delle faccine sulla
 * categoria scelta e mostra esattamente chi il motore accetterebbe.
 */
export async function operatriciSelezionabili(): Promise<OperatriceScelta[]> {
  const [ops, categorie] = await Promise.all([
    prisma.operator.findMany({
      where: { isActive: true, isResource: false },
      select: { id: true, firstName: true, lastName: true, specializations: true, avatar: true, color: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.treatment.findMany({ where: { isActive: true }, select: { category: true }, distinct: ['category'] }),
  ]);

  const competenze = competenzePerOperatrice(ops, categorie.map(c => c.category));
  return ops.map(o => ({
    id: o.id,
    nome: `${o.firstName} ${o.lastName}`.trim(),
    nomeBreve: o.firstName.trim(),
    avatar: o.avatar || null,
    colore: o.color,
    categorie: [...(competenze.get(o.id) || [])].sort(),
  }));
}
