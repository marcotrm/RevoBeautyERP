/**
 * L'agente che sposta gli appuntamenti su WhatsApp.
 *
 * Fino a ieri, alla cliente che rispondeva "devo spostare" il gestionale
 * annotava la richiesta e mandava una notifica al centro: l'appuntamento
 * restava in agenda e qualcuno doveva richiamare. In pratica succedeva questo —
 * la signora Giovanna scrive di sera, nessuno legge fino al mattino, e intanto
 * il posto resta occupato da una che non verrà.
 *
 * Qui la conversazione si chiude da sola: le proponiamo i giorni e gli orari
 * davvero liberi, spostiamo l'appuntamento in agenda, e SUBITO DOPO il posto
 * che si è liberato diventa una chiamata Copri buchi. È il punto che dà i
 * soldi: un buco coperto in cinque minuti vale un appuntamento, un buco
 * scoperto vale zero.
 *
 * Come il bot di prenotazione: menù numerati, niente interpretazione libera.
 * Su un'agenda vera un fraintendimento costa un appuntamento sbagliato.
 *
 * Cosa NON fa, di proposito:
 *  - non tocca appuntamenti che iniziano fra meno di due ore: lì il danno di
 *    uno spostamento sbagliato è immediato e serve una persona;
 *  - non tocca appuntamenti completati, bloccati o già annullati;
 *  - non decide di suo di riempire il buco: quello dipende da un interruttore
 *    (copriBuchiAuto), perché manda messaggi a pagamento a dieci persone.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendWhatsApp } from '@/lib/whatsapp';
import { sendTelegram } from '@/lib/telegram';
import { getWaAutomationsConfig } from '@/lib/wa-automations';
import { lanciaCopriBuchi } from '@/app/actions/copriBuchi';
import { cercaSlot } from '@/lib/bookingEngine';

/** Le risposte dell'agente sono etichettate, così in archivio si riconoscono. */
const say = (phone: string, text: string) => sendWhatsApp(phone, text, 'booking');

const SESSION_KIND = 'wa_spostamento';
/** Minuti di silenzio dopo i quali la conversazione riparte da capo. */
const SESSION_TTL_MIN = 30;
/** Giorni proposti nel menù. */
const GIORNI_AVANTI = 14;
/** Quanti orari mostrare per giornata: oltre è un muro di testo. */
const MAX_ORARI = 9;
/**
 * Sotto queste ore dall'inizio, l'agente non tocca niente.
 * È lo stesso anticipo che Copri buchi considera minimo per rivendere un posto:
 * più tardi di così, spostare crea un buco che non si copre più.
 */
const ORE_MINIME = 2;

const APERTI = ['confirmed', 'pending', 'scheduled', 'booked'];

/**
 * Uscire dalla conversazione, non disdire l'appuntamento.
 *
 * Attenzione a "annulla": qui significa "annulla l'appuntamento", non "annulla
 * la conversazione". Nel bot di prenotazione vuol dire l'opposto, e usarlo
 * anche qui vorrebbe dire chiudere la chat proprio a chi sta chiedendo di
 * disdire.
 */
const ESCI = /\b(lascia stare|lasciamo stare|niente|non importa|esci|basta cos[iì])\b/i;
/**
 * "Devo spostare" scritto a metà conversazione vuol dire ricomincia.
 *
 * Prima veniva letto come una risposta sbagliata al menù ("rispondi con un
 * numero da 1 a 14"), e chi non capiva restava chiuso dentro finché la
 * sessione non scadeva da sola dopo mezz'ora. Chi ripete la richiesta di
 * partenza sta dicendo che si è perso: si riparte da capo.
 */
