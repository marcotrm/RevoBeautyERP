'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const TREATMENT_LABELS: Record<string, string> = {
  lampada: 'Lampada', pressoterapia: 'Pressoterapia', body_sculpting: 'Body Sculpting',
};

// Copia i contatti dell'inaugurazione nell'anagrafica Clienti (senza duplicati per telefono/email).
export async function importInaugurationLeadsToClients() {
  const leads = await prisma.inaugurationLead.findMany();
  const clients = await prisma.client.findMany();
  const normPhone = (p: string) => (p || '').replace(/[^\d]/g, '').slice(-9);
  const phones = new Set(clients.map(c => normPhone(c.phone)).filter(Boolean));
  const emails = new Set(clients.map(c => (c.email || '').toLowerCase()).filter(Boolean));

  let created = 0;
  for (const l of leads) {
    const p = normPhone(l.phone);
    const e = (l.email || '').toLowerCase();
    if ((p && phones.has(p)) || (e && emails.has(e))) continue; // già cliente
    await prisma.client.create({
      data: {
        firstName: l.firstName || 'Cliente',
        lastName: l.lastName || '',
        email: l.email || null,
        phone: l.phone || '',
        notes: `Da inaugurazione — interessata a ${TREATMENT_LABELS[l.treatment] || l.treatment}`,
        tags: ['Inaugurazione'],
        marketingConsent: true,
        createdAt: new Date().toISOString().split('T')[0],
      },
    });
    if (p) phones.add(p);
    if (e) emails.add(e);
    created++;
  }
  revalidatePath('/dashboard/clients');
  return { ok: true, created, total: leads.length };
}

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
