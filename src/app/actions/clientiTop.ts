'use server';

/**
 * Chi sono le clienti da coccolare, calcolato sugli incassi.
 *
 * Gira una volta all'apertura dell'agenda e vale per tutta la giornata: sono
 * numeri che si muovono di ora in ora, non di minuto in minuto.
 */

import { prisma } from '@/lib/prisma';
import { isInterno } from '@/lib/clientiInterni';
import { chiaveNome, scegliTop, MESI_STORIA, type ClienteTop } from '@/lib/clientiTop';

export async function clientiTop(): Promise<ClienteTop[]> {
  const da = new Date();
  da.setMonth(da.getMonth() - MESI_STORIA);
  const dal = da.toISOString().slice(0, 10);

  const [incassi, schede] = await Promise.all([
    prisma.posTransaction.findMany({
      where: { date: { gte: dal }, isRefund: false, total: { gt: 0 } },
      select: { clientName: true, total: true },
    }),
    prisma.client.findMany({ select: { firstName: true, lastName: true, tags: true } }),
  ]);

  // Le schede di casa (titolari, prove) non sono clienti: in cima all'elenco
  // per spesa c'è proprio una di quelle, e segnalarla sarebbe ridicolo.
  const interni = new Set(
    schede.filter(isInterno).map(c => chiaveNome(`${c.firstName} ${c.lastName}`)),
  );

  const per = new Map<string, { nome: string; speso: number; visite: number }>();
  for (const t of incassi) {
    const nome = (t.clientName || '').trim();
    const k = chiaveNome(nome);
    if (!k || k === 'cliente occasionale' || interni.has(k)) continue;
    const v = per.get(k) || { nome, speso: 0, visite: 0 };
    v.speso += t.total;
    v.visite++;
    per.set(k, v);
  }

  return scegliTop([...per.values()]);
}