const RIPARTI = /\b(devo spostare|vorrei spostare|posso spostare|spostare l'appuntamento|ricomincia|da capo)\b/i;
const DISDETTA = /\b(disdi\w*|annull\w*|cancell\w*|non vengo|non verr[òo]|non posso pi[uù])\b/i;
const CONFERMA = /^\s*(s[iì]|si'|ok|okay|va bene|confermo|conferma|perfetto|d'accordo|👍|✅)\b/i;

type Passo = 'cosa' | 'giorno' | 'orario' | 'conferma';

interface Orario { time: string; operatorId: string; operatorName: string }

interface Sessione {
  passo: Passo;
  aggiornataIl: string;
  appointmentId: string;
  opzioni: Array<{ id: string; label: string; extra?: Orario }>;
  azione?: 'sposta' | 'disdice';
  /** Quante volte di fila non abbiamo capito: al terzo giro passa una persona. */
  incompresi?: number;
  nuovaData?: string;
  nuovoOrario?: Orario;
}

// ============================================================
// Sessione
// ============================================================

function rowId(phone: string): string {
  return `wa:spostamento:${phone}`;
}

async function leggiSessione(phone: string): Promise<Sessione | null> {
  const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(phone) } });
  const s = row?.data as unknown as Sessione | undefined;
  if (!s?.passo) return null;
  const minuti = (Date.now() - new Date(s.aggiornataIl).getTime()) / 60000;
  if (!isFinite(minuti) || minuti > SESSION_TTL_MIN) return null;
  return s;
}

async function salvaSessione(phone: string, s: Sessione): Promise<void> {
  const data = { ...s, aggiornataIl: new Date().toISOString() } as unknown as object;
  await prisma.adminEntry.upsert({
    where: { rowId: rowId(phone) },
    update: { data },
    create: { rowId: rowId(phone), kind: SESSION_KIND, entityId: phone, data, createdAt: new Date().toISOString() },
  });
}

async function chiudiSessione(phone: string): Promise<void> {
  await prisma.adminEntry.delete({ where: { rowId: rowId(phone) } }).catch(() => {});
}

// ============================================================
// Testo e date
// ============================================================

function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function shiftDate(ymd: string, giorni: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + giorni);
  return dt.toISOString().slice(0, 10);
}

function elenco(opzioni: Array<{ label: string }>): string {
  return opzioni.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
}

/** Il numero scelto: accetta "3", "3.", "n. 3", "il 3". */
function scelta(text: string, max: number): number | null {
  const m = String(text || '').match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= max ? n - 1 : null;
}

