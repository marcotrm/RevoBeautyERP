'use server';

import { prisma } from '@/lib/prisma';
import { emitC95Receipt, voidC95Receipt, recoverC95Idtrx } from '@/lib/c95';

// Archivio degli scontrini fiscali C95: elenco per periodo con i riferimenti del documento
// commerciale (progressivo AdE, idtrx) e le azioni fiscali (annullo, riemissione).

export interface ScontrinoRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  client: string;
  items: string;
  total: number;
  method: string;
  operator: string;
  isRefund: boolean;
  c95Status: string | null;
  c95Emitted: boolean;
  c95IdScontrino: string | null;
  c95Idtrx: string | null;
  c95Progressivo: string | null;
  c95Error: string | null;
}

function toScontrino(tx: {
  id: string; date: string; time: string; clientName: string | null; items: unknown; total: number;
  paymentMethod: string; operator: string; isRefund: boolean;
  c95Status: string | null; c95Emitted: boolean; c95IdScontrino: string | null;
  c95Idtrx: string | null; c95Progressivo: string | null; c95Error: string | null;
}): ScontrinoRecord {
  const itemsArr = Array.isArray(tx.items) ? (tx.items as string[]) : [String(tx.items ?? '')];
  return {
    id: tx.id,
    date: tx.date,
    time: tx.time,
    client: tx.clientName ?? '',
    items: itemsArr.join(', '),
    total: tx.total,
    method: tx.paymentMethod,
    operator: tx.operator,
    isRefund: tx.isRefund,
    c95Status: tx.c95Status,
    c95Emitted: tx.c95Emitted,
    c95IdScontrino: tx.c95IdScontrino,
    c95Idtrx: tx.c95Idtrx,
    c95Progressivo: tx.c95Progressivo,
    c95Error: tx.c95Error,
  };
}

export type ScontrinoFilter = 'all' | 'fiscal' | 'missing' | 'refund';

export async function getScontrini(params: { from: string; to: string; query?: string; filter?: ScontrinoFilter }) {
  const where: Record<string, unknown> = { date: { gte: params.from, lte: params.to } };
  const filter = params.filter || 'all';
  if (filter === 'fiscal') where.c95Emitted = true;
  if (filter === 'missing') where.AND = [{ total: { gt: 0 } }, { OR: [{ c95Emitted: false }, { c95Emitted: null }] }];
  if (filter === 'refund') where.total = { lt: 0 };

  const rows = await prisma.posTransaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
    take: 500,
  });

  const q = (params.query || '').trim().toLowerCase();
  const list = rows.map(toScontrino);
  if (!q) return list;
  return list.filter((s) =>
    [s.c95Progressivo, s.c95Idtrx, s.c95IdScontrino, s.client, s.items]
      .some((v) => String(v ?? '').toLowerCase().includes(q))
  );
}

export interface ScontrinoActionResult { ok: boolean; error?: string }

// Annulla il documento commerciale su AdE (Tipo 'A') e segna la transazione come annullata.
// La vendita locale resta a registro con stato 'voided': non va cancellata, altrimenti
// si perde la corrispondenza con il documento fiscale annullato.
export async function annullaScontrino(txId: string): Promise<ScontrinoActionResult> {
  const tx = await prisma.posTransaction.findUnique({ where: { id: txId } });
  if (!tx) return { ok: false, error: 'Transazione non trovata' };
  if (!tx.c95Emitted || !tx.c95IdScontrino) return { ok: false, error: 'Nessuno scontrino fiscale da annullare' };
  if (tx.c95Status === 'voided') return { ok: false, error: 'Scontrino già annullato' };

  const idtrx = tx.c95Idtrx || (await recoverC95Idtrx(tx.c95IdScontrino)) || undefined;
  const res = await voidC95Receipt({ idScontrino: tx.c95IdScontrino, idtrx, tipo: 'A' });
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.posTransaction.update({
    where: { id: txId },
    data: { c95Status: 'voided', c95Idtrx: idtrx, c95Error: null },
  });
  return { ok: true };
}

// Riemette lo scontrino per una vendita che non era stata trasmessa all'AdE
// (stato failed/uncertain o integrazione spenta al momento dell'incasso).
export async function riemettiScontrino(txId: string): Promise<ScontrinoActionResult> {
  const tx = await prisma.posTransaction.findUnique({ where: { id: txId } });
  if (!tx) return { ok: false, error: 'Transazione non trovata' };
  if (tx.total <= 0) return { ok: false, error: 'I rimborsi si gestiscono con il reso, non con la riemissione' };
  if (tx.c95Emitted) return { ok: false, error: 'Scontrino già emesso: annullalo prima di riemetterlo' };
  if (tx.c95Status === 'uncertain') {
    return { ok: false, error: 'Esito incerto: verifica su C95 se il documento esiste già, per non emetterlo due volte' };
  }

  const itemsArr = Array.isArray(tx.items) ? (tx.items as string[]) : [String(tx.items ?? '')];
  const result = await emitC95Receipt({
    amount: tx.total,
    paymentMethod: tx.paymentMethod,
    lines: [{ descrizione: itemsArr.join(', ').slice(0, 100) || 'Servizi/prodotti', prezzoUnitario: tx.total, quantita: 1 }],
  });

  await prisma.posTransaction.update({
    where: { id: txId },
    data: {
      c95Status: result.status,
      c95Emitted: result.status === 'emitted',
      c95IdScontrino: result.idScontrino,
      c95Gid: result.gid,
      c95Idtrx: result.idtrx,
      c95Progressivo: result.progressivo,
      c95Error: result.error,
    },
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
