/**
 * Punti fedeltà e Beauty Credit: il motore, non l'interfaccia.
 *
 * Regola che decide tutto il resto: **non esiste un saldo scritto da qualche
 * parte**. Il saldo è sempre la somma dei movimenti. Un numero scritto a mano
 * si disallinea al primo errore e non si può più spiegare — alla cliente che
 * dice "avevo 40 punti" si può solo credere o darle torto. Con i movimenti si
 * apre lo storico e si vede.
 *
 * Il credito è diviso in tasche perché hanno regole diverse:
 *  - `purchased` è denaro suo, non scade mai e in caso di rimborso va reso;
 *  - `cashback`, `promo`, `referral`, `prize` sono sconti anticipati: scadono.
 * Quando si spende si consuma **prima ciò che scade prima**, altrimenti il
 * credito promozionale marcisce mentre si erode quello acquistato — e la
 * cliente si ritrova a perdere soldi che credeva suoi.
 *
 * Sul fatturato la scelta è netta: il credito **entra in cassa quando viene
 * ricaricato**, non quando viene speso. Contarlo due volte gonfierebbe incassi
 * e statistiche di tutto il valore del wallet.
 */

import { prisma } from './prisma';

export type Tasca = 'purchased' | 'cashback' | 'promo' | 'referral' | 'compensation' | 'prize';

export const ETICHETTA_TASCA: Record<Tasca, string> = {
  purchased: 'Credito acquistato',
  cashback: 'Cashback',
  promo: 'Credito promozionale',
  referral: 'Credito amiche',
  compensation: 'Compensazione',
  prize: 'Premio',
};

/** Le tasche che, se non usate, si perdono: l'app deve avvisare prima. */
const TASCHE_A_SCADENZA: Tasca[] = ['cashback', 'promo', 'referral', 'prize'];