function minuti(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function orario(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Quanto manca all'inizio, in ore. Negativo se è già passato. */
function oreAllInizio(date: string, startTime: string): number {
  const inizio = Date.parse(`${date}T${startTime}:00+02:00`);
  return (inizio - Date.now()) / 3_600_000;
}

// ============================================================
// Il buco che resta
// ============================================================

/**
 * Il posto lasciato libero diventa una chiamata Copri buchi.
 *
 * Con l'interruttore spento non si manda niente a nessuno: si avvisa il centro
 * e il buco resta visibile in agenda (la striscia verde con il tasto "Copri"),
 * da lanciare a mano. Con l'interruttore acceso parte il primo giro subito.
 */
async function liberaIlPosto(appt: {
  id: string; date: string; startTime: string; endTime: string;
  operatorId: string; operatorName: string;
  treatmentId: string; treatmentName: string; price: number; clientName: string;
}, motivo: 'spostamento' | 'disdetta'): Promise<void> {
  const quando = `${appt.date.split('-').reverse().join('/')} ${appt.startTime}-${appt.endTime}`;
  const cfg = await getWaAutomationsConfig();

  if (!cfg.copriBuchiAuto) {
    await sendTelegram(
      `🕳 <b>Si è liberato un posto</b> (${motivo})\n` +
      `${quando} · ${appt.operatorName}\n` +
      `Era: ${appt.clientName} — ${appt.treatmentName}\n\n` +
      `Copri buchi automatico è spento: il posto è libero in agenda, la chiamata si lancia da lì.`
    ).catch(() => {});
    return;
  }

  const res = await lanciaCopriBuchi({
    date: appt.date,
    from: appt.startTime,
    to: appt.endTime,
    operatorId: appt.operatorId,
    operatorName: appt.operatorName,
    treatmentId: appt.treatmentId,
    treatmentName: appt.treatmentName,
    prezzo: appt.price,
    origine: 'disdetta',
    disdettaDi: appt.clientName,
  }).catch((): { ok: boolean; inviati?: number; errore?: string } => ({ ok: false, errore: 'errore interno' }));

  await sendTelegram(
    res.ok
      ? `🕳 <b>Posto liberato e già in vendita</b> (${motivo})\n${quando} · ${appt.operatorName}\n` +
        `${appt.treatmentName} — avvisate ${res.inviati ?? 0} clienti.`
      : `🕳 <b>Si è liberato un posto</b> (${motivo})\n${quando} · ${appt.operatorName}\n` +
        `Copri buchi non è partito: ${res.errore || 'motivo sconosciuto'}`
  ).catch(() => {});
}

// ============================================================
// Passi della conversazione
// ============================================================

async function chiediCosaFare(phone: string, appt: { id: string; date: string; startTime: string; treatmentName: string }): Promise<void> {
  const opzioni = [
    { id: 'sposta', label: 'Scegliere un altro giorno' },
    { id: 'disdice', label: 'Disdire, non posso proprio venire' },
  ];
  await salvaSessione(phone, {
    passo: 'cosa', aggiornataIl: new Date().toISOString(),
    appointmentId: appt.id, opzioni,
  });
  await say(phone,
    `Ci penso io. Il tuo appuntamento è ${humanDate(appt.date)} alle ${appt.startTime} per ${appt.treatmentName}.\n\n` +
    'Cosa preferisci?\n\n' + elenco(opzioni) +
    '\n\nRispondi con il numero.'
  );
}

type ApptPerRicerca = { id: string; treatmentId: string; duration: number; services?: unknown };

/*
  Si mostrano SOLO i giorni in cui c'è posto davvero.

  Prima l'elenco erano i prossimi quattordici giorni a prescindere: la cliente
  ne sceglieva uno e si sentiva rispondere "quel giorno non ho orari liberi".
  Farle scegliere fra cose che non esistono è farle perdere tempo due volte, e
  a ogni no la voglia di spostare cala.
*/
async function chiediGiorno(phone: string, s: Sessione, appt: ApptPerRicerca): Promise<void> {
  const disponibili = await giorniConPosto(appt);
  const oggi = todayRome();

  if (!disponibili.length) {
    await chiudiSessione(phone);
    await say(phone,
      'Ho guardato le prossime due settimane e non trovo un posto libero per il tuo trattamento. ' +
      'Ti facciamo richiamare da una di noi per sistemarlo insieme.'
    );
    await sendTelegram(
      `⚠️ <b>Spostamento senza posti</b>\nUna cliente ha chiesto di spostare, ma nei prossimi ` +
      `${GIORNI_AVANTI} giorni non c'è disponibilità per il suo trattamento: va richiamata.`
    ).catch(() => {});
    return;
  }

  const opzioni = disponibili.map(g => ({
    id: g.date,
    // Accanto al giorno la prima ora libera: si sceglie molto più in fretta
    // sapendo già se quel giorno è mattina o pomeriggio.
    label: `${g.date === oggi ? `Oggi — ${humanDate(g.date)}`
      : g.date === shiftDate(oggi, 1) ? `Domani — ${humanDate(g.date)}`
      : humanDate(g.date).replace(/^./, c => c.toUpperCase())} — dalle ${g.orari[0].time}`,
  }));

  await salvaSessione(phone, { ...s, passo: 'giorno', azione: 'sposta', opzioni });
  await say(phone,
    'In che giorno ti farebbe comodo?\n\n' + elenco(opzioni) +
    '\n\nRispondi con il numero: ci sono solo i giorni in cui ho posto per te.'
  );
}

async function chiediOrario(phone: string, s: Sessione, data: string, appt: ApptPerRicerca): Promise<void> {
  const giorni = await giorniConPosto(appt);
  const g = giorni.find(x => x.date === data);

  // Se quel giorno si è riempito mentre lei sceglieva, si torna all'elenco
  // aggiornato invece di rispondere "niente liberi" e lasciarla lì.
  if (!g) { await chiediGiorno(phone, s, appt); return; }

  const opzioni = g.orari.slice(0, MAX_ORARI).map(o => ({
    id: o.time, label: `ore ${o.time} con ${o.operatorName.split(' ')[0]}`, extra: o,
  }));
  await salvaSessione(phone, { ...s, passo: 'orario', nuovaData: data, opzioni });
  await say(phone, `${humanDate(data)} ho questi orari liberi:\n\n` + elenco(opzioni) + '\n\nRispondi con il numero.');
}

/**
 * I giorni in cui questa seduta ci sta davvero, con i loro orari.
 *
 * Due passaggi, e servono tutti e due:
 *
 *  1. il motore della prenotazione guarda i prossimi giorni in una sola
 *     lettura e scarta subito quelli senza posto (turni, pause, riposi,
 *     competenze). I trattamenti si passano tutti — due laser fanno 45
 *     minuti, non 20 — ma NON l'operatrice: vincolandola, nei giorni in cui è
 *     piena la risposta sarebbe "niente disponibile" mentre una collega libera
 *     c'è. Chi lo farà si legge accanto a ogni orario.
 *
 *  2. si tengono solo gli orari in cui entra la durata REALE già scritta in
 *     agenda, che può essere stata allungata a mano (40 minuti su un
 *     trattamento da 30) e il listino non lo sa.
 *
 * Senza il secondo passaggio il bot proponeva le 14:00, la cliente confermava,
 * e al salvataggio scopriva l'accavallamento: rispondeva "quell'orario è
 * appena stato preso" — che non era vero — e riproponeva lo stesso orario.
 */
async function giorniConPosto(appt: {
  id: string; duration: number; services?: unknown; treatmentId: string;
}): Promise<{ date: string; orari: Orario[] }[]> {
  const servizi = Array.isArray(appt.services) && appt.services.length
    ? (appt.services as { treatmentId?: string }[])
        .filter(x => x?.treatmentId)
        .map(x => ({ treatmentId: String(x.treatmentId), operatorId: null }))
    : [{ treatmentId: appt.treatmentId, operatorId: null }];

  const sesso = Array.isArray(appt.services)
    ? ((appt.services as { gender?: string }[])[0]?.gender === 'male' ? 'male' : 'female')
    : 'female';

  const oggi = todayRome();
  const trovati = await cercaSlot({
    dateFrom: oggi, giorni: GIORNI_AVANTI, services: servizi,
    gender: sesso, maxPerGiorno: 40,
  }).catch(() => ({ giorni: [] as { date: string; slots: { time: string; assegnazioni?: { operatorId: string; operatorName: string }[] }[] }[] }));

  if (!trovati.giorni.length) return [];

  // Gli appuntamenti del periodo si leggono UNA volta sola: un controllo per
  // ogni orario proposto sarebbe una raffica di interrogazioni al database.
  const ultimo = trovati.giorni[trovati.giorni.length - 1].date;
  const occupati = await prisma.appointment.findMany({
    where: { date: { gte: trovati.giorni[0].date, lte: ultimo }, status: { in: APERTI }, id: { not: appt.id } },
    select: { date: true, operatorId: true, startTime: true, endTime: true },
  });

  const risultato: { date: string; orari: Orario[] }[] = [];
  for (const g of trovati.giorni) {
    const delGiorno = occupati.filter(o => o.date === g.date);
    const orari: Orario[] = [];
    for (const sl of g.slots) {
      const prima = (sl as { assegnazioni?: { operatorId: string; operatorName: string }[] }).assegnazioni?.[0];
      if (!prima) continue;
      const da = minuti(sl.time), a = da + appt.duration;
      const scontro = delGiorno.some(o =>
        o.operatorId === prima.operatorId && minuti(o.startTime) < a && da < minuti(o.endTime)
      );
      if (!scontro) orari.push({ time: sl.time, operatorId: prima.operatorId, operatorName: prima.operatorName });
    }
    if (orari.length) risultato.push({ date: g.date, orari });
  }
  return risultato;
}


/**
 * Quando non si capisce: si rimostra cosa si può rispondere, non si ripete
 * "rispondi con un numero". Alla terza volta di fila la conversazione passa a
 * una persona: insistere con un menù a chi non lo sta leggendo è il modo più
 * veloce per far scrivere "ma siete un robot?".
 */
async function nonHoCapito(phone: string, s: Sessione, testo: string): Promise<void> {
  const quante = (s.incompresi || 0) + 1;

  if (quante >= 3) {
    await chiudiSessione(phone);
    await say(phone,
      'Scusami, non riesco a seguirti bene da qui. Ti faccio richiamare da una di noi, ' +
      'così sistemiamo l\'appuntamento insieme.'
    );
    await sendTelegram(
      `🙋 <b>Spostamento da riprendere a mano</b>\nIl bot non ha capito tre volte di fila.\n` +
      `Numero: ${phone}\nUltimo messaggio: "${testo.slice(0, 80)}"`
    ).catch(() => {});
    return;
  }

  await salvaSessione(phone, { ...s, incompresi: quante });
  await say(phone, `${testo.trim() ? 'Non ho capito. ' : ''}${s.opzioni.length ? 'Scegli una di queste:\n\n' + elenco(s.opzioni) + '\n\nRispondi con il numero' : 'Rispondi'}, oppure scrivi "lascia stare" per non cambiare niente.`);
}

async function chiediConferma(phone: string, s: Sessione, appt: { treatmentName: string; date: string; startTime: string }): Promise<void> {
  await salvaSessione(phone, { ...s, passo: 'conferma', opzioni: [] });
  if (s.azione === 'disdice') {
    await say(phone,
      `Confermi la disdetta dell'appuntamento di ${humanDate(appt.date)} alle ${appt.startTime} per ${appt.treatmentName}?\n\n` +
      'Rispondi *SI* per disdire, oppure "lascia stare" per tenerlo.'
    );
    return;
  }
  await say(phone,
    'Riepilogo:\n' +
    `• ${appt.treatmentName}\n` +
    `• da ${humanDate(appt.date)} alle ${appt.startTime}\n` +
    `• a ${humanDate(s.nuovaData!)} alle ${s.nuovoOrario!.time} con ${s.nuovoOrario!.operatorName.split(' ')[0]}\n\n` +
    'Confermo? Rispondi *SI*, oppure "lascia stare".'
  );
}

/** Vero se in quel posto, per quell'operatrice, c'è già qualcun altro. */
async function postoOccupato(operatorId: string, date: string, da: string, a: string, escludi: string): Promise<boolean> {
  const altri = await prisma.appointment.findMany({
    where: { operatorId, date, status: { in: APERTI }, id: { not: escludi } },
    select: { startTime: true, endTime: true },
  });
  const x1 = minuti(da), x2 = minuti(a);
  return altri.some(o => minuti(o.startTime) < x2 && x1 < minuti(o.endTime));
}

// ============================================================
// Esecuzione
// ============================================================

async function esegui(phone: string, s: Sessione, origin: string): Promise<void> {
  const appt = await prisma.appointment.findUnique({ where: { id: s.appointmentId }, include: { client: true } });
  if (!appt || !APERTI.includes(appt.status)) {
    await chiudiSessione(phone);
    await say(phone, 'Non trovo più quell\'appuntamento come prenotato. Ti risponde subito una di noi.');
    return;
  }

  // Com'era prima: serve sia per il messaggio sia per il buco da coprire.
  const vecchio = {
    id: appt.id, date: appt.date, startTime: appt.startTime, endTime: appt.endTime,
    operatorId: appt.operatorId, operatorName: appt.operatorName,
    treatmentId: appt.treatmentId, treatmentName: appt.treatmentName,
    price: appt.price, clientName: appt.clientName,
  };
  const adesso = new Date().toISOString();

  if (s.azione === 'disdice') {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: 'cancelled',
        cancelReason: 'Disdetta dalla cliente su WhatsApp',
        cancelledAt: adesso,
        updatedAt: adesso,
      },
    });
    await chiudiSessione(phone);
    await say(phone, 'Fatto, l\'appuntamento è annullato. Quando vuoi riprenotare scrivimi pure "prenota". A presto!');
    await liberaIlPosto(vecchio, 'disdetta');
    return;
  }

  const nuovoInizio = s.nuovoOrario!.time;
  const durata = appt.duration;
  const nuovaFine = orario(minuti(nuovoInizio) + durata);

  // Fra la proposta e il "sì" possono passare minuti: qualcun altro può aver
  // preso quell'orario. Meglio riproporre che sovrapporre due clienti.
  if (await postoOccupato(s.nuovoOrario!.operatorId, s.nuovaData!, nuovoInizio, nuovaFine, appt.id)) {
    await say(phone, 'Quell\'orario è appena stato preso, mi dispiace. Ti rimando quelli ancora liberi.');
    await chiediOrario(phone, s, s.nuovaData!, appt);
    return;
  }

  const nota = `[WhatsApp ${new Date().toLocaleDateString('it-IT')}] Spostato dalla cliente: era ${vecchio.date.split('-').reverse().join('/')} alle ${vecchio.startTime}.`;
  await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      date: s.nuovaData!,
      startTime: nuovoInizio,
      endTime: nuovaFine,
      operatorId: s.nuovoOrario!.operatorId,
      operatorName: s.nuovoOrario!.operatorName,
      notes: appt.notes ? `${appt.notes}\n${nota}` : nota,
      updatedAt: adesso,
    },
  });

  await chiudiSessione(phone);
  await say(phone,
    `È fatta! Ti aspettiamo ${humanDate(s.nuovaData!)} alle ${nuovoInizio} per ${appt.treatmentName}.\n` +
    'Se ti serve ancora cambiare, scrivimi pure.'
  );
  await sendTelegram(
    `🔄 <b>Appuntamento spostato dalla cliente</b>\n${appt.clientName} — ${appt.treatmentName}\n` +
    `Da: ${vecchio.date.split('-').reverse().join('/')} ${vecchio.startTime} (${vecchio.operatorName})\n` +
    `A: ${s.nuovaData!.split('-').reverse().join('/')} ${nuovoInizio} (${s.nuovoOrario!.operatorName})`
  ).catch(() => {});

  await liberaIlPosto(vecchio, 'spostamento');
}

