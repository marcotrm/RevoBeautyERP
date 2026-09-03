'use server';

/**
 * Gli abbonamenti: l'unica voce che rende prevedibile il fatturato.
 *
 * Il pacchetto a sedute finisce, e quando finisce si ricomincia da capo a
 * convincere. L'abbonamento no: si rinnova ogni mese finche' qualcuno lo
 * ferma, e a inizio mese si sa gia' quanto entrera'. E' la differenza fra un
 * centro che vive di quello che passa dalla porta e uno che ha una base.
 *
 * Il rinnovo NON e' un addebito automatico: nessuna carta e' salvata qui. Il
 * gestionale dice chi scade, manda il promemoria e registra l'incasso quando
 * i soldi arrivano — al banco o sul link del centro. Meno magia, ma anche
 * nessuna sorpresa sul conto di nessuno.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { inviaEmail } from '@/app/actions/canali';
import { sendTelegram } from '@/lib/telegram';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface IncassoAbbonamento {
  data: string;
  importo: number;
  metodo: string;
  txId?: string;
  operatore?: string;
}

export interface Abbonamento {
  id: string;
  clientId: string | null;
  clientName: string;
  nome: string;
  prezzoMensile: number;
  seduteAlMese: number;
  seduteUsate: number;
  categorie: string[];
  trattamenti: string[];
  inizio: string;
  prossimoRinnovo: string;
  stato: 'attivo' | 'sospeso' | 'chiuso';
  incassi: IncassoAbbonamento[];
  note: string | null;
  /** Giorni al rinnovo: negativo = in ritardo. */
  giorniAlRinnovo: number;
  /** Quanto ha portato da quando esiste. */
  incassatoTotale: number;
  /** Da quanti mesi va avanti: e' il numero che dice se il centro tiene. */
  mesiAttivo: number;
}

function giorniDa(data: string): number {
  const t = Date.parse(`${data}T12:00:00`);
  const oggi = Date.parse(`${todayRome()}T12:00:00`);
  if (Number.isNaN(t)) return 0;
  return Math.round((t - oggi) / 86_400_000);
}

/** Il mese dopo, tenendo il giorno: il 31 gennaio rinnova il 28 febbraio. */
export async function traUnMese(data: string): Promise<string> {
  return mesiDopo(data, 1);
}

function mesiDopo(data: string, quanti: number): string {
  const [a, m, g] = data.split('-').map(Number);
  const target = new Date(Date.UTC(a, m - 1 + quanti, 1));
  const ultimo = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(g, ultimo));
  return target.toISOString().slice(0, 10);
}

function vestiti(r: {
  id: string; clientId: string | null; clientName: string; nome: string;
  prezzoMensile: number; seduteAlMese: number; seduteUsate: number;
  categorie: string[]; trattamenti: string[]; inizio: string;
  prossimoRinnovo: string; stato: string; incassi: unknown; note: string | null;
}): Abbonamento {
  const incassi = Array.isArray(r.incassi) ? (r.incassi as IncassoAbbonamento[]) : [];
  const inizio = Date.parse(`${r.inizio}T12:00:00`);
  const mesi = Number.isNaN(inizio) ? 0 : Math.max(0, Math.floor((Date.now() - inizio) / (30 * 86_400_000)));
  return {
    ...r,
    stato: (r.stato as Abbonamento['stato']) || 'attivo',
    incassi,
    giorniAlRinnovo: giorniDa(r.prossimoRinnovo),
    incassatoTotale: round2(incassi.reduce((t, i) => t + (Number(i.importo) || 0), 0)),
    mesiAttivo: mesi,
  };
}

export async function elencoAbbonamenti(): Promise<Abbonamento[]> {
  const righe = await prisma.subscription.findMany({ orderBy: [{ stato: 'asc' }, { prossimoRinnovo: 'asc' }] });
  return righe.map(vestiti);
}

export interface RiepilogoAbbonamenti {
  attivi: number;
  /** Quanto entra ogni mese se non cambia niente. */
  mensileRicorrente: number;
  inScadenza: number;
  inRitardo: number;
  incassatoQuestoMese: number;
}

