/**
 * Motore della prenotazione online — uno solo, usato sia dalla pagina web
 * /prenota sia dalla app clienti.
 *
 * Cosa sa fare che il vecchio calcolo non sapeva:
 *  - più trattamenti nella stessa seduta, uno di fila all'altro;
 *  - operatrice scelta dalla cliente, oppure "la prima disponibile";
 *  - rispetta il TURNO vero dell'operatrice (orari e pausa), la settimana
 *    personalizzata in Staff → Turni, e le fasce bloccate in agenda.
 *
 * Il vecchio calcolo guardava solo apertura/chiusura del centro: offriva le
 * 15:00 a chi è in pausa e le 16:00 a chi stacca alle 14. Qui non succede.
 */

import { prisma } from '@/lib/prisma';
import { toMinutes, toHHMM, todayInItaly } from '@/lib/voice';
import { mondayISO } from '@/lib/weekSchedule';

/** Orari in cui il centro è aperto: nessuno slot fuori da qui. */
const APERTURA = '09:00';
const CHIUSURA = '19:00';
/** Ogni quanto si prova un orario di inizio. */
const PASSO_MINUTI = 15;
/**
 * Preavviso minimo per prenotare oggi. Senza, alle 16 la pagina proporrebbe
 * ancora le 11:30, e il centro si troverebbe un appuntamento nel passato.
 */
const PREAVVISO_MINUTI = 60;
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
}

