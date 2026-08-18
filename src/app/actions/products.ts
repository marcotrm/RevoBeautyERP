'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { Product } from '@/types';
import { notifyIncasso } from '@/lib/telegram';

export async function getProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  return rows as unknown as Product[];
}

export async function createProduct(p: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
  const row = await prisma.product.create({
    data: {
      name: p.name, brand: p.brand || '', category: p.category || 'Viso',
      sku: p.sku || '', barcode: p.barcode || null,
      price: p.price || 0, costPrice: p.costPrice || 0,
      stock: p.stock || 0, minStock: p.minStock ?? 5,
      locationId: p.locationId || 'loc1', isActive: p.isActive ?? true,
      createdAt: new Date().toISOString(),
    },
  });
  return row as unknown as Product;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const row = await prisma.product.update({ where: { id }, data: updates as Record<string, unknown> });
  return row as unknown as Product;
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  return true;
}

// Inserimento massivo (es. import da fattura). Salta i duplicati per SKU (se presente).
export async function bulkCreateProducts(items: Array<Omit<Product, 'id'>>): Promise<Product[]> {
  const existing = await prisma.product.findMany();
  const skuSeen = new Set(existing.filter(e => e.sku).map(e => e.sku.toLowerCase()));
  const created: Product[] = [];
  for (const p of items) {
    if (p.sku && skuSeen.has(p.sku.toLowerCase())) {
      // Aggiorna lo stock del prodotto esistente invece di duplicare
      const ex = existing.find(e => e.sku.toLowerCase() === p.sku.toLowerCase());
      if (ex) {
        const upd = await prisma.product.update({ where: { id: ex.id }, data: { stock: ex.stock + (p.stock || 0), costPrice: p.costPrice || ex.costPrice } });
        created.push(upd as unknown as Product);
        continue;
      }
    }
    const row = await prisma.product.create({
      data: {
        name: p.name, brand: p.brand || '', category: p.category || 'Viso',
        sku: p.sku || '', barcode: p.barcode || null,
        price: p.price || 0, costPrice: p.costPrice || 0,
        stock: p.stock || 0, minStock: p.minStock ?? 5,
        locationId: p.locationId || 'loc1', isActive: p.isActive ?? true,
        createdAt: new Date().toISOString(),
      },
    });
    if (p.sku) skuSeen.add(p.sku.toLowerCase());
    created.push(row as unknown as Product);
  }
  return created;
}

// Migrazione una-tantum dei prodotti salvati nel browser (localStorage) verso il DB condiviso.
export async function migrateProducts(list: Product[]) {
  const existing = await prisma.product.findMany();
  const key = (p: { name: string; sku: string }) => `${p.name.toLowerCase()}|${(p.sku || '').toLowerCase()}`;
  const seen = new Set(existing.map(key));
  const SEED = new Set(['siero vitamina c', 'crema idratante viso', 'olio corpo rilassante']); // demo iniziali
  let inserted = 0;
  for (const p of list) {
    if (SEED.has(p.name.toLowerCase())) continue;
    if (seen.has(key(p))) continue;
    await prisma.product.create({
      data: {
        name: p.name, brand: p.brand || '', category: p.category || 'Viso',
        sku: p.sku || '', barcode: p.barcode || null,
        price: p.price || 0, costPrice: p.costPrice || 0,
        stock: p.stock || 0, minStock: p.minStock ?? 5,
        locationId: p.locationId || 'loc1', isActive: p.isActive ?? true,
        createdAt: new Date().toISOString(),
      },
    });
    seen.add(key(p));
    inserted++;
  }
  return inserted;
}

/**
 * Vendita di prodotti abbinata a un pacchetto: registra l'incasso in cassa
 * (con lo sconto già applicato) e scarica le quantità dal magazzino.
 */
export async function sellProductsWithPackage(params: {
  clientName: string;
  packageName: string;
  lines: { productId: string; name: string; quantity: number; unitPrice: number; discountPct: number }[];
  method: string;
  operator: string;
}): Promise<{ total: number }> {
  const lines = params.lines.filter(l => l.quantity > 0);
  if (lines.length === 0) return { total: 0 };

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lineTotal = (l: { quantity: number; unitPrice: number; discountPct: number }) =>
    round2(l.unitPrice * l.quantity * (1 - (l.discountPct || 0) / 100));
  const total = round2(lines.reduce((s, l) => s + lineTotal(l), 0));

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

  await prisma.posTransaction.create({
    data: {
      date: today,
      time,
      clientName: params.clientName,
      items: lines.map(l => `${l.name} x${l.quantity}${l.discountPct ? ` (-${l.discountPct}%)` : ''}`),
      total,
      paymentMethod: params.method,
      operator: params.operator,
      isRefund: false,
    },
  });

  // Scarico magazzino (mai sotto zero)
  for (const l of lines) {
    const p = await prisma.product.findUnique({ where: { id: l.productId }, select: { stock: true } });
    if (!p) continue;
    await prisma.product.update({
      where: { id: l.productId },
      data: { stock: Math.max(0, p.stock - l.quantity) },
    });
  }

  notifyIncasso({
    amount: total,
    client: params.clientName,
    items: `${lines.map(l => `${l.name} x${l.quantity}`).join(', ')} — sconto pacchetto ${params.packageName}`,
    method: params.method,
    operator: params.operator,
  }).catch(() => {});

  return { total };
}

