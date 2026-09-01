'use server';

/**
 * Il consenso laser firmato dal tablet.
 *
 * La firma su carta resta valida e nessuno butta i fogli vecchi: quello che
 * cambia e' che da oggi il modulo si compila e si firma su uno schermo, e
 * finisce dove si cerca — nella scheda della cliente, insieme alle foto e agli
 * altri consensi.
 *
 * Il link porta un gettone firmato, non l'id dell'appuntamento in chiaro: un
 * indirizzo che si indovina cambiando un numero e' un indirizzo che qualcuno
 * prima o poi cambia. Il gettone dura tre giorni, cioe' abbastanza per
 * mandarlo il giorno prima e non abbastanza per restare in giro un mese.
 */

import { prisma } from '@/lib/prisma';
import { firmaConferma, leggiConferma } from '@/lib/conferma';
import { seduraDaRadere } from '@/lib/epilazione';
import { sendManualReply } from '@/app/actions/whatsapp';

const TITOLO = 'Consenso Laser/Epilazione';
const GIORNI_GETTONE = 3;

interface Gettone { appointmentId: string; clientId: string }

export interface ModuloLaser {
  ok: boolean;
  errore?: string;
  clientId?: string;
  nome?: string;
  nato?: string | null;
  quando?: string;
  zone?: string;
  operatrice?: string;
  /** Un consenso gia' firmato per questa cliente, se c'e'. */
  giaFirmato?: { quando: string; id: string } | null;
}

/** Il link da aprire sul tablet o da mandare in chat. */
export async function linkConsensoLaser(appointmentId: string): Promise<{ ok: boolean; url?: string; errore?: string }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clientId: true },
  });
  if (!a) return { ok: false, errore: 'Appuntamento non trovato' };
  const gettone = firmaConferma({ appointmentId: a.id, clientId: a.clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  return { ok: true, url: `${base}/firma/${encodeURIComponent(gettone)}` };
}

/** Quello che la pagina della firma deve mostrare. */
export async function apriModuloLaser(gettone: string): Promise<ModuloLaser> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.appointmentId) {
    return { ok: false, errore: 'Il link non è più valido. Chiedine uno nuovo al centro.' };
  }
  const a = await prisma.appointment.findUnique({
    where: { id: dati.appointmentId },
    include: { client: true },
  });
  if (!a) return { ok: false, errore: 'Appuntamento non trovato' };

  const zone = (() => {
    const sv = Array.isArray(a.services) ? (a.services as Array<{ treatmentName?: unknown }>) : [];
    const nomi = sv.map(s => String(s?.treatmentName || '')).filter(n => /^\s*epilazion/i.test(n));
    if (nomi.length > 0) return nomi.join(', ');
    return String(a.treatmentName || '');
  })();

  const ultimo = await prisma.clientConsent.findFirst({
    where: { clientId: a.clientId, title: TITOLO },
    orderBy: { signedAt: 'desc' },
    select: { id: true, signedAt: true },
  });

  return {
    ok: true,
    clientId: a.clientId,
    nome: a.client ? `${a.client.firstName} ${a.client.lastName}`.trim() : a.clientName,
    nato: a.client?.birthDate ?? null,
    quando: `${a.date.split('-').reverse().join('/')} alle ${a.startTime}`,
    zone,
    operatrice: a.operatorName,
    giaFirmato: ultimo ? { id: ultimo.id, quando: ultimo.signedAt } : null,
  };
}

export interface RisposteLaser {
  storico: Record<string, string>;
  zone: string;
  consensoFoto: boolean;
  firma: string;
}

/**
 * Salva il consenso. La firma e' obbligatoria: senza, quello che resta e' un
 * questionario compilato, non un consenso.
 */
export async function salvaConsensoLaser(
  gettone: string, r: RisposteLaser,
): Promise<{ ok: boolean; errore?: string }> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.clientId) return { ok: false, errore: 'Il link non è più valido.' };
  if (!r.firma || r.firma.length < 100) return { ok: false, errore: 'Manca la firma.' };

  const a = await prisma.appointment.findUnique({
    where: { id: dati.appointmentId },
    select: { id: true, date: true, startTime: true, operatorName: true, treatmentName: true, services: true },
  });

  await prisma.clientConsent.create({
    data: {
      clientId: dati.clientId,
      title: TITOLO,
      signatureData: r.firma,
      signedAt: new Date().toISOString(),
      notes: `Firmato dal tablet · zone: ${r.zone || '—'}`,
      data: JSON.parse(JSON.stringify({
        appointmentId: dati.appointmentId,
        seduta: a ? `${a.date} ${a.startTime}` : null,
        operatrice: a?.operatorName ?? null,
        eraLaser: a ? seduraDaRadere(a) : null,
        zone: r.zone,
        storico: r.storico,
        consensoFoto: r.consensoFoto,
        versioneTesto: '2026-09-01',
      })),
    },
  });
  return { ok: true };
}

