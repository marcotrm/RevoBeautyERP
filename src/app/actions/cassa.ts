'use server';

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';
import { CATEGORY_LABELS } from '@/lib/cashCategories';

// ============================================================
// CASSA CONTANTI (il cassetto)
//
// Saldo = incassi in contanti (dalle vendite POS)
//       + entrate manuali (fondo cassa, versamenti)
//       − uscite manuali (spese, prelievi)
//       − contanti versati in cassaforte (chiusure cassa)
//
// Così ogni euro è tracciato: si vede sempre quanto DEVE esserci nel cassetto.
// ============================================================

export type CashKind = 'in' | 'out';

export interface CashMovementRecord {
  id: string;
  kind: CashKind;
  amount: number;
  category: string;
  note: string | null;
  operator: string;
  date: string;
  createdAt: string;
}

/** Riga unica della cronologia (unisce vendite, movimenti manuali e cassaforte). */
export interface CashLedgerRow {
  id: string;
  when: string;        // ISO
  date: string;        // YYYY-MM-DD
  label: string;
  detail: string;
  operator: string;    // chi l'ha fatto (per filtrare)
  amount: number;      // positivo = entra in cassa, negativo = esce
  source: 'vendita' | 'manuale' | 'cassaforte';
  category: string;
  canDelete: boolean;
  cancelled?: boolean; // annullato: mostrato barrato, non conta nel saldo
  cancelledBy?: string;
  cancelledAt?: string;
}

export interface CashRegisterState {
  balance: number;         // quanto deve esserci ORA nel cassetto
  todayIncome: number;     // incassi in contanti di oggi
  todayIn: number;         // entrate manuali di oggi
  todayOut: number;        // uscite manuali di oggi
  todayToSafe: number;     // versato in cassaforte oggi
  safeBalance: number;     // saldo cassaforte
  ledger: CashLedgerRow[]; // cronologia completa, dal più recente
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getCashRegister(limit = 300): Promise<CashRegisterState> {
  const [manual, txs, safeMoves] = await Promise.all([
    prisma.cashMovement.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.posTransaction.findMany({ orderBy: { id: 'desc' } }),
    prisma.cassaMovement.findMany({ orderBy: { id: 'desc' } }),
  ]);

  const today = todayRome();

  // --- Vendite in contanti (entrano nel cassetto). I rimborsi in contanti escono. ---
  const cashTxs = txs.filter(t => /contant|cash|misto/i.test(t.paymentMethod || ''));
  const cashFromSales = cashTxs.reduce((s, t) => s + t.total, 0);

  // --- Movimenti manuali (gli annullati NON contano nel saldo, ma restano in cronologia) ---
  const liveManual = manual.filter(m => !m.deletedAt);
  const manualIn = liveManual.filter(m => m.kind === 'in').reduce((s, m) => s + m.amount, 0);
  const manualOut = liveManual.filter(m => m.kind === 'out').reduce((s, m) => s + m.amount, 0);

  // --- Versamenti in cassaforte: i contanti escono dal cassetto ---
  const toSafe = safeMoves.filter(m => m.type === 'deposit').reduce((s, m) => s + m.cash, 0);

  const balance = round2(cashFromSales + manualIn - manualOut - toSafe);

  // Saldo cassaforte = versamenti − prelievi
  const safeBalance = round2(safeMoves.reduce((s, m) => s + (m.type === 'withdraw' ? -m.cash : m.cash), 0));

  // --- Cronologia unificata ---
  const ledger: CashLedgerRow[] = [];

  for (const t of cashTxs) {
    ledger.push({
      id: `tx-${t.id}`,
      when: `${t.date}T${t.time || '00:00'}:00`,
      date: t.date,
      label: t.total >= 0 ? 'Vendita in contanti' : 'Rimborso in contanti',
      detail: [t.clientName || 'Cliente occasionale', t.operator].filter(Boolean).join(' · '),
      operator: t.operator || '',
      amount: round2(t.total),
      source: 'vendita',
      category: 'incasso',
      canDelete: false,
    });
  }

  for (const m of manual) {
    ledger.push({
      id: m.id,
      when: m.createdAt,
      date: m.date,
      label: m.kind === 'in' ? 'Entrata' : 'Uscita',
      detail: [CATEGORY_LABELS[m.category] || m.category, m.note, m.operator].filter(Boolean).join(' · '),
      operator: m.operator || '',
      amount: round2(m.kind === 'in' ? m.amount : -m.amount),
      source: 'manuale',
      category: m.category,
      canDelete: !m.deletedAt,
      cancelled: !!m.deletedAt,
      cancelledBy: m.deletedBy || undefined,
      cancelledAt: m.deletedAt || undefined,
    });
  }

  for (const m of safeMoves) {
    if (m.type === 'deposit') {
      if (m.cash === 0) continue;
      ledger.push({
        id: `safe-${m.id}`,
        when: m.createdAt,
        date: m.date,
        label: 'Versato in cassaforte',
        detail: m.note || `Chiusura cassa del ${m.date.split('-').reverse().join('/')}`,
        operator: '',
        amount: round2(-m.cash),
        source: 'cassaforte',
        category: 'versamento',
        canDelete: false,
      });
    }
  }

  ledger.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));

  return {
    balance,
    todayIncome: round2(cashTxs.filter(t => t.date === today).reduce((s, t) => s + t.total, 0)),
    todayIn: round2(manual.filter(m => m.kind === 'in' && m.date === today).reduce((s, m) => s + m.amount, 0)),
    todayOut: round2(manual.filter(m => m.kind === 'out' && m.date === today).reduce((s, m) => s + m.amount, 0)),
    todayToSafe: round2(safeMoves.filter(m => m.type === 'deposit' && m.date === today).reduce((s, m) => s + m.cash, 0)),
    safeBalance,
    ledger: ledger.slice(0, limit),
  };
}

