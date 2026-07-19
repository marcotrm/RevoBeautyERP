'use server';

import { prisma } from '@/lib/prisma';

// CRUD generico condiviso per i record di Amministrazione.
// Ogni record è un oggetto JSON che contiene il proprio identificatore nel campo indicato da idField.

export async function getAdminEntries(kind: string): Promise<Record<string, unknown>[]> {
  const rows = await prisma.adminEntry.findMany({ where: { kind }, orderBy: { createdAt: 'asc' } });
  return rows.map(r => r.data as Record<string, unknown>);
}

export async function createAdminEntry(kind: string, obj: Record<string, unknown>, idField = 'id') {
  const entityId = String(obj[idField]);
  await prisma.adminEntry.create({
    data: { rowId: `${kind}:${entityId}`, kind, entityId, data: obj as object, createdAt: new Date().toISOString() },
  });
  return obj;
}

export async function updateAdminEntry(kind: string, entityId: string, updates: Record<string, unknown>) {
  const existing = await prisma.adminEntry.findUnique({ where: { rowId: `${kind}:${entityId}` } });
  const merged = { ...(existing?.data as Record<string, unknown> || {}), ...updates };
  await prisma.adminEntry.upsert({
    where: { rowId: `${kind}:${entityId}` },
    update: { data: merged as object },
    create: { rowId: `${kind}:${entityId}`, kind, entityId, data: merged as object, createdAt: new Date().toISOString() },
  });
  return merged;
}

export async function deleteAdminEntry(kind: string, entityId: string) {
  await prisma.adminEntry.deleteMany({ where: { rowId: `${kind}:${entityId}` } });
  return true;
}

// Migrazione una-tantum da localStorage → DB. Salta gli id già presenti e (opzionalmente) i record demo.
export async function migrateAdminEntries(kind: string, list: Record<string, unknown>[], idField = 'id', seedIds: string[] = []) {
  const existing = await prisma.adminEntry.findMany({ where: { kind } });
  const seen = new Set(existing.map(e => e.entityId));
  const seedSet = new Set(seedIds);
  let inserted = 0;
  for (const obj of list) {
    const entityId = String(obj[idField]);
    if (!entityId || entityId === 'undefined') continue;
    if (seedSet.has(entityId)) continue;
    if (seen.has(entityId)) continue;
    await prisma.adminEntry.create({
      data: { rowId: `${kind}:${entityId}`, kind, entityId, data: obj as object, createdAt: new Date().toISOString() },
    });
    seen.add(entityId);
    inserted++;
  }
  return inserted;
}
