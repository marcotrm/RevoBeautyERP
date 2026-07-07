import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Svuota le tabelle operative (clienti, appuntamenti, pacchetti, buoni regalo,
// transazioni cassa, operatori, trattamenti) senza reseed. Protetto da un
// secret letto da env, da chiamare una tantum dopo il deploy.
export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (!process.env.ADMIN_RESET_SECRET || secret !== process.env.ADMIN_RESET_SECRET) {
    return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  }

  await prisma.appointment.deleteMany();
  await prisma.clientPackage.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.posTransaction.deleteMany();
  await prisma.client.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.package.deleteMany();

  return Response.json({ success: true });
}
