/**
 * Beauty Passport: l'anno della cliente in numeri e ricordi.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const anno = new Date().getFullYear();
  const inizioAnno = `${anno}-01-01`;

  const [sedute, puntiAnno, amiche, pacchettiFiniti, badge, primaVolta] = await Promise.all([
    prisma.appointment.findMany({
      where: { clientId: cliente.id, status: 'completed', date: { gte: inizioAnno } },
      select: { treatmentName: true, treatmentCategory: true },
    }),
    prisma.loyaltyMovement.aggregate({
      where: { clientId: cliente.id, kind: 'points', amount: { gt: 0 }, createdAt: { gte: inizioAnno } },
      _sum: { amount: true },
    }),
    prisma.client.count({ where: { referredBy: cliente.id } }),
    prisma.clientPackage.count({
      where: { clientId: cliente.id, usedSessions: { gte: prisma.clientPackage.fields.totalSessions } },
    }),
    prisma.clientBadge.findMany({
      where: { clientId: cliente.id },
      select: { codice: true, nome: true, assegnatoAt: true },
    }),
    prisma.appointment.findFirst({
      where: { clientId: cliente.id, status: 'completed' },
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
  ]);

  // Sedute per area: le barre del passaporto
  const perArea = new Map<string, number>();
  for (const s of sedute) {
    const area = s.treatmentCategory || 'Altro';
    perArea.set(area, (perArea.get(area) ?? 0) + 1);
  }

  return Response.json({
    anno,
    clienteDal: primaVolta?.date ?? null,
    sedute: sedute.length,
    serviziProvati: new Set(sedute.map((s) => s.treatmentName)).size,
    puntiGuadagnati: puntiAnno._sum.amount ?? 0,
    amichePortate: amiche,
    percorsiCompletati: pacchettiFiniti,
    perArea: [...perArea.entries()]
      .map(([area, volte]) => ({ area, volte }))
      .sort((a, b) => b.volte - a.volte),
    badge,
  });
}
