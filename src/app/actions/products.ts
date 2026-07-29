'use server';

import { prisma } from '@/lib/prisma';
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
  const rows = await prisma.stockMovement.findMany({
    where: productId ? { productId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows as unknown as StockMovementData[];
}
