'use server';

import { prisma } from '@/lib/prisma';
import { Treatment } from '@/types';

/**
 * Trattamenti a listino.
 *
 * Eliminare un trattamento non cancella la riga ma la disattiva (`isActive`),
 * altrimenti sparirebbero anche gli appuntamenti che la usano. Il filtro va
 * quindi messo QUI: senza, i trattamenti eliminati riapparivano nel gestionale
 * al primo ricaricamento, come se la cancellazione non fosse mai avvenuta.
 */
export async function getTreatments() {
  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
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