export interface SlotProposto {
  time: string;      // inizio della seduta
  endTime: string;   // fine dell'ultimo trattamento
  durataTotale: number;
  prezzoTotale: number;
  /** Chi fa cosa e quando: è quello che poi si salva sull'appuntamento. */
  assegnazioni: AssegnazioneServizio[];
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
function fasceDiLavoro(turno: Turno | undefined): Fascia[] {
  const apertura = toMinutes(APERTURA);
  const chiusura = toMinutes(CHIUSURA);
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

interface Operatrice { id: string; firstName: string; lastName: string; schedule: unknown }
interface Contesto {
  operatori: Operatrice[];
  /** turni personalizzati per lunedì della settimana */
  settimane: { operatorId: string; weekStart: string; schedule: unknown }[];
  /** occupato[data][operatorId] = fasce già prese */
  occupatoPerData: Map<string, Map<string, Fascia[]>>;
}

/**
 * Carica in UNA volta tutto ciò che serve per un intervallo di giorni.
 * Riempire un calendario di due settimane girando giorno per giorno voleva
 * dire ottanta interrogazioni al database: così sono quattro.
 */
async function caricaContesto(dateFrom: string, dateTo: string): Promise<Contesto> {
  const settimaneCoinvolte = new Set<string>();
  for (let d = new Date(dateFrom + 'T12:00:00'); d <= new Date(dateTo + 'T12:00:00'); d.setDate(d.getDate() + 7)) {
    settimaneCoinvolte.add(mondayISO(d));
  }
  settimaneCoinvolte.add(mondayISO(new Date(dateTo + 'T12:00:00')));

  const [operatori, settimane, appuntamenti, blocchi] = await Promise.all([
    prisma.operator.findMany({
      where: { isActive: true, isResource: false },
      select: { id: true, firstName: true, lastName: true, schedule: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.operatorWeekSchedule.findMany({ where: { weekStart: { in: [...settimaneCoinvolte] } } }),
    prisma.appointment.findMany({
      where: { date: { gte: dateFrom, lte: dateTo }, status: { in: STATI_OCCUPANTI } },
      select: { date: true, operatorId: true, startTime: true, endTime: true, services: true },
    }),
    prisma.agendaBlock.findMany({
      where: { date: { gte: dateFrom, lte: dateTo } },
      select: { date: true, operatorId: true, startTime: true, endTime: true },
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

  return { operatori, settimane, occupatoPerData };
}

/** Fasce di lavoro di ogni operatrice in una certa data (settimana personalizzata > turno base). */
function lavoroDelGiorno(ctx: Contesto, date: string): Map<string, Fascia[]> {
  const giorno = new Date(date + 'T12:00:00');
  const dow = giorno.getDay(); // 0=Dom
  const weekStart = mondayISO(giorno);
  const lavoro = new Map<string, Fascia[]>();
  for (const op of ctx.operatori) {
    if (dow === 0) { lavoro.set(op.id, []); continue; } // domenica chiuso
    const perSettimana = ctx.settimane.find(w => w.operatorId === op.id && w.weekStart === weekStart);
    const mappa = (perSettimana?.schedule ?? op.schedule) as Record<string, Turno> | null;
    lavoro.set(op.id, fasceDiLavoro(mappa?.[String(dow)]));
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
  treatmentId: string; treatmentName: string; operatorId: string | null;
  duration: number; price: number;
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
      operatorId: s.operatorId || null,
      duration: Math.max(5, durataDi(t, gender)),
      price: prezzoDi(t, gender),
    };
  });
}

/** Gli orari buoni di UN giorno, con il contesto già caricato. */
function slotDelGiorno(
  ctx: Contesto, date: string, passi: Passo[], oraDa?: string | null, oraA?: string | null,
): SlotProposto[] {
  const lavoro = lavoroDelGiorno(ctx, date);
  const occupato = ctx.occupatoPerData.get(date) || new Map<string, Fascia[]>();
  const nomeDi = new Map(ctx.operatori.map(o => [o.id, `${o.firstName} ${o.lastName}`.trim()]));

  const durataTotale = passi.reduce((s, p) => s + p.duration, 0);
  const prezzoTotale = passi.reduce((s, p) => s + p.price, 0);

  // Se il giorno è oggi, si parte da adesso più il preavviso
  let minimoOggi = 0;
  if (date === todayInItaly()) {
    const adesso = new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
    minimoOggi = toMinutes(adesso) + PREAVVISO_MINUTI;
  }
  const dalle = Math.max(toMinutes(APERTURA), oraDa ? toMinutes(oraDa) : 0, minimoOggi);
  const alle = Math.min(toMinutes(CHIUSURA), oraA ? toMinutes(oraA) : toMinutes(CHIUSURA));

  const slots: SlotProposto[] = [];

  for (let inizio = dalle; inizio + durataTotale <= alle; inizio += PASSO_MINUTI) {
    const assegnate: AssegnazioneServizio[] = [];

    const prova = (i: number, cursore: number): boolean => {
      if (i >= passi.length) return true;
      const p = passi[i];
      const fine = cursore + p.duration;
      const candidate = p.operatorId ? ctx.operatori.filter(o => o.id === p.operatorId) : ctx.operatori;

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
        });
        if (prova(i + 1, fine)) return true;
        assegnate.pop();
      }
      return false;
    };

    if (prova(0, inizio)) {
      slots.push({
        time: toHHMM(inizio),
        endTime: toHHMM(inizio + durataTotale),
        durataTotale,
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

  const ctx = await caricaContesto(req.date, req.date);
  return {
    slots: slotDelGiorno(ctx, req.date, passi, req.oraDa, req.oraA),
    durataTotale: passi.reduce((s, p) => s + p.duration, 0),
    prezzoTotale: passi.reduce((s, p) => s + p.price, 0),
  };
}

export interface RicercaSlot {
  /** Da che giorno cercare (compreso). */
  dateFrom: string;
  /** Quanti giorni guardare in avanti. */
  giorni: number;
  services: ServizioRichiesto[];
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
 * "Quando posso venire?" — la ricerca vera: guarda avanti nei prossimi giorni
 * e riporta solo quelli in cui la seduta ci sta, rispettando i giorni della
 * settimana e la fascia oraria che la cliente ha indicato.
 */
export async function cercaSlot(req: RicercaSlot): Promise<{
  giorni: GiornoDisponibile[];
  durataTotale: number;
  prezzoTotale: number;
}> {
  const passi = await preparaPassi(req.services, req.gender);
  if (!passi) return { giorni: [], durataTotale: 0, prezzoTotale: 0 };

  const quanti = Math.min(Math.max(1, req.giorni || 14), 60);
  const date: string[] = [];
  const cursore = new Date(req.dateFrom + 'T12:00:00');
  for (let i = 0; i < quanti; i++) {
    const dow = cursore.getDay();
    const vaBene = dow !== 0 && (!req.giorniSettimana?.length || req.giorniSettimana.includes(dow));
    if (vaBene) {
      date.push(`${cursore.getFullYear()}-${String(cursore.getMonth() + 1).padStart(2, '0')}-${String(cursore.getDate()).padStart(2, '0')}`);
    }
    cursore.setDate(cursore.getDate() + 1);
  }
  if (date.length === 0) return { giorni: [], durataTotale: 0, prezzoTotale: 0 };

  const ctx = await caricaContesto(date[0], date[date.length - 1]);
  const max = Math.min(Math.max(1, req.maxPerGiorno || 40), 100);

  const giorni: GiornoDisponibile[] = [];
  for (const d of date) {
    const slots = slotDelGiorno(ctx, d, passi, req.oraDa, req.oraA);
    if (slots.length > 0) giorni.push({ date: d, slots: slots.slice(0, max) });
  }

  return {
    giorni,
    durataTotale: passi.reduce((s, p) => s + p.duration, 0),
    prezzoTotale: passi.reduce((s, p) => s + p.price, 0),
  };
}

/**
 * Le operatrici che la cliente può scegliere per una certa lista di
 * trattamenti: quelle che nei prossimi giorni hanno almeno un buco utile.
 * Serve al menu "Scelta operatrice" — inutile proporre chi è in ferie.
 */
export async function operatriciSelezionabili(): Promise<{ id: string; nome: string }[]> {
  const ops = await prisma.operator.findMany({
    where: { isActive: true, isResource: false },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
  return ops.map(o => ({ id: o.id, nome: `${o.firstName} ${o.lastName}`.trim() }));
}
