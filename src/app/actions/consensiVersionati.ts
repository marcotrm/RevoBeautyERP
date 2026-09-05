'use server';

/**
 * I consensi, con dentro la versione di quello che e' stato letto.
 *
 * Il gestionale ne aveva gia' due pezzi: il consenso laser firmato (con
 * documento e questionario) e i consensi dell'app, revocabili. Mancava la
 * cosa che li rende opponibili: sapere ESATTAMENTE quale testo la cliente
 * aveva davanti quando ha detto si'.
 *
 * Qui il testo sta in una riga sua, immutabile. Correggere una virgola vuol
 * dire pubblicare una versione nuova: chi ha firmato la vecchia resta legato
 * alla vecchia, e fra un anno la domanda «a cosa aveva acconsentito» ha una
 * risposta invece di un'ipotesi.
 *
 * Ogni scelta e' una riga in piu', mai una riscrittura: accettato, rifiutato,
 * revocato restano tutti, in ordine. Uno storico che si sovrascrive non e'
 * uno storico.
 */

import { prisma } from '@/lib/prisma';
import { TESTI_INIZIALI, VERSIONE_INIZIALE } from '@/lib/testiConsenso';

export interface DocumentoDaLeggere {
  id: string;
  tipo: string;
  versione: string;
  titolo: string;
  sommario: string | null;
  testo: string;
  firmaRichiesta: boolean;
  necessario: boolean;
  /** La scelta gia' data su QUESTA versione, se c'e'. */
  giaScelto?: 'accettato' | 'rifiutato' | null;
  quando?: string | null;
}

/** I testi di partenza, messi in archivio la prima volta. Idempotente. */
async function semina(): Promise<void> {
  const quanti = await prisma.documentoConsenso.count();
  if (quanti > 0) return;
  const ora = new Date().toISOString();
  await prisma.documentoConsenso.createMany({
    data: TESTI_INIZIALI.map(t => ({
      tipo: t.tipo,
      versione: VERSIONE_INIZIALE,
      titolo: t.titolo,
      testo: t.testo,
      sommario: t.sommario,
      firmaRichiesta: t.firmaRichiesta,
      necessario: t.necessario,
      attivo: true,
      creatoDa: 'sistema',
      createdAt: ora,
    })),
    skipDuplicates: true,
  });
}

/** Le versioni in vigore, una per tipo. */
export async function documentiAttivi(): Promise<DocumentoDaLeggere[]> {
  await semina();
  const righe = await prisma.documentoConsenso.findMany({
    where: { attivo: true },
    orderBy: [{ necessario: 'desc' }, { tipo: 'asc' }],
  });
  return righe.map(d => ({
    id: d.id, tipo: d.tipo, versione: d.versione, titolo: d.titolo,
    sommario: d.sommario, testo: d.testo,
    firmaRichiesta: d.firmaRichiesta, necessario: d.necessario,
  }));
}

/**
 * Cosa manca a questa cliente, e cosa ha gia' detto.
 *
 * «Gia' scelto» vale sulla VERSIONE, non sul tipo: se il centro pubblica un
 * testo nuovo, quel consenso torna da chiedere — ed e' giusto cosi', perche'
 * quello che ha accettato l'anno scorso era un altro testo.
 */
export async function consensiDaChiedere(clientId: string): Promise<DocumentoDaLeggere[]> {
  const attivi = await documentiAttivi();
  if (!clientId) return attivi;

  const scelte = await prisma.consensoFirmato.findMany({
    where: { clientId, revocatoIl: null },
    orderBy: { quando: 'desc' },
  });

  return attivi.map(d => {
    const sua = scelte.find(x => x.documentoId === d.id);
    return {
      ...d,
      giaScelto: sua ? (sua.scelta as 'accettato' | 'rifiutato') : null,
      quando: sua?.quando ?? null,
    };
  });
}