// ============================================================
// Ingresso
// ============================================================

export interface EsitoSpostamento { handled: boolean; passo?: Passo; nota?: string }

/**
 * Apre la conversazione di spostamento sull'appuntamento indicato.
 * La chiama chi ha già capito che la cliente vuole spostare — oggi la risposta
 * al promemoria (lib/wa-appointments.ts).
 */
export async function avviaSpostamento(params: {
  phone: string;
  appointment: { id: string; date: string; startTime: string; treatmentName: string; isLocked?: boolean };
}): Promise<EsitoSpostamento> {
  const { phone, appointment } = params;
  try {
    const cfg = await getWaAutomationsConfig();
    if (!cfg.spostamenti) return { handled: false, nota: 'agente spostamenti spento' };
    if (appointment.isLocked) return { handled: false, nota: 'appuntamento bloccato' };

    // Troppo a ridosso: qui non si improvvisa, risponde una persona.
    if (oreAllInizio(appointment.date, appointment.startTime) < ORE_MINIME) {
      await say(phone,
        'Ho visto il tuo messaggio. Manca poco all\'appuntamento, quindi preferisco farti richiamare ' +
        'da una di noi per sistemarlo insieme — ci sentiamo a momenti.'
      );
      return { handled: true, nota: 'meno di due ore all\'inizio: passata a una persona' };
    }

    await chiediCosaFare(phone, appointment);
    return { handled: true, passo: 'cosa' };
  } catch (err) {
    console.error('[wa-spostamento] avvio fallito', err);
    return { handled: false };
  }
}

