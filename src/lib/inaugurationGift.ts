// Pacchetto OMAGGIO inaugurazione: 1 seduta gratis del trattamento scelto.
// Il nome contiene il trattamento REALE del catalogo così l'agenda lo abbina da sola.
// Condiviso tra l'API pubblica dei lead e l'import manuale in anagrafica.
import { prisma } from '@/lib/prisma';
import { FREE_PACKAGES } from '@/lib/giftOptions';

export { FREE_PACKAGES };

/**
 * Assegna a un cliente il pacchetto omaggio del trattamento scelto.
 * Idempotente: se ce l'ha già non lo duplica. Non lancia mai.
 */
export async function ensureGiftPackage(clientId: string, treatment: string): Promise<boolean> {
  const cfg = FREE_PACKAGES[treatment];
  if (!cfg || !clientId) return false;
  try {
    const already = await prisma.clientPackage.findFirst({ where: { clientId, packageName: cfg.name } });
    if (already) return false;

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } });
    if (!client) return false;

    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        clientId,
      },
    });
    return true;
  } catch (err) {
    console.error('[inaugurazione] assegnazione omaggio fallita', err);
    return false;
  }
}