const oggiISO = () => new Date().toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RigaCredito {
  id: string;
  bucket: Tasca;
  reason: string;
  /** Quanto ne resta da usare di questa entrata. */
  residuo: number;
  totale: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface SaldoWallet {
  totale: number;
  perTasca: { bucket: Tasca; etichetta: string; importo: number }[];
  /** Credito che scade entro 30 giorni, con la data più vicina. */
  inScadenza: { importo: number; entro: string | null; giorni: number | null };
  entrate: RigaCredito[];
}

/** Entrate ancora spendibili, dalla più vicina alla scadenza. */
async function entrateVive(clientId: string) {
  const adesso = oggiISO();
  const righe = await prisma.loyaltyMovement.findMany({
    where: { clientId, kind: 'credit', amount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  });
  return righe
    .filter(r => r.amount - r.consumed > 0.004)
    .filter(r => !r.expiresAt || r.expiresAt > adesso)
    .sort((a, b) => {
      // Prima ciò che scade prima; ciò che non scade va in fondo
      const sa = a.expiresAt ?? '9999';
      const sb = b.expiresAt ?? '9999';
      return sa === sb ? (a.createdAt < b.createdAt ? -1 : 1) : sa < sb ? -1 : 1;
    });
}

export async function saldoWallet(clientId: string): Promise<SaldoWallet> {
  const vive = await entrateVive(clientId);

  const perTascaMap = new Map<Tasca, number>();
  for (const r of vive) {
    const b = r.bucket as Tasca;
    perTascaMap.set(b, (perTascaMap.get(b) || 0) + (r.amount - r.consumed));
  }

  const fra30 = new Date(Date.now() + 30 * 86400000).toISOString();
  const inScadenza = vive.filter(r => r.expiresAt && r.expiresAt <= fra30);
  const primaScadenza = inScadenza.map(r => r.expiresAt!).sort()[0] ?? null;

  return {
    totale: round2(vive.reduce((s, r) => s + (r.amount - r.consumed), 0)),
    perTasca: [...perTascaMap.entries()]
      .map(([bucket, importo]) => ({ bucket, etichetta: ETICHETTA_TASCA[bucket], importo: round2(importo) }))
      .sort((a, b) => b.importo - a.importo),
    inScadenza: {
      importo: round2(inScadenza.reduce((s, r) => s + (r.amount - r.consumed), 0)),
      entro: primaScadenza,
      giorni: primaScadenza ? Math.max(0, Math.ceil((Date.parse(primaScadenza) - Date.now()) / 86400000)) : null,
    },
    entrate: vive.map(r => ({
      id: r.id,
      bucket: r.bucket as Tasca,
      reason: r.reason,
      residuo: round2(r.amount - r.consumed),
      totale: round2(r.amount),
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  };
}

export async function saldoPunti(clientId: string): Promise<number> {
  const righe = await prisma.loyaltyMovement.findMany({
    where: { clientId, kind: 'points' },
    select: { amount: true },
  });
  return Math.round(righe.reduce((s, r) => s + r.amount, 0));
}

export interface Accredito {
  clientId: string;
  importo: number;
  bucket: Tasca;
  motivo: string;
  sourceType: string;
  sourceId?: string;
  /** Giorni di validità. Il credito acquistato non scade mai. */
  validoGiorni?: number;
  operator?: string;
}

/** Aggiunge credito. Restituisce il movimento creato. */
export async function accreditaCredito(a: Accredito) {
  const importo = round2(a.importo);
  if (importo <= 0) throw new Error('L\'importo da accreditare deve essere positivo');

  const scade = a.bucket === 'purchased' || !a.validoGiorni
    ? null
    : new Date(Date.now() + a.validoGiorni * 86400000).toISOString();

  return prisma.loyaltyMovement.create({
    data: {
      clientId: a.clientId,
      kind: 'credit',
      amount: importo,
      bucket: a.bucket,
      reason: a.motivo,
      sourceType: a.sourceType,
      sourceId: a.sourceId ?? null,
      expiresAt: scade,
      createdAt: oggiISO(),
      operator: a.operator ?? null,
    },
  });
}

export interface EsitoSpesa {
  ok: boolean;
  speso: number;
  error?: string;
  /** Da quali tasche è stato preso, per lo scontrino e per lo storico. */
  dettaglio: { bucket: Tasca; importo: number }[];
}

/**
 * Spende credito, consumando prima ciò che scade prima.
 *
 * Tutto dentro una transazione: due casse aperte sulla stessa cliente potrebbero
 * altrimenti leggere lo stesso saldo e spenderlo due volte.
 */
export async function spendiCredito(params: {
  clientId: string;
  importo: number;
  motivo: string;
  sourceType: string;
  sourceId?: string;
  operator?: string;
}): Promise<EsitoSpesa> {
  const richiesto = round2(params.importo);
  if (richiesto <= 0) return { ok: false, speso: 0, error: 'Importo non valido', dettaglio: [] };

  return prisma.$transaction(async (tx) => {
    const adesso = oggiISO();
    const righe = await tx.loyaltyMovement.findMany({
      where: { clientId: params.clientId, kind: 'credit', amount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
    const vive = righe
      .filter(r => r.amount - r.consumed > 0.004)
      .filter(r => !r.expiresAt || r.expiresAt > adesso)
      .sort((a, b) => {
        const sa = a.expiresAt ?? '9999';
        const sb = b.expiresAt ?? '9999';
        return sa === sb ? (a.createdAt < b.createdAt ? -1 : 1) : sa < sb ? -1 : 1;
      });

    const disponibile = round2(vive.reduce((s, r) => s + (r.amount - r.consumed), 0));
    if (disponibile < richiesto) {
      return { ok: false, speso: 0, error: `Credito insufficiente: disponibili ${disponibile.toFixed(2)} €`, dettaglio: [] };
    }

    let daCoprire = richiesto;
    const dettaglio = new Map<Tasca, number>();

    for (const r of vive) {
      if (daCoprire <= 0.004) break;
      const residuo = r.amount - r.consumed;
      const preso = Math.min(residuo, daCoprire);
      await tx.loyaltyMovement.update({
        where: { id: r.id },
        data: { consumed: round2(r.consumed + preso) },
      });
      dettaglio.set(r.bucket as Tasca, round2((dettaglio.get(r.bucket as Tasca) || 0) + preso));
      daCoprire = round2(daCoprire - preso);
    }

    // L'uscita resta come riga a sé: nello storico la cliente deve leggere
    // "hai speso 15 €", non dedurlo dai consumi delle singole entrate.
    await tx.loyaltyMovement.create({
      data: {
        clientId: params.clientId,
        kind: 'credit',
        amount: -richiesto,
        bucket: 'purchased',
        reason: params.motivo,
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
        createdAt: adesso,
        operator: params.operator ?? null,
      },
    });

    return {
      ok: true,
      speso: richiesto,
      dettaglio: [...dettaglio.entries()].map(([bucket, importo]) => ({ bucket, importo })),
    };
  });
}

/** Aggiunge (o toglie) punti fedeltà. */
export async function muoviPunti(params: {
  clientId: string;
  punti: number;
  motivo: string;
  sourceType: string;
  sourceId?: string;
  operator?: string;
}) {
  if (!params.punti) return null;
  return prisma.loyaltyMovement.create({
    data: {
      clientId: params.clientId,
      kind: 'points',
      amount: Math.round(params.punti),
      bucket: 'purchased',
      reason: params.motivo,
      sourceType: params.sourceType,
      sourceId: params.sourceId ?? null,
      createdAt: oggiISO(),
      operator: params.operator ?? null,
    },
  });
}

/** Storico leggibile: entrate, uscite e scadenze, dal più recente. */
export async function storicoMovimenti(clientId: string, quanti = 100) {
  const righe = await prisma.loyaltyMovement.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: quanti,
  });
  const adesso = oggiISO();
  return righe.map(r => ({
    id: r.id,
    kind: r.kind as 'credit' | 'points',
    amount: round2(r.amount),
    bucket: r.bucket as Tasca,
    etichettaTasca: ETICHETTA_TASCA[r.bucket as Tasca] ?? r.bucket,
    reason: r.reason,
    sourceType: r.sourceType,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    scaduto: !!r.expiresAt && r.expiresAt <= adesso && r.amount - r.consumed > 0.004,
    residuo: r.amount > 0 ? round2(r.amount - r.consumed) : 0,
  }));
}

/** Le tasche che scadono: serve all'app per decidere cosa mettere in evidenza. */
export function scade(bucket: Tasca): boolean {
  return TASCHE_A_SCADENZA.includes(bucket);
}