/**
 * Fa avanzare una conversazione di spostamento già aperta.
 * Torna handled=false se per questo numero non ce n'è una: il webhook prosegue
 * con gli altri gestori. Non lancia mai.
 */
export async function handleSpostamentoMessage(params: {
  phone: string;
  text: string;
  origin: string;
}): Promise<EsitoSpostamento> {
  const { phone, text, origin } = params;

  try {
    const s = await leggiSessione(phone);
    if (!s) return { handled: false };

    // Ripete la richiesta di partenza: si riparte, non la si corregge.
    if (RIPARTI.test(text) && s.passo !== 'cosa') {
      const ap = await prisma.appointment.findUnique({ where: { id: s.appointmentId } });
      if (ap && APERTI.includes(ap.status)) {
        await chiediCosaFare(phone, ap);
        return { handled: true, passo: 'cosa' };
      }
    }

    if (ESCI.test(text)) {
      await chiudiSessione(phone);
      await say(phone, 'Va bene, non ho cambiato niente: l\'appuntamento resta com\'era. A presto!');
      return { handled: true };
    }

    const appt = await prisma.appointment.findUnique({ where: { id: s.appointmentId } });
    if (!appt) {
      await chiudiSessione(phone);
      return { handled: false, nota: 'appuntamento sparito' };
    }

    switch (s.passo) {
      case 'cosa': {
        // Chi scrive "disdico" invece di premere 2 sta dicendo la stessa cosa.
        const i = scelta(text, s.opzioni.length);
        const vuoleDisdire = i === 1 || (i === null && DISDETTA.test(text));
        const vuoleSpostare = i === 0 || (i === null && /\b(spost\w*|altro giorno|cambi\w*)\b/i.test(text));

        if (vuoleDisdire) {
          await chiediConferma(phone, { ...s, azione: 'disdice' }, appt);
          return { handled: true, passo: 'conferma' };
        }
        if (vuoleSpostare) {
          await chiediGiorno(phone, s, appt);
          return { handled: true, passo: 'giorno' };
        }
        await nonHoCapito(phone, s, text);
        return { handled: true, passo: 'cosa' };
      }

      case 'giorno': {
        const i = scelta(text, s.opzioni.length);
        if (i === null) {
          await nonHoCapito(phone, s, text);
          return { handled: true, passo: 'giorno' };
        }
        await chiediOrario(phone, s, s.opzioni[i].id, appt);
        return { handled: true, passo: 'orario' };
      }

      case 'orario': {
        const i = scelta(text, s.opzioni.length);
        if (i === null) {
          await nonHoCapito(phone, s, text);
          return { handled: true, passo: 'orario' };
        }
        const scelto = s.opzioni[i].extra as Orario;
        await chiediConferma(phone, { ...s, nuovoOrario: scelto }, appt);
        return { handled: true, passo: 'conferma' };
      }

      case 'conferma': {
        if (CONFERMA.test(text)) {
          await esegui(phone, s, origin);
          return { handled: true };
        }
        await nonHoCapito(phone, s, text);
        return { handled: true, passo: 'conferma' };
      }
    }

    return { handled: false };
  } catch (err) {
    console.error('[wa-spostamento] errore', err);
    return { handled: false };
  }
}
