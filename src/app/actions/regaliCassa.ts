'use server';

/**
 * Il regalo, ricordato al banco mentre paga.
 *
 * Il momento in cui una cliente e' davanti alla cassa e' l'unico in cui il
 * regalo si puo' davvero consegnare: dopo se ne va, e quel prodotto resta
 * sullo scaffale col suo nome sopra per settimane. L'icona in alto lampeggia
 * per tutte, ma qui la domanda e' un'altra e piu' stretta: QUESTA cliente,
 * adesso, ha qualcosa da ritirare?
 *
 * Due cose diverse, e vanno tenute separate:
 *  - ha gia' riscattato e il regalo aspetta: e' roba sua, pagata coi punti,
 *    va data prima che esca dalla porta;
 *  - non ha riscattato niente ma i punti le bastano: non e' un dovere, e'
 *    un'occasione da dirle a voce — e detta alla cassa vale il doppio,
 *    perche' e' li' che si accorge di avere qualcosa in mano.
 */

import { prisma } from '@/lib/prisma';
import { saldoPunti } from '@/lib/wallet';

export interface RegaloDaConsegnare {
  id: string;
  nome: string;
  punti: number;
  codice: string;
  tipo: string;
  createdAt: string;
}

export interface RegaloAllaPortata {
  nome: string;
  punti: number;
  tipo: 'prodotto' | 'trattamento';
}

export interface RegaliInCassa {
  daConsegnare: RegaloDaConsegnare[];
  punti: number;
  allaPortata: RegaloAllaPortata[];
}

const VUOTO: RegaliInCassa = { daConsegnare: [], punti: 0, allaPortata: [] };

export async function regaliInCassa(clientId: string | null | undefined): Promise<RegaliInCassa> {
  if (!clientId) return VUOTO;

  const [daConsegnare, punti] = await Promise.all([
    prisma.riscattoPremio.findMany({
      where: { clientId, stato: 'da_ritirare' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nomeProdotto: true, punti: true, codice: true, tipo: true, createdAt: true },
    }),
    saldoPunti(clientId),
  ]);

  const regali = daConsegnare.map(r => ({
    id: r.id, nome: r.nomeProdotto, punti: r.punti, codice: r.codice,
    tipo: r.tipo, createdAt: r.createdAt,
  }));

  /*
    L'occasione si dice solo quando non c'e' gia' un regalo che aspetta: se
    ne ha uno da ritirare, quello e' l'unico messaggio che deve arrivare.
    Due avvisi insieme, alla cassa, con la cliente davanti, non li legge
    nessuno — e si perde proprio quello che andava fatto.
  */
  if (regali.length > 0) return { daConsegnare: regali, punti, allaPortata: [] };

  const [regoleProdotto, regoleTratt] = await Promise.all([
    prisma.premioProdotto.findMany({ where: { attivo: true, punti: { lte: punti } }, orderBy: { punti: 'desc' } }),
    prisma.premioTrattamento.findMany({ where: { attivo: true, punti: { lte: punti } }, orderBy: { punti: 'desc' } }),
  ]);

  const [prodotti, trattamenti] = await Promise.all([
    prisma.product.findMany({
      // Solo quello che c'e' davvero: promettere una crema esaurita e'
      // peggio che non dire niente.
      where: { id: { in: regoleProdotto.map(r => r.productId) }, isActive: true, stock: { gt: 0 } },
      select: { id: true, name: true, brand: true },
    }),
    prisma.treatment.findMany({
      where: { id: { in: regoleTratt.map(r => r.treatmentId) }, isActive: true },
      select: { id: true, name: true },
    }),
  ]);
  const prodottoDi = new Map(prodotti.map(p => [p.id, p]));
  const trattamentoDi = new Map(trattamenti.map(t => [t.id, t]));

  const allaPortata: RegaloAllaPortata[] = [
    ...regoleProdotto.flatMap(r => {
      const p = prodottoDi.get(r.productId);
      return p ? [{ nome: `${p.brand ? `${p.brand} ` : ''}${p.name}`.trim(), punti: r.punti, tipo: 'prodotto' as const }] : [];
    }),
    ...regoleTratt.flatMap(r => {
      const t = trattamentoDi.get(r.treatmentId);
      return t ? [{ nome: t.name, punti: r.punti, tipo: 'trattamento' as const }] : [];
    }),
  ].sort((a, b) => b.punti - a.punti);

  return { daConsegnare: [], punti, allaPortata };
}
