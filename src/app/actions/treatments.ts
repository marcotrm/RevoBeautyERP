'use server';

import { prisma } from '@/lib/prisma';
import { Treatment } from '@/types';

export async function getTreatments() {
  const treatments = await prisma.treatment.findMany({ orderBy: { name: 'asc' } });
  return treatments as unknown as Treatment[];
}

export async function createTreatment(data: Treatment) {
  const treatment = await prisma.treatment.create({ data });
  return treatment as unknown as Treatment;
}

export async function updateTreatment(id: string, updates: Partial<Treatment>) {
  const treatment = await prisma.treatment.update({ where: { id }, data: updates });
  return treatment as unknown as Treatment;
}

export async function deleteTreatment(id: string) {
  await prisma.treatment.delete({ where: { id } });
  return true;
}
