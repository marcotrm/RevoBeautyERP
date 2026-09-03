'use server';

/**
 * La caparra, dal lato del gestionale.
 *
 * Le regole si scrivono una volta in Impostazioni; da li' in poi la
 * prenotazione online decide da sola se chiederla, a chi e quanto. Quello che
 * resta a chi sta al banco sono tre gesti: mandare il link, segnare che i
 * soldi sono arrivati, decidere se trattenerla quando la cliente non si
 * presenta.
 *
 * L'ultimo e' apposta un gesto umano. Trattenere venti euro a una cliente e'
 * una decisione con dentro una storia — la macchina non la conosce.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  REGOLE_CAPARRA_DEFAULT, type Caparra, type RegoleCaparra,
  importoCaparra, serveCaparra, testoRichiesta,
} from '@/lib/caparra';

const RIGA = 'integration:caparra';

export async function regoleCaparra(): Promise<RegoleCaparra> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA } });
    return { ...REGOLE_CAPARRA_DEFAULT, ...((r?.data as Partial<RegoleCaparra>) || {}) };
  } catch {
    return REGOLE_CAPARRA_DEFAULT;
  }
}

export async function salvaRegoleCaparra(regole: Partial<RegoleCaparra>): Promise<{ ok: boolean }> {
  const attuali = await regoleCaparra();
  const nuove: RegoleCaparra = { ...attuali, ...regole };
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA },
    update: { data: nuove as unknown as object },
    create: { rowId: RIGA, kind: 'integration', entityId: 'caparra', data: nuove as unknown as object, createdAt: new Date().toISOString() },
  });
  return { ok: true };
}

/** Il numero di appuntamenti saltati da questa cliente: serve a decidere. */
async function saltiDi(clientId: string): Promise<number> {
  return prisma.appointment.count({ where: { clientId, status: 'no_show' } });
}

/**
 * Decide e apre la caparra su un appuntamento appena creato.
 * Ritorna la caparra se e' stata chiesta, altrimenti null.
 */
export async function apriCaparra(appointmentId: string): Promise<Caparra | null> {
  const regole = await regoleCaparra();
  if (!regole.attiva) return null;

  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clientId: true, price: true, treatmentCategory: true, services: true, date: true, startTime: true, caparra: true },
  });
  if (!a || a.caparra) return null;

  const categorie = new Set<string>([a.treatmentCategory]);
  for (const s of (a.services as { treatmentCategory?: string }[] | null) || []) {
    if (s?.treatmentCategory) categorie.add(s.treatmentCategory);
  }

  const [visite, salti] = await Promise.all([
    prisma.appointment.count({ where: { clientId: a.clientId, status: 'completed' } }),
    saltiDi(a.clientId),
  ]);

  const dovuta = serveCaparra(regole, {
    conto: a.price,
    categorie: [...categorie],
    clienteNuova: visite === 0,
    saltiPrecedenti: salti,
  });
  if (!dovuta) return null;

  const importo = importoCaparra(regole, a.price);
  if (importo <= 0) return null;

  const scadenza = new Date(Date.now() + regole.oreValidita * 3600_000).toISOString();
  const caparra: Caparra = {
    richiesta: importo,
    stato: 'attesa',
    link: regole.linkPagamento || undefined,
    chiestaIl: new Date().toISOString(),
    scadenza,
  };
  await prisma.appointment.update({ where: { id: a.id }, data: { caparra: caparra as unknown as object } });
  return caparra;
}

