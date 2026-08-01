'use server';

/**
 * Classifica upsell delle estetiste.
 *
 * Upsell = trattamento aggiunto all'appuntamento quando la cliente era già in
 * cabina (il flag `upsell` lo mette l'agenda al momento dell'aggiunta): la
 * cliente era venuta per la ceretta braccia, l'estetista le ha venduto anche
 * le gambe. Il merito va a chi ESEGUE il trattamento aggiunto (che in cabina
 * è quasi sempre chi l'ha proposto).
 *
 * Nota: il conteggio parte da quando il flag esiste — gli appuntamenti vecchi
 * non dicono se un trattamento fu aggiunto in cabina o prenotato da subito.
 */

import { prisma } from '@/lib/prisma';
import type { AppointmentService } from '@/types';

export interface VoceUpsell {
  data: string;       // giorno YYYY-MM-DD
  cliente: string;
  trattamento: string;
  prezzo: number;
}

export interface RigaClassificaUpsell {
  operatorId: string;
  nome: string;
  numero: number;   // quanti trattamenti venduti in cabina
  valore: number;   // per quanti euro
  voci: VoceUpsell[]; // il dettaglio, più recenti prima
}

/** Classifica upsell nel periodo [dal, al] (giorni YYYY-MM-DD inclusi). */
export async function classificaUpsell(dal: string, al: string): Promise<RigaClassificaUpsell[]> {
  const [appuntamenti, operatrici] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: dal, lte: al }, status: { notIn: ['cancelled', 'no_show'] } },
      select: { date: true, clientName: true, operatorId: true, services: true },
      orderBy: { date: 'desc' },
    }),
    prisma.operator.findMany({ select: { id: true, firstName: true, lastName: true } }),
  ]);

  const nomeDi = new Map(operatrici.map(o => [o.id, `${o.firstName} ${o.lastName}`.trim()]));
  const righe = new Map<string, RigaClassificaUpsell>();

  for (const a of appuntamenti) {
    const services = (a.services as unknown as AppointmentService[] | null) || [];
    for (const s of services) {
      if (!s.upsell) continue;
      const opId = s.operatorId || a.operatorId;
      let riga = righe.get(opId);
      if (!riga) {
        riga = { operatorId: opId, nome: nomeDi.get(opId) || 'Operatrice', numero: 0, valore: 0, voci: [] };
        righe.set(opId, riga);
      }
      riga.numero += 1;
      riga.valore += s.price || 0;
      riga.voci.push({ data: a.date, cliente: a.clientName, trattamento: s.treatmentName, prezzo: s.price || 0 });
    }
  }

  return [...righe.values()]
    .map(r => ({ ...r, valore: Math.round(r.valore * 100) / 100 }))
    .sort((x, y) => y.numero - x.numero || y.valore - x.valore);
}
