/**
 * I percorsi della cliente: sedute fatte, residue e quando tornare.
 *
 * "Prossima consigliata" non è una data inventata: si guarda ogni quanto la
 * cliente ha davvero fatto le sedute di quel pacchetto e si somma quel ritmo
 * all'ultima. Se le sedute sono troppo poche per parlare di ritmo, non si
 * consiglia niente invece di suggerire a caso.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { traccia } from '@/lib/appEvents';

const GIORNO = 86400000;

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const pacchetti = await prisma.clientPackage.findMany({
    where: { clientId: cliente.id },
    orderBy: { purchaseDate: 'desc' },
  });

  const percorsi = pacchetti.map(p => {
    const storico = (Array.isArray(p.history) ? p.history : []) as { date?: string; operator?: string; note?: string }[];
    const date = storico.map(h => h.date).filter(Boolean).sort() as string[];
    const ultima = date[date.length - 1] ?? null;

    let ogniGiorni: number | null = null;
    if (date.length >= 2) {
      let somma = 0;
      for (let i = 1; i < date.length; i++) somma += (Date.parse(date[i]) - Date.parse(date[i - 1])) / GIORNO;
      const media = Math.round(somma / (date.length - 1));
      if (media > 0 && media < 180) ogniGiorni = media;
    }

    const residue = p.totalSessions - p.usedSessions;
    const prossimaConsigliata = ultima && ogniGiorni && residue > 0
      ? new Date(Date.parse(ultima) + ogniGiorni * GIORNO).toISOString().slice(0, 10)
      : null;

    return {
      id: p.id,
      nome: p.packageName,
      colore: p.packageColor,
      totali: p.totalSessions,
      fatte: p.usedSessions,
      residue,
      stato: p.status,
      omaggio: p.pricePaid === 0,
      prezzo: p.pricePaid,
      pagato: p.totalPaid,
      daPagare: p.remainingBalance,
      acquisto: p.purchaseDate,
      scadenza: p.expiryDate,
      ultimaSeduta: ultima,
      ogniGiorni,
      prossimaConsigliata,
      /** La timeline del Beauty Journey: una tappa per seduta svolta. */
      tappe: storico
        .filter(h => h.date)
        .map((h, i) => ({ numero: i + 1, data: h.date!, operatrice: h.operator ?? null, nota: h.note ?? null })),
    };
  });

  await traccia({ clientId: cliente.id, type: 'view', surface: 'percorsi' });

  return Response.json({
    attivi: percorsi.filter(p => p.stato === 'active' && p.residue > 0),
    conclusi: percorsi.filter(p => p.stato !== 'active' || p.residue <= 0),
  });
}