/** Un codice corto da leggere ad alta voce: niente 0/O, niente 1/I. */
function codiceRicevuta(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 8; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export interface EsitoScelta {
  ok: boolean;
  errore?: string;
  ricevuta?: string;
}

/**
 * La cliente sceglie, e la scelta resta.
 *
 * Non si aggiorna niente: si scrive una riga nuova. La firma si accetta solo
 * se il documento la richiede, e se la richiede senza firma non si salva —
 * un consenso «firmato» senza firma e' un questionario compilato.
 */
export async function registraScelta(dati: {
  clientId: string;
  documentoId: string;
  scelta: 'accettato' | 'rifiutato';
  firma?: string;
  modalita: 'tablet' | 'whatsapp' | 'banco' | 'app';
  operatrice?: string;
}): Promise<EsitoScelta> {
  if (!dati.clientId) return { ok: false, errore: 'Manca la cliente.' };

  const doc = await prisma.documentoConsenso.findUnique({ where: { id: dati.documentoId } });
  if (!doc) return { ok: false, errore: 'Questo documento non esiste più.' };
  if (!doc.attivo) return { ok: false, errore: 'Di questo documento c\'è una versione più recente.' };

  if (doc.firmaRichiesta && dati.scelta === 'accettato' && (dati.firma || '').length < 100) {
    return { ok: false, errore: 'Per questo consenso serve la firma.' };
  }

  const ora = new Date().toISOString();
  const riga = await prisma.consensoFirmato.create({
    data: {
      clientId: dati.clientId,
      documentoId: doc.id,
      tipo: doc.tipo,
      versione: doc.versione,
      scelta: dati.scelta,
      firma: dati.scelta === 'accettato' ? (dati.firma || null) : null,
      modalita: dati.modalita,
      operatrice: dati.operatrice || null,
      quando: ora,
      ricevuta: codiceRicevuta(),
      createdAt: ora,
    },
  });

  /*
    Il consenso marketing vive anche in anagrafica, perche' e' li' che lo
    guardano le campagne. Si tiene allineato, ma la verita' resta questa riga:
    l'anagrafica dice «si'», qui c'e' scritto a quale testo e in che giorno.
  */
  if (doc.tipo === 'marketing') {
    await prisma.client.update({
      where: { id: dati.clientId },
      data: { marketingConsent: dati.scelta === 'accettato' },
    }).catch(() => {});
  }

  return { ok: true, ricevuta: riga.ricevuta };
}

/**
 * La revoca: non cancella niente, aggiunge.
 *
 * La riga vecchia resta e si segna revocata; ne nasce una nuova che dice
 * quando e da chi. Cancellare vorrebbe dire non poter piu' dimostrare che
 * quel consenso c'era stato — e a volte e' proprio quello che serve provare.
 */
export async function revocaConsenso(id: string, chi?: string): Promise<{ ok: boolean; errore?: string }> {
  const riga = await prisma.consensoFirmato.findUnique({ where: { id } });
  if (!riga) return { ok: false, errore: 'Non trovato.' };
  if (riga.revocatoIl) return { ok: true };

  const ora = new Date().toISOString();
  await prisma.consensoFirmato.update({
    where: { id },
    data: { revocatoIl: ora, revocatoDa: chi || null },
  });
  await prisma.consensoFirmato.create({
    data: {
      clientId: riga.clientId,
      documentoId: riga.documentoId,
      tipo: riga.tipo,
      versione: riga.versione,
      scelta: 'revocato',
      modalita: 'banco',
      operatrice: chi || null,
      quando: ora,
      ricevuta: codiceRicevuta(),
      createdAt: ora,
    },
  });

  if (riga.tipo === 'marketing') {
    await prisma.client.update({
      where: { id: riga.clientId },
      data: { marketingConsent: false },
    }).catch(() => {});
  }
  return { ok: true };
}

export interface RigaStorico {
  id: string;
  tipo: string;
  titolo: string;
  versione: string;
  scelta: string;
  quando: string;
  modalita: string;
  operatrice: string | null;
  ricevuta: string;
  revocatoIl: string | null;
  conFirma: boolean;
}

/** Tutto quello che questa cliente ha scelto, dall'inizio. */
export async function storicoConsensi(clientId: string): Promise<RigaStorico[]> {
  if (!clientId) return [];
  const righe = await prisma.consensoFirmato.findMany({
    where: { clientId },
    orderBy: { quando: 'desc' },
    include: { documento: { select: { titolo: true } } },
  });
  return righe.map(r => ({
    id: r.id,
    tipo: r.tipo,
    titolo: r.documento?.titolo || r.tipo,
    versione: r.versione,
    scelta: r.scelta,
    quando: r.quando,
    modalita: r.modalita,
    operatrice: r.operatrice,
    ricevuta: r.ricevuta,
    revocatoIl: r.revocatoIl,
    // La firma non esce: si dice solo che c'e'.
    conFirma: Boolean(r.firma),
  }));
}

export interface Ricevuta {
  ricevuta: string;
  cliente: string;
  titolo: string;
  versione: string;
  testo: string;
  scelta: string;
  quando: string;
  modalita: string;
  operatrice: string | null;
  revocatoIl: string | null;
}

/**
 * La ricevuta: cosa ha accettato, parola per parola.
 *
 * Si apre col codice, che e' quello scritto sulla conferma. Contiene il testo
 * della VERSIONE firmata — non quello in vigore oggi — perche' e' l'unica
 * versione che riguarda quella persona.
 */
export async function ricevutaConsenso(codice: string): Promise<Ricevuta | null> {
  const pulito = codice.trim().toUpperCase();
  if (!pulito) return null;
  const r = await prisma.consensoFirmato.findUnique({
    where: { ricevuta: pulito },
    include: { documento: true },
  });
  if (!r) return null;
  const c = await prisma.client.findUnique({
    where: { id: r.clientId },
    select: { firstName: true, lastName: true },
  });
  return {
    ricevuta: r.ricevuta,
    cliente: c ? `${c.firstName} ${c.lastName}`.trim() : 'Cliente',
    titolo: r.documento.titolo,
    versione: r.versione,
    testo: r.documento.testo,
    scelta: r.scelta,
    quando: r.quando,
    modalita: r.modalita,
    operatrice: r.operatrice,
    revocatoIl: r.revocatoIl,
  };
}

/**
 * Una versione nuova di un testo.
 *
 * Non modifica quella vecchia: la spegne e ne pubblica una accanto. Da quel
 * momento il consenso torna da chiedere a tutte — ed e' il comportamento
 * giusto, perche' quello che avevano accettato era un altro testo.
 */
export async function pubblicaVersione(dati: {
  tipo: string;
  titolo: string;
  testo: string;
  sommario?: string;
  firmaRichiesta: boolean;
  necessario: boolean;
  creatoDa: string;
}): Promise<{ ok: boolean; errore?: string; versione?: string }> {
  const testo = dati.testo.trim();
  if (testo.length < 50) return { ok: false, errore: 'Il testo è troppo corto per essere un consenso.' };

  // La versione e' la data: se se ne pubblicano due lo stesso giorno, la
  // seconda prende un progressivo, cosi' restano distinguibili.
  const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const stesseOggi = await prisma.documentoConsenso.count({
    where: { tipo: dati.tipo, versione: { startsWith: oggi } },
  });
  const versione = stesseOggi === 0 ? oggi : `${oggi}.${stesseOggi + 1}`;

  await prisma.documentoConsenso.updateMany({
    where: { tipo: dati.tipo, attivo: true },
    data: { attivo: false },
  });
  await prisma.documentoConsenso.create({
    data: {
      tipo: dati.tipo,
      versione,
      titolo: dati.titolo.trim(),
      testo,
      sommario: dati.sommario?.trim() || null,
      firmaRichiesta: dati.firmaRichiesta,
      // Il marketing non e' MAI necessario per ricevere il servizio: non e'
      // una scelta di configurazione, e' il punto del consenso.
      necessario: dati.tipo === 'marketing' ? false : dati.necessario,
      attivo: true,
      creatoDa: dati.creatoDa,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true, versione };
}
