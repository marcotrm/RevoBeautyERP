'use server';

/**
 * I documenti d'identita' delle clienti.
 *
 * Servono per il numero sul consenso, e prima si copiavano a mano: adesso la
 * cliente fotografa il documento, il gestionale legge i dati e la foto resta
 * allegata — cosi' chi riapre il consenso vede da dove esce quel numero,
 * invece di doversi fidare di una trascrizione.
 *
 * Sono dati sensibili e stanno solo qui dentro: si vedono dalla scheda della
 * cliente e dalla sezione Documenti, e si cancellano quando non servono piu'.
 */

import { prisma } from '@/lib/prisma';
import { leggiDocumento, nomeTipo, type LetturaDocumento } from '@/lib/documento';

export interface DocumentoSalvato {
  id: string;
  clientId: string;
  clientName: string;
  tipo: string;
  tipoLeggibile: string;
  numero: string;
  nome: string | null;
  cognome: string | null;
  dataNascita: string | null;
  scadenza: string | null;
  /** Vuota nell'elenco: la foto intera si chiede quando serve davvero. */
  foto: string;
  /** La miniatura, quella che si vede nella griglia. */
  anteprima: string;
  origine: string;
  createdAt: string;
  /** Vero se la data di scadenza e' passata. */
  scaduto: boolean;
}

function vesti(d: {
  id: string; clientId: string; tipo: string; numero: string; nome: string | null;
  cognome: string | null; dataNascita: string | null; scadenza: string | null;
  foto?: string; anteprima?: string | null; origine: string; createdAt: string;
  client?: { firstName: string; lastName: string } | null;
}): DocumentoSalvato {
  const oggi = new Date().toISOString().slice(0, 10);
  return {
    ...d,
    foto: d.foto || '',
    // I documenti caricati prima che esistesse la miniatura non ce l'hanno:
    // li' si ripiega sulla foto intera, che c'e' sempre.
    anteprima: d.anteprima || d.foto || '',
    clientName: d.client ? `${d.client.firstName} ${d.client.lastName}`.trim() : '',
    tipoLeggibile: nomeTipo(d.tipo),
    scaduto: !!d.scadenza && d.scadenza < oggi,
  };
}

/** Legge una foto appena scattata. Non salva niente: prima si conferma. */
export async function leggiFotoDocumento(dataUrl: string): Promise<LetturaDocumento> {
  return leggiDocumento(dataUrl);
}

export async function salvaDocumento(dati: {
  clientId: string;
  tipo?: string;
  numero: string;
  nome?: string;
  cognome?: string;
  dataNascita?: string;
  scadenza?: string;
  foto: string;
  anteprima?: string;
  consensoId?: string;
  origine?: 'cliente' | 'operatrice';
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!dati.clientId || !dati.foto) return { ok: false, error: 'Manca la foto o la cliente' };
  const numero = (dati.numero || '').trim();
  if (!numero) return { ok: false, error: 'Manca il numero del documento' };

  const creato = await prisma.clientDocument.create({
    data: {
      clientId: dati.clientId,
      tipo: dati.tipo || 'altro',
      numero,
      nome: dati.nome?.trim() || null,
      cognome: dati.cognome?.trim() || null,
      dataNascita: dati.dataNascita || null,
      scadenza: dati.scadenza || null,
      foto: dati.foto,
      anteprima: dati.anteprima || null,
      consensoId: dati.consensoId || null,
      origine: dati.origine || 'cliente',
      createdAt: new Date().toISOString(),
    },
  });

  /*
    La data di nascita dal documento e' la piu' affidabile che ci sia: se in
    scheda manca, la si prende da qui. Se c'e' gia' non si tocca — magari
    l'ha corretta qualcuno che sapeva quello che faceva.
  */
  if (dati.dataNascita) {
    await prisma.client.updateMany({
      where: { id: dati.clientId, OR: [{ birthDate: null }, { birthDate: '' }] },
      data: { birthDate: dati.dataNascita },
    }).catch(() => {});
  }

  return { ok: true, id: creato.id };
}

/** Il documento piu' recente di una cliente: quello che vale. */
export async function documentoDi(clientId: string): Promise<DocumentoSalvato | null> {
  const d = await prisma.clientDocument.findFirst({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { firstName: true, lastName: true } } },
  });
  return d ? vesti(d) : null;
}

/**
 * Tutti i documenti, dal piu' recente. Si cerca per nome o per numero.
 *
 * Qui viaggiano solo le miniature: con le foto intere, una pagina da cento
 * documenti sarebbero quaranta megabyte da scaricare per guardare un elenco.
 * La foto vera si chiede con `fotoDocumento` quando si apre quella riga.
 */
export async function elencoDocumenti(cerca = ''): Promise<DocumentoSalvato[]> {
  const q = cerca.trim();
  const righe = await prisma.clientDocument.findMany({
    where: q
      ? {
        OR: [
          { numero: { contains: q, mode: 'insensitive' } },
          { nome: { contains: q, mode: 'insensitive' } },
          { cognome: { contains: q, mode: 'insensitive' } },
          { client: { firstName: { contains: q, mode: 'insensitive' } } },
          { client: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true, clientId: true, tipo: true, numero: true, nome: true, cognome: true,
      dataNascita: true, scadenza: true, anteprima: true, origine: true, createdAt: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
  return righe.map(vesti);
}

/** La foto intera di un documento: si chiede solo quando si apre. */
export async function fotoDocumento(id: string): Promise<string | null> {
  const d = await prisma.clientDocument.findUnique({ where: { id }, select: { foto: true } });
  return d?.foto || null;
}

export async function eliminaDocumento(id: string): Promise<{ ok: boolean }> {
  await prisma.clientDocument.delete({ where: { id } });
  return { ok: true };
}

export interface RiepilogoDocumenti {
  totale: number;
  clientiConDocumento: number;
  scaduti: number;
}

export async function riepilogoDocumenti(): Promise<RiepilogoDocumenti> {
  const righe = await prisma.clientDocument.findMany({ select: { clientId: true, scadenza: true } });
  const oggi = new Date().toISOString().slice(0, 10);
  return {
    totale: righe.length,
    clientiConDocumento: new Set(righe.map(r => r.clientId)).size,
    scaduti: righe.filter(r => !!r.scadenza && r.scadenza < oggi).length,
  };
}
