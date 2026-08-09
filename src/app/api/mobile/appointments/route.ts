/**
 * Gli appuntamenti della cliente collegata: i prossimi e quelli passati.
 *
 * `canCancel` lo decide il server, non l'app: la regola delle 24 ore deve
 * valere anche se qualcuno chiama l'API a mano, e un telefono con l'orologio
 * sbagliato non deve poter disdire all'ultimo minuto.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { ORE_MINIME_DISDETTA, disdettabile } from '@/lib/mobileAppuntamenti';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const appuntamenti = await prisma.appointment.findMany({
    where: { clientId: cliente.id },
    select: {
      id: true, date: true, startTime: true, endTime: true, treatmentName: true,
      treatmentCategory: true, operatorName: true, status: true, price: true, isLocked: true,
    },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });

  const oggi = new Date().toISOString().slice(0, 10);
  const riga = (a: (typeof appuntamenti)[number]) => ({
    id: a.id,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    treatmentName: a.treatmentName,
    treatmentCategory: a.treatmentCategory,
    operatorName: a.operatorName,
    status: a.status,
    price: a.price,
    canCancel: disdettabile(a).ok,
  });

  // "Futuro" è ciò che deve ancora succedere e non è già stato annullato:
  // un appuntamento di domani già disdetto non va fra i prossimi.
  const futuri = appuntamenti.filter(a => a.date >= oggi && a.status !== 'cancelled' && a.status !== 'completed');

  return Response.json({
    upcoming: futuri.slice().reverse().map(riga), // i più vicini per primi
    past: appuntamenti.filter(a => !futuri.includes(a)).map(riga),
    regolaDisdettaOre: ORE_MINIME_DISDETTA,
  });
}
