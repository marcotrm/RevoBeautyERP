'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Elimina un contatto dell'inaugurazione.
export async function deleteInaugurationLead(id: string) {
  if (!id) return { ok: false };
  try {
    await prisma.inaugurationLead.delete({ where: { id } });
    revalidatePath('/dashboard/settings/inaugurazione');
    return { ok: true };
  } catch (err) {
    console.error('[inaugurazione] delete failed', err);
    return { ok: false };
  }
}
