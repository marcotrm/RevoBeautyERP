'use server';

/**
 * Il credito della cliente: soldi che il centro le deve.
 *
 * Un anticipo lasciato al banco, una seduta pagata e mai fatta, un rimborso
 * che lei preferisce lasciare «sul conto». Finora stava su un foglietto
 * attaccato al monitor, e al momento di pagare se lo ricordava solo chi era
 * di turno quel giorno — cioe' quasi mai.
 *
 * Non c'e' un saldo e basta: ci sono i MOVIMENTI. Sui soldi «quanto» senza
 * «da dove» non si controlla, e alla prima discussione con una cliente non
 * c'e' niente da guardare in faccia insieme.
 *
 * Due modi di caricarlo, e non sono la stessa cosa:
 *  - ha PAGATO adesso: entra in cassa oggi, e quando lo spendera' non entrera'
 *    niente perche' i soldi sono gia' arrivati;
 *  - glielo REGALIAMO (uno sconto promesso, una seduta andata male): in cassa
 *    non entra niente ne' oggi ne' domani, ed e' giusto cosi' — quel
 *    trattamento sara' gratis, e nei conti deve risultare gratis.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface MovimentoCredito {
  id: string;
  importo: number;
  motivo: string;
  operatore: string | null;
  quando: string;
  /** Vero se quel movimento e' passato dalla cassa. */
  inCassa: boolean;
}

export interface CreditoCliente {
  saldo: number;
  movimenti: MovimentoCredito[];
}

/** Quanto le dobbiamo, e come ci si e' arrivati. */
export async function creditoDi(clientId: string): Promise<CreditoCliente> {
  if (!clientId) return { saldo: 0, movimenti: [] };
  const righe = await prisma.creditMovement.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return {
    saldo: round2(righe.reduce((t, m) => t + m.importo, 0)),
    movimenti: righe.map(m => ({
      id: m.id,
      importo: m.importo,
      motivo: m.motivo,
      operatore: m.operatore,
      quando: m.createdAt,
      inCassa: Boolean(m.txId),
    })),
  };
}

/** Solo il saldo: lo chiedono la cassa e l'agenda, e non gli serve altro. */
export async function saldoCredito(clientId: string): Promise<number> {
  if (!clientId) return 0;
  const r = await prisma.creditMovement.aggregate({
    where: { clientId },
    _sum: { importo: true },
  });
  return round2(r._sum.importo || 0);
}

export async function caricaCredito(dati: {
  clientId: string;
  importo: number;
  motivo: string;
  operatore?: string;
  /** Ha pagato adesso? Allora entra in cassa oggi. */
  incassaOra: boolean;
  metodo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const importo = round2(dati.importo);
  if (!dati.clientId) return { ok: false, error: 'Manca la cliente' };
  if (!(importo > 0)) return { ok: false, error: 'L\'importo dev\'essere maggiore di zero' };
  if (!dati.motivo.trim()) return { ok: false, error: 'Scrivi da dove arriva questo credito' };

  const cliente = await prisma.client.findUnique({
    where: { id: dati.clientId },
    select: { firstName: true, lastName: true },
  });
  if (!cliente) return { ok: false, error: 'Cliente non trovata' };
  const nome = `${cliente.firstName} ${cliente.lastName}`.trim();

  let txId: string | undefined;
  if (dati.incassaOra) {
    const now = new Date();
    const riga = await prisma.posTransaction.create({
      data: {
        date: todayRome(),
        time: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
        clientName: nome,
        items: [`Credito caricato — ${dati.motivo.trim()}`],
        total: importo,
        paymentMethod: dati.metodo || 'Contanti',
        operator: dati.operatore || 'Staff',
        isRefund: false,
      },
    });
    txId = riga.id;
  }

  await prisma.creditMovement.create({
    data: {
      clientId: dati.clientId,
      importo,
      motivo: dati.motivo.trim(),
      operatore: dati.operatore || null,
      txId: txId || null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/**
 * Scala il credito su una vendita.
 *
 * Si chiama a incasso fatto, mai prima: se la vendita non va in porto il
 * credito dev'essere ancora li'. Non si scala mai piu' del saldo — un credito
 * in rosso vorrebbe dire che il centro deve dei soldi a se stesso.
 */
export async function usaCredito(dati: {
  clientId: string;
  importo: number;
  txId?: string;
  operatore?: string;
}): Promise<{ ok: boolean; usato: number }> {
  const disponibile = await saldoCredito(dati.clientId);
  const usato = round2(Math.min(Math.max(0, dati.importo), disponibile));
  if (usato <= 0) return { ok: false, usato: 0 };

  await prisma.creditMovement.create({
    data: {
      clientId: dati.clientId,
      importo: -usato,
      motivo: 'Scalato da una vendita in cassa',
      operatore: dati.operatore || null,
      txId: dati.txId || null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true, usato };
}

/** Si toglie una riga sbagliata: resta lo storico, non si riscrive il passato. */
export async function stornaMovimentoCredito(id: string, operatore?: string): Promise<{ ok: boolean }> {
  const m = await prisma.creditMovement.findUnique({ where: { id } });
  if (!m) return { ok: false };
  await prisma.creditMovement.create({
    data: {
      clientId: m.clientId,
      importo: -m.importo,
      motivo: `Storno: ${m.motivo}`,
      operatore: operatore || null,
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

export interface ClienteConCredito {
  clientId: string;
  cliente: string;
  saldo: number;
}

/** Chi ha credito da spendere: serve a sapere quanto il centro deve, in tutto. */
export async function clientiConCredito(): Promise<ClienteConCredito[]> {
  const righe = await prisma.creditMovement.groupBy({
    by: ['clientId'],
    _sum: { importo: true },
  });
  const conSaldo = righe.filter(r => (r._sum.importo || 0) > 0.005);
  if (conSaldo.length === 0) return [];

  const clienti = await prisma.client.findMany({
    where: { id: { in: conSaldo.map(r => r.clientId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nomeDi = new Map(clienti.map(c => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

  return conSaldo
    .map(r => ({
      clientId: r.clientId,
      cliente: nomeDi.get(r.clientId) || 'Cliente eliminata',
      saldo: round2(r._sum.importo || 0),
    }))
    .sort((a, b) => b.saldo - a.saldo);
}