export async function riepilogoAbbonamenti(): Promise<RiepilogoAbbonamenti> {
  const tutti = await elencoAbbonamenti();
  const attivi = tutti.filter(a => a.stato === 'attivo');
  const mese = todayRome().slice(0, 7);
  return {
    attivi: attivi.length,
    mensileRicorrente: round2(attivi.reduce((t, a) => t + a.prezzoMensile, 0)),
    inScadenza: attivi.filter(a => a.giorniAlRinnovo >= 0 && a.giorniAlRinnovo <= 7).length,
    inRitardo: attivi.filter(a => a.giorniAlRinnovo < 0).length,
    incassatoQuestoMese: round2(
      tutti.flatMap(a => a.incassi).filter(i => String(i.data || '').startsWith(mese)).reduce((t, i) => t + i.importo, 0),
    ),
  };
}

export async function creaAbbonamento(dati: {
  clientId?: string | null;
  clientName: string;
  nome: string;
  prezzoMensile: number;
  seduteAlMese?: number;
  categorie?: string[];
  trattamenti?: string[];
  inizio?: string;
  note?: string;
  /** Il primo mese e' gia' stato pagato adesso? Di solito si'. */
  incassaSubito?: boolean;
  metodo?: string;
  operatore?: string;
}): Promise<Abbonamento> {
  const inizio = dati.inizio || todayRome();
  const adesso = new Date().toISOString();
  const prezzo = Math.max(0, round2(dati.prezzoMensile));

  const incassi: IncassoAbbonamento[] = [];
  if (dati.incassaSubito !== false && prezzo > 0) {
    const riga = await registraIncasso({
      clientName: dati.clientName, nome: dati.nome, importo: prezzo,
      metodo: dati.metodo || 'Carta', operatore: dati.operatore,
    });
    incassi.push({ data: todayRome(), importo: prezzo, metodo: dati.metodo || 'Carta', txId: riga, operatore: dati.operatore });
  }

  const creato = await prisma.subscription.create({
    data: {
      clientId: dati.clientId || null,
      clientName: dati.clientName,
      nome: dati.nome,
      prezzoMensile: prezzo,
      seduteAlMese: Math.max(0, Math.floor(dati.seduteAlMese || 0)),
      categorie: dati.categorie || [],
      trattamenti: dati.trattamenti || [],
      inizio,
      // Se il primo mese e' pagato adesso, il prossimo e' fra un mese.
      prossimoRinnovo: incassi.length > 0 ? mesiDopo(inizio, 1) : inizio,
      stato: 'attivo',
      incassi: incassi as unknown as object,
      note: dati.note || null,
      createdAt: adesso,
      updatedAt: adesso,
    },
  });
  return vestiti(creato);
}

/** La riga in cassa del rinnovo: senza, quei soldi non esistono da nessuna parte. */
async function registraIncasso(p: {
  clientName: string; nome: string; importo: number; metodo: string; operatore?: string;
}): Promise<string> {
  const now = new Date();
  const riga = await prisma.posTransaction.create({
    data: {
      date: todayRome(),
      time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
      clientName: p.clientName,
      items: [`Abbonamento — ${p.nome}`],
      total: p.importo,
      paymentMethod: p.metodo,
      operator: p.operatore || 'Staff',
      isRefund: false,
    },
  });
  return riga.id;
}

/**
 * Il rinnovo e' stato pagato: si registra e si sposta la scadenza di un mese.
 *
 * La data nuova parte da quella vecchia, non da oggi: chi paga con tre giorni
 * di ritardo non guadagna tre giorni gratis, e chi paga in anticipo non li
 * perde.
 */
