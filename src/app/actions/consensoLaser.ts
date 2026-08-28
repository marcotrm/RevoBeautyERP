'use server';

/**
 * Il consenso firmato per il laser.
 *
 * Il foglio e' di carta e resta di carta: la firma vera sta in archivio, non
 * qui. Quello che il gestionale puo' fare — e che nessun foglio fa — e'
 * ricordarlo nell'unico momento in cui serve, cioe' quando la cliente e'
 * davanti al banco e non e' ancora entrata in cabina. Dopo, sotto la lampada,
 * non lo dice piu' nessuno.
 *
 * Di ogni conferma resta traccia: chi l'ha data e quando. Serve il giorno in
 * cui qualcuno chiede "ma questa aveva firmato?" — e serve anche a sapere se
 * e' la prima volta che quella cliente fa un laser.
 */

import { prisma } from '@/lib/prisma';

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
