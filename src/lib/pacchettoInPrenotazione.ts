/**
 * Il pacchetto entra in prenotazione: se la cliente ha sedute già pagate
 * per quel trattamento, l'appuntamento deve nascere a 0 € con l'etichetta
 * «📦 Seduta da pacchetto» — la stessa che al check-out fa scalare la
 * seduta da sola, senza domande e senza rischio di farla pagare due volte.
 *
 * Il criterio di combaciamento è UNO, quello di coperturaPacchetto: se
 * l'agenda e la prenotazione rispondessero in modo diverso alla stessa
 * domanda, il banco non saprebbe a chi credere.
 */

import { prisma } from './prisma';
import { coperturaPacchetto, type PacchettoCliente } from './coperturaPacchetto';

export interface CoperturaPrenotazione {
  packageName: string;
  rimaste: number;
  totali: number;
}

/** I pacchetti attivi della cliente, nella forma che coperturaPacchetto capisce. */
export async function pacchettiAttivi(clientId: string): Promise<PacchettoCliente[]> {
  const righe = await prisma.clientPackage.findMany({
    where: { clientId, status: 'active' },
    select: {
      clientId: true, clientName: true, packageName: true,
      totalSessions: true, usedSessions: true, pricePaid: true, status: true,
    },
  });
  return righe.map((p) => ({ ...p, pricePaid: p.pricePaid ?? 0 }));
}

/**
 * Il pacchetto che coprirebbe questo trattamento, se c'è.
 * `giaImpegnate` scala le sedute già promesse in questa stessa prenotazione
 * (due pressoterapie nella stessa seduta non possono valere una sola rimasta).
 */
export function pacchettoCheCopre(
  clientId: string,
  treatmentName: string,
  pacchetti: PacchettoCliente[],
  giaImpegnate: Map<string, number> = new Map(),
): CoperturaPrenotazione | null {
  const disponibili = pacchetti.filter(
    (p) => p.totalSessions - p.usedSessions - (giaImpegnate.get(p.packageName) ?? 0) > 0
  );
  const cov = coperturaPacchetto(
    // price 0 = la domanda è "SAREBBE coperto?", non "è già a zero?"
    { clientId, clientName: '', treatmentName, price: 0 },
    disponibili,
  );
  if (!cov) return null;
  return {
    packageName: cov.packageName,
    rimaste: cov.rimaste - (giaImpegnate.get(cov.packageName) ?? 0),
    totali: cov.totali,
  };
}