export async function incassaRinnovo(id: string, dati: { metodo?: string; operatore?: string; importo?: number } = {}): Promise<{ ok: boolean; error?: string }> {
  const a = await prisma.subscription.findUnique({ where: { id } });
  if (!a) return { ok: false, error: 'Abbonamento non trovato' };
  if (a.stato === 'chiuso') return { ok: false, error: 'Questo abbonamento è chiuso' };

  const importo = round2(dati.importo ?? a.prezzoMensile);
  const txId = importo > 0
    ? await registraIncasso({ clientName: a.clientName, nome: a.nome, importo, metodo: dati.metodo || 'Carta', operatore: dati.operatore })
    : undefined;

  const incassi = [
    ...(Array.isArray(a.incassi) ? (a.incassi as unknown as IncassoAbbonamento[]) : []),
    { data: todayRome(), importo, metodo: dati.metodo || 'Carta', txId, operatore: dati.operatore },
  ];

  await prisma.subscription.update({
    where: { id },
    data: {
      incassi: incassi as unknown as object,
      prossimoRinnovo: mesiDopo(a.prossimoRinnovo, 1),
      // Mese nuovo, sedute nuove.
      seduteUsate: 0,
      stato: 'attivo',
      updatedAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

export async function cambiaStatoAbbonamento(id: string, stato: 'attivo' | 'sospeso' | 'chiuso'): Promise<{ ok: boolean }> {
  await prisma.subscription.update({ where: { id }, data: { stato, updatedAt: new Date().toISOString() } });
  return { ok: true };
}

export async function segnaSedutaAbbonamento(id: string, quante = 1): Promise<{ ok: boolean }> {
  const a = await prisma.subscription.findUnique({ where: { id }, select: { seduteUsate: true } });
  if (!a) return { ok: false };
  await prisma.subscription.update({
    where: { id },
    data: { seduteUsate: Math.max(0, a.seduteUsate + quante), updatedAt: new Date().toISOString() },
  });
  return { ok: true };
}

export async function eliminaAbbonamento(id: string): Promise<{ ok: boolean }> {
  await prisma.subscription.delete({ where: { id } });
  return { ok: true };
}

/**
 * Il giro dei rinnovi: chi scade oggi o e' in ritardo.
 *
 * Manda l'email a chi ce l'ha (niente template da far approvare a nessuno) e
 * un riepilogo su Telegram al titolare — che e' poi la persona che deve
 * ricordarsi di chiedere i soldi.
 */
export async function giroRinnovi(dryRun = false): Promise<{ avvisate: number; daChiedere: number; righe: string[] }> {
  const tutti = await elencoAbbonamenti();
  const daFare = tutti.filter(a => a.stato === 'attivo' && a.giorniAlRinnovo <= 2);
  const righe: string[] = [];
  let avvisate = 0;

  for (const a of daFare) {
    const quando = a.giorniAlRinnovo < 0
      ? `scaduto da ${Math.abs(a.giorniAlRinnovo)} ${Math.abs(a.giorniAlRinnovo) === 1 ? 'giorno' : 'giorni'}`
      : a.giorniAlRinnovo === 0 ? 'scade oggi' : `scade fra ${a.giorniAlRinnovo} giorni`;
    righe.push(`${a.clientName} · ${a.nome} · ${a.prezzoMensile.toFixed(2).replace('.', ',')} € · ${quando}`);

    if (dryRun || !a.clientId) continue;
    const cliente = await prisma.client.findUnique({ where: { id: a.clientId }, select: { email: true, firstName: true } });
    if (!cliente?.email) continue;
    const r = await inviaEmail({
      a: cliente.email,
      oggetto: `Il tuo abbonamento ${a.nome} si rinnova`,
      testo: `Ciao ${cliente.firstName || a.clientName},\n`
        + `il tuo abbonamento "${a.nome}" (${a.prezzoMensile.toFixed(2).replace('.', ',')} € al mese) ${quando}.\n`
        + `Puoi rinnovarlo quando passi in centro, oppure scrivici e ti mandiamo il link.\n`
        + `Grazie di continuare a sceglierci!`,
    });
    if (r.ok) avvisate += 1;
  }

  if (!dryRun && righe.length > 0) {
    sendTelegram(
      `\u{1F4C5} <b>Abbonamenti da rinnovare</b>\n${righe.map(r => `• ${r}`).join('\n')}`,
    ).catch(() => {});
  }

  return { avvisate, daChiedere: daFare.length, righe };
}