export interface StockMovementData {
  id: string;
  productId: string;
  productName: string;
  kind: string;
  quantity: number;
  reason: string;
  note: string;
  operator: string;
  stockAfter: number;
  date: string;
  createdAt: string;
  /**
   * Se il movimento è una vendita, i dati per andarci sopra e capire chi l'ha
   * comprata. Non esiste sulle righe scritte a mano (uso interno, scaduto…).
   */
  vendita?: {
    transactionId: string;
    cliente: string;
    totale: number;
    ora: string;
    documento?: string;
  };
}

/** Scarico o carico di magazzino con motivo: aggiorna lo stock e registra il movimento. */
export async function recordStockMovement(params: {
  productId: string;
  kind: 'out' | 'in';
  quantity: number;
  reason: string;
  note?: string;
  operator?: string;
}): Promise<{ stock: number }> {
  const qty = Math.max(0, Math.floor(params.quantity));
  if (qty <= 0) throw new Error('Quantità non valida');

  const product = await prisma.product.findUnique({ where: { id: params.productId } });
  if (!product) throw new Error('Prodotto non trovato');

  const delta = params.kind === 'in' ? qty : -qty;
  const stockAfter = Math.max(0, product.stock + delta);

  await prisma.product.update({ where: { id: params.productId }, data: { stock: stockAfter } });

  const now = new Date();
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      productName: product.name,
      kind: params.kind,
      quantity: qty,
      reason: params.reason || 'altro',
      note: params.note || '',
      operator: params.operator || '',
      stockAfter,
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
    },
  });

  return { stock: stockAfter };
}

/** Storico movimenti: tutti, o solo di un prodotto se passato productId. */
export async function getStockMovements(productId?: string): Promise<StockMovementData[]> {
  /*
    Nello storico mancava metà della storia: le VENDITE.

    La cassa scala la giacenza direttamente (`product.update` con decrement) e
    non scrive nessun movimento, quindi qui dentro comparivano solo le righe
    fatte a mano — uso interno, scaduto, correzione. Apri lo storico di una
    crema, vedi "-1 uso interno" e non trovi le tre che hai venduto: sembra un
    ammanco, ed è solo un buco nel racconto.

    Invece di duplicare i dati (movimento + scontrino, che poi divergono), le
    righe di vendita si ricostruiscono da quello che è già scritto sulle
    transazioni: sono la stessa cosa, viste da un'altra parte. Ogni riga si
    porta dietro l'id della vendita, così ci si può cliccare sopra.
  */
  const [righe, vendite] = await Promise.all([
    prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.posTransaction.findMany({
      where: { productLines: { not: Prisma.DbNull } },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      take: 400,
      select: { id: true, date: true, time: true, clientName: true, total: true, productLines: true, c95Progressivo: true, isRefund: true },
    }),
  ]);

  const daVendite: StockMovementData[] = [];
  const nomi = new Map<string, string>();
  for (const v of vendite) {
    const linee = Array.isArray(v.productLines) ? (v.productLines as { productId?: string; qty?: number }[]) : [];
    for (const l of linee) {
      if (!l?.productId || !l.qty) continue;
      if (productId && l.productId !== productId) continue;
      if (!nomi.has(l.productId)) {
        const p = await prisma.product.findUnique({ where: { id: l.productId }, select: { name: true } });
        nomi.set(l.productId, p?.name || 'Prodotto eliminato');
      }
      daVendite.push({
        id: `vendita:${v.id}:${l.productId}`,
        productId: l.productId,
        productName: nomi.get(l.productId) as string,
        // Un reso rimette il prodotto dentro: è un carico, non uno scarico.
        kind: v.isRefund ? 'in' : 'out',
        quantity: Math.abs(l.qty),
        reason: v.isRefund ? 'reso' : 'vendita',
        note: v.clientName || 'Cliente occasionale',
        operator: '',
        // La giacenza dopo non si può ricostruire all'indietro senza inventare
        // numeri: si lascia a -1 e la schermata non la mostra.
        stockAfter: -1,
        date: v.date,
        createdAt: `${v.date}T${v.time || '00:00'}:00`,
        vendita: {
          transactionId: v.id,
          cliente: v.clientName || 'Cliente occasionale',
          totale: v.total,
          ora: v.time,
          documento: v.c95Progressivo || undefined,
        },
      });
    }
  }

  return [...(righe as unknown as StockMovementData[]), ...daVendite]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 300);
}
