'use server';

import { prisma } from '@/lib/prisma';
import { Product } from '@/types';

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
