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
import { sendWhatsAppTemplate, normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { listD360Templates } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';
import { headers } from 'next/headers';
import { descriviDispositivo } from '@/lib/dispositivo';
import { leggiDocumento, type LetturaDocumento } from '@/lib/documento';
import { salvaDocumento } from '@/app/actions/documenti';

const TITOLO = 'Consenso Laser/Epilazione';
const GIORNI_GETTONE = 3;

/**
 * Il gettone porta sempre la cliente, l'appuntamento solo se c'e'.
 *
 * Il consenso e' della persona, non della seduta: si firma anche al banco
 * mentre si prende l'appuntamento, o la volta che si e' dimenticato di farlo
 * e la cliente e' gia' andata via. Con l'appuntamento il modulo si riempie da
 * solo — data, ora, zone; senza, si scrivono le zone a mano.
 */
interface Gettone { appointmentId?: string; clientId: string }

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
  /**
   * Il documento gia' agli atti, se la cliente lo aveva gia' portato.
   *
   * Chiederlo di nuovo a chi l'ha gia' dato e' il modo migliore per far
   * sembrare che qui dentro non ci si ricordi niente di lei: si mostra
   * quello che c'e' e si chiede solo se e' cambiato.
   */
  documento?: { tipo: string; numero: string; quando: string } | null;
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
  if (!dati?.clientId) {
    return { ok: false, errore: 'Il link non è più valido. Chiedine uno nuovo al centro.' };
  }

  const a = dati.appointmentId
    ? await prisma.appointment.findUnique({ where: { id: dati.appointmentId }, include: { client: true } })
    : null;
  const cliente = a?.client || await prisma.client.findUnique({ where: { id: dati.clientId } });
  if (!cliente) return { ok: false, errore: 'Scheda cliente non trovata' };

  const zone = (() => {
    if (!a) return '';
    const sv = Array.isArray(a.services) ? (a.services as Array<{ treatmentName?: unknown }>) : [];
    const nomi = sv.map(s => String(s?.treatmentName || '')).filter(n => /^\s*epilazion/i.test(n));
    if (nomi.length > 0) return nomi.join(', ');
    return String(a.treatmentName || '');
  })();

  const [ultimo, doc] = await Promise.all([
    prisma.clientConsent.findFirst({
      where: { clientId: dati.clientId, title: TITOLO },
      orderBy: { signedAt: 'desc' },
      select: { id: true, signedAt: true },
    }),
    prisma.clientDocument.findFirst({
      where: { clientId: dati.clientId },
      orderBy: { createdAt: 'desc' },
      select: { tipo: true, numero: true, createdAt: true },
    }),
  ]);

  return {
    ok: true,
    clientId: dati.clientId,
    nome: `${cliente.firstName} ${cliente.lastName}`.trim(),
    nato: cliente.birthDate ?? null,
    quando: a ? `${a.date.split('-').reverse().join('/')} alle ${a.startTime}` : undefined,
    zone,
    operatrice: a?.operatorName,
    documento: doc ? { tipo: doc.tipo, numero: doc.numero, quando: doc.createdAt } : null,
    giaFirmato: ultimo ? { id: ultimo.id, quando: ultimo.signedAt } : null,
  };
}