/** Il consenso piu' recente di una cliente: serve al banco per sapere se c'e'. */
export async function consensoLaserDi(clientId: string): Promise<{ quando: string; zone?: string } | null> {
  if (!clientId) return null;
  const c = await prisma.clientConsent.findFirst({
    where: { clientId, title: TITOLO },
    orderBy: { signedAt: 'desc' },
    select: { signedAt: true, data: true },
  });
  if (!c) return null;
  const d = (c.data || {}) as { zone?: string };
  return { quando: c.signedAt, zone: d.zone };
}

// ============================================================
// La conferma al banco: "il foglio l'ha firmato".
//
// Resta accanto al modulo digitale e non ci si sovrappone. Il modulo e' la
// firma vera, questa e' la spunta di chi al check-in dice che la carta e'
// in archivio — serve finche' esistono fogli firmati prima di oggi, e per
// quella cliente che il tablet non lo vuole toccare.
// ============================================================

const KIND = 'consenso_laser';
const rowId = (clientId: string) => `${KIND}:${clientId}`;

export interface FirmaLaser {
  /** Quando e' stata confermata la firma (ISO). */
  data: string;
  /** Chi era al banco. */
  operatore?: string;
  appointmentId?: string;
}

/** L'ultima conferma registrata per quella cliente, o null se non ce n'e' mai state. */
export async function ultimoConsensoLaser(clientId: string): Promise<FirmaLaser | null> {
  if (!clientId) return null;
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(clientId) } });
    const firme = (row?.data as { firme?: FirmaLaser[] } | null)?.firme;
    if (!Array.isArray(firme) || firme.length === 0) return null;
    return firme[firme.length - 1];
  } catch {
    return null;
  }
}

/**
 * Segna che il consenso e' stato firmato/verificato adesso.
 *
 * Non blocca niente se fallisce: il check-in di una cliente che sta entrando
 * non puo' dipendere da una riga di registro.
 */
export async function registraConsensoLaser(
  clientId: string,
  info: { operatore?: string; appointmentId?: string } = {},
): Promise<void> {
  if (!clientId) return;
  const firma: FirmaLaser = {
    data: new Date().toISOString(),
    operatore: info.operatore || undefined,
    appointmentId: info.appointmentId || undefined,
  };
  try {
    const row = await prisma.adminEntry.findUnique({ where: { rowId: rowId(clientId) } });
    const precedenti = (row?.data as { firme?: FirmaLaser[] } | null)?.firme;
    // Le ultime venti bastano: e' un registro, non un archivio.
    const firme = [...(Array.isArray(precedenti) ? precedenti : []), firma].slice(-20);
    await prisma.adminEntry.upsert({
      where: { rowId: rowId(clientId) },
      create: {
        rowId: rowId(clientId), kind: KIND, entityId: clientId,
        data: JSON.parse(JSON.stringify({ firme })),
        createdAt: new Date().toISOString(),
      },
      update: { data: JSON.parse(JSON.stringify({ firme })) },
    });
  } catch (e) {
    console.error('[consenso laser] non registrato:', e);
  }
}

/**
 * Manda il link del modulo alla cliente su WhatsApp.
 *
 * Solo a testo libero, cioe' solo se la cliente ci ha scritto nelle ultime 24
 * ore: fuori da quella finestra Meta pretende un messaggio approvato, e un
 * template per il consenso va creato e fatto approvare. Finche' non c'e', al
 * banco resta il tablet — che poi e' il modo per cui questa cosa e' nata.
 */
export async function mandaLinkConsenso(appointmentId: string): Promise<{ ok: boolean; errore?: string }> {
  const l = await linkConsensoLaser(appointmentId);
  if (!l.ok || !l.url) return { ok: false, errore: l.errore };

  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true },
  });
  const telefono = a?.client?.phone;
  if (!telefono) return { ok: false, errore: 'La cliente non ha un numero in scheda' };

  const nome = a?.client?.firstName || '';
  const testo = [
    `Ciao ${nome}!`.trim(),
    'Prima della seduta laser serve il consenso informato: lo leggi e lo firmi da qui, ci vogliono due minuti.',
    l.url,
    'Se preferisci lo firmi in centro sul tablet, come vuoi tu.',
  ].join('\n');

  const res = await sendManualReply(telefono, testo);
  return res.ok ? { ok: true } : { ok: false, errore: res.error };
}
