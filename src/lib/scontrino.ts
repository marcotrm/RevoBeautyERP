/**
 * Scontrino elettronico su una riga di cassa, ovunque nasca l'incasso.
 *
 * Prima l'emissione viveva solo dentro la vendita della Cassa: chi pagava un
 * pacchetto (vendita o rata) finiva in cassa senza scontrino, perché quel
 * percorso scriveva la transazione per conto suo. Qui c'è l'unico punto che
 * emette e aggiorna la riga: lo usano la Cassa e i pacchetti, e chi aggiunge
 * un nuovo modo di incassare deve passare da qui.
 *
 * Best-effort come sempre: se C95 non è configurato o fallisce, l'incasso
 * resta valido e l'esito resta tracciato sulla transazione (c95Status).
 */

import { prisma } from '@/lib/prisma';
import { emitC95Receipt, getC95Config } from '@/lib/c95';

export interface RigaCassaPerScontrino {
  id: string;
  total: number;
  paymentMethod: string;
}

/**
 * Emette lo scontrino per una transazione già scritta in cassa e ne aggiorna
 * lo stato fiscale. Torna la riga aggiornata, o null se non c'era niente da
 * emettere (importo zero, C95 spento) o se qualcosa è andato storto.
 */
export async function emettiScontrinoElettronico(
  tx: RigaCassaPerScontrino,
  descrizione: string
) {
  if (!tx.total || tx.total <= 0) return null;
  try {
    const cfg = await getC95Config();
    if (!cfg.enabled) return null;

    const result = await emitC95Receipt({
      amount: tx.total,
      paymentMethod: tx.paymentMethod,
      lines: [{ descrizione: descrizione.slice(0, 100) || 'Servizi/prodotti', prezzoUnitario: tx.total, quantita: 1 }],
    });

    return await prisma.posTransaction.update({
      where: { id: tx.id },
      data: {
        c95Status: result.status,
        c95Emitted: result.status === 'emitted',
        c95IdScontrino: result.idScontrino,
        c95Gid: result.gid,
        c95Idtrx: result.idtrx,
        c95Progressivo: result.progressivo,
        c95Error: result.error,
      },
    });
  } catch {
    // integrazione non configurata o errore imprevisto: l'incasso resta valido
    return null;
  }
}