export async function addCashMovement(data: {
  kind: CashKind; amount: number; category: string; note?: string; operator?: string;
}): Promise<{ ok: boolean; error?: string; movement?: CashMovementRecord }> {
  const amount = round2(Number(data.amount) || 0);
  if (!amount || amount <= 0) return { ok: false, error: 'Inserisci un importo maggiore di zero.' };
  if (data.kind !== 'in' && data.kind !== 'out') return { ok: false, error: 'Tipo di movimento non valido.' };

  const mv = await prisma.cashMovement.create({
    data: {
      kind: data.kind,
      amount,
      category: data.category || 'altro',
      note: data.note?.trim() || null,
      operator: data.operator?.trim() || '',
      date: todayRome(),
      createdAt: new Date().toISOString(),
    },
  });
  return { ok: true, movement: mv as CashMovementRecord };
}

/**
 * Annulla un movimento manuale. NON lo cancella dal database: lo segna come
 * annullato così resta visibile nella cronologia con chi e quando l'ha tolto
 * (antifrode: nessun euro può sparire in silenzio).
 */
export async function deleteCashMovement(id: string, deletedBy?: string): Promise<{ ok: boolean }> {
  try {
    await prisma.cashMovement.update({
      where: { id },
      data: { deletedAt: new Date().toISOString(), deletedBy: deletedBy?.trim() || 'sconosciuto' },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Chiusura serale: registra quanti contanti restano nel cassetto e versa
 * il resto in cassaforte. Se il contato non torna, la differenza viene
 * registrata come correzione così il saldo resta veritiero.
 */
export async function closeDayCash(params: {
  countedCash: number;     // contanti realmente contati nel cassetto
  keepInTill: number;      // quanto lasciano in cassa per il giorno dopo
  operator?: string;
  note?: string;
}): Promise<{ ok: boolean; error?: string; difference: number; toSafe: number }> {
  const counted = round2(Number(params.countedCash) || 0);
  const keep = round2(Number(params.keepInTill) || 0);
  if (counted < 0 || keep < 0) return { ok: false, error: 'Gli importi non possono essere negativi.', difference: 0, toSafe: 0 };
  if (keep > counted) return { ok: false, error: 'Non puoi lasciare in cassa più di quanto hai contato.', difference: 0, toSafe: 0 };

  const state = await getCashRegister(1);
  const difference = round2(counted - state.balance);
  const toSafe = round2(counted - keep);
  const now = new Date().toISOString();
  const today = todayRome();

  // 1) Se il contato non corrisponde, registra la differenza (ammanco o eccedenza)
  if (Math.abs(difference) >= 0.01) {
    await prisma.cashMovement.create({
      data: {
        kind: difference > 0 ? 'in' : 'out',
        amount: Math.abs(difference),
        category: 'correzione',
        note: `Conteggio serale: ${difference > 0 ? 'eccedenza' : 'ammanco'} rispetto al saldo atteso (${state.balance.toFixed(2)} €)`,
        operator: params.operator?.trim() || '',
        date: today,
        createdAt: now,
      },
    });
  }

  // 2) Versa in cassaforte quello che non resta in cassa
  if (toSafe >= 0.01) {
    await prisma.cassaMovement.create({
      data: {
        type: 'deposit',
        date: today,
        cash: toSafe,
        total: toSafe,
        note: params.note?.trim() || `Chiusura serale — lasciati in cassa ${keep.toFixed(2)} €`,
        createdAt: now,
      },
    });
  }

  return { ok: true, difference, toSafe };
}