/** Lo stesso modulo, ma aperto dalla scheda della cliente e non da un appuntamento. */
export async function linkConsensoCliente(clientId: string): Promise<{ ok: boolean; url?: string; errore?: string }> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!c) return { ok: false, errore: 'Cliente non trovata' };
  const gettone = firmaConferma({ clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  return { ok: true, url: `${base}/firma/${encodeURIComponent(gettone)}` };
}

export interface RisposteLaser {
  storico: Record<string, string>;
  zone: string;
  consensoFoto: boolean;
  firma: string;
  /** Il documento fotografato adesso, quando non ce n'e' gia' uno agli atti. */
  documento?: {
    foto: string;
    anteprima?: string;
    tipo?: string;
    numero?: string;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    scadenza?: string;
  };
}

/**
 * Legge la foto del documento appena scattata.
 *
 * Passa da qui e non dall'azione generica perche' questa pagina e' pubblica:
 * senza un gettone valido non si legge niente, altrimenti chiunque avesse
 * l'indirizzo potrebbe far leggere le sue foto al gestionale.
 */
export async function leggiDocumentoDalModulo(gettone: string, foto: string): Promise<LetturaDocumento> {
  const dati = leggiConferma<Gettone>(gettone);
  if (!dati?.clientId) return { leggibile: false, problema: 'Il link non è più valido: chiedine uno nuovo al centro.' };
  return leggiDocumento(foto);
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

  const dispositivo = descriviDispositivo((await headers()).get('user-agent'));

  const consenso = await prisma.clientConsent.create({
    data: {
      clientId: dati.clientId,
      title: TITOLO,
      signatureData: r.firma,
      signedAt: new Date().toISOString(),
      /*
        Da dove ha firmato, davvero.

        Prima c'era scritto "dal tablet" su ogni consenso, anche quando il
        link glielo si era mandato su WhatsApp e lei aveva firmato dal
        divano col suo telefono. Una riga che dice una cosa non vera su un
        documento firmato e' peggio di una riga che non dice niente.
      */
      notes: `Firmato da ${dispositivo || 'dispositivo sconosciuto'} · zone: ${r.zone || '—'}`,
      data: JSON.parse(JSON.stringify({
        appointmentId: dati.appointmentId,
        seduta: a ? `${a.date} ${a.startTime}` : null,
        operatrice: a?.operatorName ?? null,
        eraLaser: a ? seduraDaRadere(a) : null,
        zone: r.zone,
        storico: r.storico,
        consensoFoto: r.consensoFoto,
        versioneTesto: '2026-09-01',
        documento: r.documento
          ? { tipo: r.documento.tipo || 'altro', numero: r.documento.numero || '' }
          : null,
      })),
    },
  });

  /*
    Il documento resta allegato alla compilazione.

    Non e' una copia in piu' della foto: e' la prova di dove esce il numero
    scritto sul consenso. Chi lo riapre fra un anno vede il tesserino e non
    deve fidarsi di una trascrizione fatta di corsa.
  */
  if (r.documento?.foto && r.documento.numero) {
    await salvaDocumento({
      clientId: dati.clientId,
      tipo: r.documento.tipo,
      numero: r.documento.numero,
      nome: r.documento.nome,
      cognome: r.documento.cognome,
      dataNascita: r.documento.dataNascita,
      scadenza: r.documento.scadenza,
      foto: r.documento.foto,
      anteprima: r.documento.anteprima,
      consensoId: consenso.id,
      origine: 'cliente',
    }).catch(() => {});
  }

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
 * Due strade, e si prova prima quella gratis. Dentro le 24 ore dall'ultimo
 * messaggio della cliente si scrive a testo libero, col link per esteso: si
 * legge meglio di un bottone e non costa niente. Fuori da quella finestra —
 * che e' il caso normale, la sera prima — comanda Meta e serve il template
 * approvato, col gettone attaccato in coda al bottone.
 */
export async function mandaLinkConsenso(appointmentId: string): Promise<{ ok: boolean; errore?: string }> {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true },
  });
  if (!a) return { ok: false, errore: 'Appuntamento non trovato' };
  const telefono = a.client?.phone;
  if (!isSendablePhone(telefono)) return { ok: false, errore: 'La cliente non ha un numero valido in scheda' };

  const gettone = firmaConferma({ appointmentId: a.id, clientId: a.clientId } satisfies Gettone, GIORNI_GETTONE * 86_400_000);
  if (!gettone) return { ok: false, errore: 'Manca VOICE_API_SECRET: il link non si può firmare' };
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://erp.revobeauty.it';
  const url = `${base}/firma/${encodeURIComponent(gettone)}`;

  const nome = a.client?.firstName || '';
  const quando = `${a.date.split('-').reverse().join('/')} alle ${a.startTime}`;
  const testo = [
    `Ciao ${nome}!`.trim(),
    `Per la seduta laser di ${quando} serve il consenso informato: lo leggi e lo firmi da qui, sono due minuti.`,
    url,
    'Se preferisci lo firmi in centro sul tablet, come vuoi tu.',
  ].join('\n');

  const libero = await sendManualReply(telefono as string, testo);
  if (libero.ok) return { ok: true };

  /** Com'e' messo su Meta il template del consenso: ASSENTE finche' non lo si crea. */
  const stato = await (async () => {
    const e = await listD360Templates().catch(() => null);
    if (!e?.ok) return 'ASSENTE';
    return e.templates.find(t => t.name === WA_TEMPLATES.consensoLaser.name)?.status || 'ASSENTE';
  })();
  if (stato !== 'APPROVED') {
    return {
      ok: false,
      errore: stato === 'ASSENTE'
        ? 'Fuori dalle 24 ore serve un template approvato, e non è ancora stato creato. Mandalo in approvazione da Automazioni.'
        : `Il template del consenso non è ancora approvato da Meta (${stato}). Intanto fallo firmare sul tablet.`,
    };
  }

  const res = await sendWhatsAppTemplate(normalizePhone(telefono as string), 'consensoLaser', {
    bodyParams: [nome || 'ciao', quando],
    buttonUrlSuffix: encodeURIComponent(gettone),
    fallbackText: testo,
    source: 'automation',
  });
  return res.ok ? { ok: true } : { ok: false, errore: res.error || 'Invio fallito' };
}
