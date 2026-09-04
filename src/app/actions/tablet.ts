'use server';

/**
 * Il tablet della firma.
 *
 * Il modulo del consenso c'era gia' e funzionava in due modi: aperto qui sul
 * computer, oppure mandato su WhatsApp. Manca il terzo, che e' quello di tutti
 * i giorni: la cliente e' in centro, davanti al banco, e le si passa un
 * tablet.
 *
 * Il tablet NON entra nel gestionale. Sta su una pagina sola, che aspetta:
 * quando dal gestionale si preme «manda al tablet», il modulo compare li'. La
 * cliente firma, il tablet torna ad aspettare. Se qualcuno lo prende in mano
 * non trova niente da guardare — nessuna agenda, nessuna anagrafica, nessun
 * incasso. E' la stessa ragione per cui il POS ha un tastierino e non un
 * computer.
 *
 * Il collegamento e' una chiave nel link, non un account: sul tablet non c'e'
 * niente da ricordare e niente da digitare. La chiave si rigenera quando
 * serve — se il tablet si perde, il link vecchio smette di funzionare.
 */

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { linkConsensoCliente } from '@/app/actions/consensoLaser';

const RIGA_CHIAVE = 'integration:tablet';
const RIGA_CODA = 'tablet:coda';

/** Quanto resta valido un modulo mandato al tablet e mai firmato. */
const SCADENZA_MS = 15 * 60_000;

/** Sotto i due minuti dall'ultimo contatto il tablet si considera acceso. */
const VIVO_MS = 2 * 60_000;

interface DatiTablet {
  chiave: string;
  creata: string;
  ultimoContatto?: string;
}

export async function chiaveTablet(): Promise<string | null> {
  try {
    const r = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_CHIAVE } });
    return (r?.data as DatiTablet | null)?.chiave || null;
  } catch {
    return null;
  }
}

/**
 * Crea (o rifa') la chiave del tablet.
 *
 * Rifarla stacca subito il tablet vecchio: e' quello che si vuole quando un
 * tablet sparisce, ed e' il motivo per cui il tasto si chiama «rigenera» e
 * avvisa prima.
 */
export async function generaChiaveTablet(): Promise<{ chiave: string }> {
  const chiave = randomBytes(9).toString('base64url');
  const dati: DatiTablet = { chiave, creata: new Date().toISOString() };
  await prisma.adminEntry.upsert({
    where: { rowId: RIGA_CHIAVE },
    update: { data: dati as unknown as object },
    create: {
      rowId: RIGA_CHIAVE, kind: 'integration', entityId: 'tablet',
      data: dati as unknown as object, createdAt: new Date().toISOString(),
    },
  });
  // Un tablet nuovo non eredita la coda del vecchio.
  await prisma.adminEntry.deleteMany({ where: { rowId: RIGA_CODA } });
  return { chiave };
}

export interface StatoTablet {
  collegato: boolean;
  chiave: string | null;
  ultimoContatto: string | null;
  /** Cosa sta aspettando di essere firmato, se c'e' qualcosa. */
  inAttesa: { cliente: string; quando: string } | null;
}

export async function statoTablet(): Promise<StatoTablet> {
  const [riga, coda] = await Promise.all([
    prisma.adminEntry.findUnique({ where: { rowId: RIGA_CHIAVE } }),
    prisma.adminEntry.findUnique({ where: { rowId: RIGA_CODA } }),
  ]);
  const d = (riga?.data as DatiTablet | null) || null;
  const c = (coda?.data as { cliente?: string; quando?: string; url?: string } | null) || null;
  const contatto = d?.ultimoContatto ? Date.parse(d.ultimoContatto) : 0;
  return {
    chiave: d?.chiave || null,
    collegato: !!contatto && Date.now() - contatto < VIVO_MS,
    ultimoContatto: d?.ultimoContatto || null,
    inAttesa: c?.url && c.quando && Date.now() - Date.parse(c.quando) < SCADENZA_MS
      ? { cliente: c.cliente || 'Cliente', quando: c.quando }
      : null,
  };
}

/**
 * Manda il modulo del consenso al tablet.
 *
 * Il link e' lo stesso che si manderebbe su WhatsApp: stesso modulo, stessa
 * firma, stesso posto dove finisce. Cambia solo la strada per arrivarci.
 */
export async function mandaAlTablet(clientId: string, nomeCliente?: string): Promise<{ ok: boolean; errore?: string }> {
  const chiave = await chiaveTablet();
  if (!chiave) return { ok: false, errore: 'Il tablet non è ancora collegato: si imposta in Impostazioni → Tablet della firma.' };

  const link = await linkConsensoCliente(clientId);
  if (!link.ok || !link.url) return { ok: false, errore: link.errore || 'Non sono riuscito a preparare il modulo.' };

  /*
    Il nome serve alla schermata del tablet: «sto aprendo il modulo di Maria»
    e' quello che fa capire alla cliente che il tablet e' per lei. Se chi
    chiama non l'ha passato, si va a prenderlo qui invece di scrivere
    «Cliente».
  */
  const nome = nomeCliente || await prisma.client
    .findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
    .then(c => (c ? `${c.firstName} ${c.lastName}`.trim() : ''))
    .catch(() => '');

  const url = new URL(link.url);
  // Da dove tornare quando ha finito: il tablet deve rimettersi ad aspettare
  // da solo, senza che nessuno lo tocchi.
  url.searchParams.set('tablet', chiave);

  await prisma.adminEntry.upsert({
    where: { rowId: RIGA_CODA },
    update: { data: { url: url.toString(), cliente: nome, quando: new Date().toISOString() } },
    create: {
      rowId: RIGA_CODA, kind: 'tablet', entityId: 'coda',
      data: { url: url.toString(), cliente: nome, quando: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

export interface CodaTablet {
  /** Il modulo da aprire, se ce n'e' uno. */
  url: string | null;
  cliente: string | null;
}

/**
 * Cosa deve fare il tablet adesso. Lo chiede lui, ogni due secondi.
 *
 * La stessa chiamata dice anche «sono acceso»: cosi' dal gestionale si vede
 * se il tablet e' collegato senza doverglielo chiedere.
 */
export async function codaTablet(chiave: string): Promise<CodaTablet> {
  const riga = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_CHIAVE } });
  const d = (riga?.data as DatiTablet | null) || null;
  if (!d?.chiave || d.chiave !== chiave) return { url: null, cliente: null };

  /*
    Il battito, e si aspetta che sia scritto davvero.

    Lasciarlo andare senza aspettare sembrava un'ottimizzazione da niente, ma
    la scrittura si perdeva: il gestionale continuava a dire «nessun tablet»
    con il tablet acceso davanti, e da li' il tasto «manda al tablet» non
    sarebbe mai comparso.
  */
  await prisma.adminEntry.update({
    where: { rowId: RIGA_CHIAVE },
    data: { data: { ...d, ultimoContatto: new Date().toISOString() } as unknown as object },
  }).catch(() => {});

  const coda = await prisma.adminEntry.findUnique({ where: { rowId: RIGA_CODA } });
  const c = (coda?.data as { url?: string; cliente?: string; quando?: string } | null) || null;
  if (!c?.url || !c.quando || Date.now() - Date.parse(c.quando) > SCADENZA_MS) {
    return { url: null, cliente: null };
  }
  return { url: c.url, cliente: c.cliente || null };
}

/** Il modulo e' stato aperto (o annullato): il tablet torna libero. */
export async function liberaTablet(): Promise<{ ok: boolean }> {
  await prisma.adminEntry.deleteMany({ where: { rowId: RIGA_CODA } });
  return { ok: true };
}
