'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const TREATMENT_LABELS: Record<string, string> = {
  lampada: 'Lampada', pressoterapia: 'Pressoterapia', body_sculpting: 'Body Sculpting',
};

// Pacchetto OMAGGIO inaugurazione per ciascun trattamento scelto: gratis (0€), 1 seduta.
// Il nome contiene il trattamento REALE del catalogo così l'agenda lo abbina in automatico.
const FREE_PACKAGES: Record<string, { name: string; color: string; sessions: number }> = {
  lampada: { name: 'Lampada Total Body (Omaggio Inaugurazione)', color: '#F59E0B', sessions: 1 },
  pressoterapia: { name: 'Pressoterapia Infrarossi (Omaggio Inaugurazione)', color: '#14B8A6', sessions: 1 },
  body_sculpting: { name: 'Fast Tonic (Omaggio Inaugurazione)', color: '#A855F7', sessions: 1 },
};

const normPhone = (p: string) => (p || '').replace(/[^\d]/g, '').slice(-9);

// Copia i contatti dell'inaugurazione nell'anagrafica Clienti (senza duplicati per telefono/email)
// e assegna a ciascuno il pacchetto OMAGGIO del trattamento scelto (gratis, già pronto da scalare).
export async function importInaugurationLeadsToClients() {
  const leads = await prisma.inaugurationLead.findMany();
  const clients = await prisma.client.findMany();
  const today = new Date().toISOString().split('T')[0];
  const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let created = 0;
  let packages = 0;

  for (const l of leads) {
    const p = normPhone(l.phone);
    const e = (l.email || '').toLowerCase();

    // Trova il cliente esistente (per telefono o email) oppure crealo.
    let client = clients.find(c =>
      (p && normPhone(c.phone) === p) || (e && (c.email || '').toLowerCase() === e)
    );
    if (!client) {
      client = await prisma.client.create({
        data: {
          firstName: l.firstName || 'Cliente',
          lastName: l.lastName || '',
          email: l.email || null,
          phone: l.phone || '',
          notes: `Da inaugurazione — interessata a ${TREATMENT_LABELS[l.treatment] || l.treatment}`,
          tags: ['Inaugurazione'],
          marketingConsent: true,
          createdAt: today,
        },
      });
      clients.push(client);
      created++;
    }

    // Assegna il pacchetto omaggio del trattamento scelto (una sola volta per cliente/pacchetto).
    const cfg = FREE_PACKAGES[l.treatment];
    if (cfg) {
      const already = await prisma.clientPackage.findFirst({
        where: { clientId: client.id, packageName: cfg.name },
      });
      if (!already) {
        await prisma.clientPackage.create({
          data: {
            clientName: `${client.firstName} ${client.lastName}`.trim(),
            packageName: cfg.name,
            packageColor: cfg.color,
            totalSessions: cfg.sessions,
            usedSessions: 0,
            pricePaid: 0,
            totalPaid: 0,
            remainingBalance: 0,
            paymentPlan: 'full',
            purchaseDate: today,
            expiryDate: expiry,
            status: 'active',
            history: [],
            payments: [],
            clientId: client.id,
          },
        });
        packages++;
      }
    }
  }

  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/packages');
  return { ok: true, created, packages, total: leads.length };
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