/** Manda su WhatsApp il link per pagare la caparra. */
export async function mandaRichiestaCaparra(appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  const regole = await regoleCaparra();
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clientName: true, date: true, startTime: true, caparra: true, client: { select: { phone: true, firstName: true } } },
  });
  if (!a) return { ok: false, error: 'Appuntamento non trovato' };
  const c = a.caparra as unknown as Caparra | null;
  if (!c) return { ok: false, error: 'Su questo appuntamento non c\'è nessuna caparra' };
  if (!a.client?.phone) return { ok: false, error: 'La cliente non ha un numero di telefono' };
  if (!regole.linkPagamento && !c.link) return { ok: false, error: 'Manca il link di pagamento: si imposta in Impostazioni → Caparra' };

  const quando = new Date(`${a.date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const testo = testoRichiesta(regole, {
    nome: a.client.firstName || a.clientName.split(' ')[0],
    importo: c.richiesta,
    quando: `${quando} alle ${a.startTime}`,
    link: c.link || regole.linkPagamento,
    scadenzaOre: regole.oreValidita,
  });

  const esito = await sendWhatsApp(a.client.phone, testo, 'system');
  if (!esito.ok) return { ok: false, error: esito.error || 'WhatsApp non ha accettato il messaggio' };

  await prisma.appointment.update({
    where: { id: a.id },
    data: { caparra: { ...c, chiestaIl: new Date().toISOString() } as unknown as object },
  });
  return { ok: true };
}

/**
 * I soldi sono arrivati: lo segna chi sta al banco.
 *
 * La caparra entra in cassa il giorno in cui arriva, non il giorno del
 * trattamento: e' quello il giorno in cui i soldi ci sono davvero. Il giorno
 * della seduta si incassa solo il resto, e i conti tornano — venti piu'
 * cinquanta fa settanta, senza righe fantasma.
 *
 * Niente scontrino fiscale su questa riga: il documento si emette in cassa
 * quando la cliente paga il resto.
 */
export async function segnaCaparraPagata(appointmentId: string, dati: { metodo?: string; chi?: string } = {}): Promise<{ ok: boolean }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clientName: true, treatmentName: true, operatorName: true, caparra: true },
  });
  const c = (a?.caparra as unknown as Caparra | null);
  if (!a || !c) return { ok: false };

  const now = new Date();
  const riga = await prisma.posTransaction.create({
    data: {
      date: todayRome(),
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
      clientName: a.clientName,
      items: [`Caparra — ${a.treatmentName}`],
      total: c.richiesta,
      paymentMethod: dati.metodo === 'contanti' ? 'Contanti' : dati.metodo === 'carta' ? 'Carta' : 'Altro',
      operator: dati.chi || a.operatorName || 'Staff',
      isRefund: false,
    },
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      caparra: {
        ...c, stato: 'pagata', metodo: dati.metodo || 'link', txId: riga.id,
        pagataIl: new Date().toISOString(), segnataDa: dati.chi,
      } as unknown as object,
    },
  });
  return { ok: true };
}

/** Al check-out la caparra si scala: da qui in poi e' stata usata. */
export async function usaCaparra(appointmentId: string): Promise<{ ok: boolean }> {
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { caparra: true } });
  const c = a?.caparra as unknown as Caparra | null;
  if (!c || c.stato !== 'pagata') return { ok: false };
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { caparra: { ...c, stato: 'usata', nota: 'Scalata dal conto al check-out' } as unknown as object },
  });
  return { ok: true };
}

/**
 * La cliente non si e' presentata e la caparra si trattiene.
 *
 * Da qui diventa un incasso vero: nasce una riga in cassa, altrimenti quei
 * soldi resterebbero fuori da ogni conto — e a fine mese non tornerebbe
 * niente.
 */
export async function trattieniCaparra(appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clientName: true, treatmentName: true, operatorName: true, caparra: true },
  });
  const c = a?.caparra as unknown as Caparra | null;
  if (!a || !c) return { ok: false, error: 'Nessuna caparra su questo appuntamento' };
  if (c.stato !== 'pagata') return { ok: false, error: 'La caparra non risulta pagata' };

  /*
    In cassa i soldi ci sono gia': ci sono entrati il giorno in cui la caparra
    e' arrivata. Qui non si incassa niente di nuovo, si scrive solo che quei
    soldi restano al centro — la riga esiste, il trattamento no.
  */
  await prisma.appointment.update({
    where: { id: a.id },
    data: { caparra: { ...c, stato: 'trattenuta', nota: `Trattenuta il ${todayRome()}: la cliente non si è presentata` } as unknown as object },
  });
  return { ok: true };
}

/** La si restituisce (o si rinuncia a chiederla): resta scritto che e' successo. */
export async function restituisciCaparra(appointmentId: string, nota?: string): Promise<{ ok: boolean }> {
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { caparra: true } });
  const c = a?.caparra as unknown as Caparra | null;
  if (!c) return { ok: false };
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { caparra: { ...c, stato: 'restituita', nota: nota || 'Restituita alla cliente' } as unknown as object },
  });
  return { ok: true };
}

/** Chiede la caparra a mano su un appuntamento gia' in agenda. */
export async function chiediCaparraAMano(appointmentId: string, importo: number): Promise<{ ok: boolean; error?: string }> {
  const regole = await regoleCaparra();
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { price: true, caparra: true } });
  if (!a) return { ok: false, error: 'Appuntamento non trovato' };
  const somma = Math.min(Math.max(0, Math.round(importo * 100) / 100), a.price || importo);
  if (somma <= 0) return { ok: false, error: 'Importo non valido' };
  const caparra: Caparra = {
    richiesta: somma,
    stato: 'attesa',
    link: regole.linkPagamento || undefined,
    chiestaIl: new Date().toISOString(),
    scadenza: new Date(Date.now() + regole.oreValidita * 3600_000).toISOString(),
  };
  await prisma.appointment.update({ where: { id: appointmentId }, data: { caparra: caparra as unknown as object } });
  return { ok: true };
}

/** Quelle in attesa: si guardano una volta al giorno, come le cose sospese. */
export interface CaparraInAttesa {
  appointmentId: string;
  cliente: string;
  quando: string;
  trattamento: string;
  importo: number;
  scaduta: boolean;
  chiestaIl?: string;
}

export async function caparreInAttesa(): Promise<CaparraInAttesa[]> {
  const righe = await prisma.appointment.findMany({
    where: { caparra: { not: Prisma.DbNull }, status: { notIn: ['cancelled', 'no_show', 'completed'] } },
    select: { id: true, clientName: true, date: true, startTime: true, treatmentName: true, caparra: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: 100,
  });
  const adesso = Date.now();
  return righe
    .map(r => ({ r, c: r.caparra as unknown as Caparra }))
    .filter(x => x.c && x.c.stato === 'attesa')
    .map(({ r, c }) => ({
      appointmentId: r.id,
      cliente: r.clientName,
      quando: `${r.date} ${r.startTime}`,
      trattamento: r.treatmentName,
      importo: c.richiesta,
      chiestaIl: c.chiestaIl,
      scaduta: !!c.scadenza && Date.parse(c.scadenza) < adesso,
    }));
}
