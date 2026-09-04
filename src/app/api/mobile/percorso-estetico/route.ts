/**
 * L'area privata dei risultati: percorsi, sedute condivise, foto (col
 * consenso), tappe. Ogni cliente vede SOLO il suo — il filtro dei campi
 * interni sta in lib/estetica, una volta sola per tutte le viste.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { percorsoPerCliente, consensoAttivo, registraAccesso } from '@/lib/estetica';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const [percorsi, consensoFoto, checkup] = await Promise.all([
    prisma.percorsoEstetico.findMany({
      where: { clientId: cliente.id },
      orderBy: { createdAt: 'desc' },
      include: {
        sedute: { orderBy: { numero: 'asc' } },
        foto: { orderBy: { scattataIl: 'asc' } },
      },
    }),
    consensoAttivo(cliente.id, 'foto-percorso'),
    prisma.checkupEstetico.findFirst({
      where: { clientId: cliente.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, verificatoIl: true, createdAt: true },
    }),
  ]);

  // Il prossimo appuntamento in agenda, per la riga "prossima seduta".
  const oggi = new Date().toISOString().slice(0, 10);
  const prossimo = await prisma.appointment.findFirst({
    where: { clientId: cliente.id, date: { gte: oggi }, status: { in: ['confirmed', 'pending'] } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: { id: true, date: true, startTime: true, treatmentName: true, operatorName: true },
  });

  if (percorsi.some((p) => p.foto.length > 0) && consensoFoto) {
    await registraAccesso('cliente', cliente.id, 'foto-viste');
  }

  return Response.json({
    percorsi: percorsi.map((p) => percorsoPerCliente(p, p.sedute, p.foto, consensoFoto)),
    consensoFoto,
    prossimoAppuntamento: prossimo,
    checkup: checkup && {
      fatto: true,
      verificato: Boolean(checkup.verificatoIl),
      creatoIl: checkup.createdAt,
    },
  });
}
