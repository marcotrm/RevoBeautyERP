'use server';

/**
 * Chi salta gli appuntamenti, per l'agenda.
 *
 * Una query sola per tutta la giornata, come per la corona: sono numeri che si
 * muovono di giorno in giorno. Torna solo chi è fuori soglia — l'elenco è
 * corto (due o tre nomi), e in agenda si cerca per id cliente.
 */

import { prisma } from '@/lib/prisma';
import { valutaAffidabilita, dalQuando, type Affidabilita } from '@/lib/affidabilita';

export interface ClienteARischio extends Affidabilita {
  clientId: string;
  nome: string;
}

export async function clientiARischio(): Promise<ClienteARischio[]> {
  const dal = dalQuando();
  const righe = await prisma.appointment.findMany({
    where: { date: { gte: dal }, status: { in: ['completed', 'cancelled', 'no_show'] } },
    select: { clientId: true, clientName: true, status: true, date: true },
  });

  const per = new Map<string, { nome: string; app: { status: string; date: string }[] }>();
  for (const a of righe) {
    if (!a.clientId) continue;
    const v = per.get(a.clientId) || { nome: (a.clientName || '').trim(), app: [] };
    v.app.push({ status: a.status, date: a.date });
    per.set(a.clientId, v);
  }

  const fuori: ClienteARischio[] = [];
  for (const [clientId, v] of per) {
    const giudizio = valutaAffidabilita(v.app, dal);
    if (giudizio.livello === 'ok') continue;
    fuori.push({ clientId, nome: v.nome, ...giudizio });
  }
  return fuori.sort((a, b) => b.mancati - a.mancati);
}
