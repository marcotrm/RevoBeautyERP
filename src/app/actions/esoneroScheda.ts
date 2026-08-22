'use server';

/**
 * "Non me li vuole dare."
 *
 * Il check-in si ferma quando mancano i dati della scheda, ed è giusto: è
 * l'unico momento in cui la cliente è davanti e glieli puoi chiedere. Ma
 * qualcuna dice di no, e a quel punto il blocco non protegge più niente —
 * costringe solo a inventare una data di nascita finta, che è peggio del
 * campo vuoto perché poi ci parte sopra un messaggio di auguri.
 *
 * Quindi la deroga esiste, ma è una per cliente e resta scritta: chi l'ha
 * concessa, quando, e perché. Non è un interruttore generale — se lo fosse,
 * fra un mese nessuno chiederebbe più i dati a nessuno.
 */

import { prisma } from '@/lib/prisma';

const KIND = 'cliente:esonero-scheda';

export interface EsoneroScheda {
  clientId: string;
  motivo: string;
  concessoDa: string;
  quando: string;
}

export async function esoneriScheda(): Promise<Record<string, EsoneroScheda>> {
  try {
    const righe = await prisma.adminEntry.findMany({ where: { kind: KIND } });
    const out: Record<string, EsoneroScheda> = {};
    for (const r of righe) {
      const d = (r.data || {}) as Partial<EsoneroScheda>;
      out[r.entityId] = {
        clientId: r.entityId,
        motivo: d.motivo || '',
        concessoDa: d.concessoDa || '',
        quando: d.quando || r.createdAt,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function esoneraScheda(params: {
  clientId: string; motivo?: string; concessoDa?: string;
}): Promise<{ ok: boolean }> {
  if (!params.clientId) return { ok: false };
  const valore: EsoneroScheda = {
    clientId: params.clientId,
    motivo: (params.motivo || '').trim() || 'Non vuole dare i dati',
    concessoDa: (params.concessoDa || '').trim(),
    quando: new Date().toISOString(),
  };
  await prisma.adminEntry.upsert({
    where: { rowId: `${KIND}:${params.clientId}` },
    update: { data: valore as unknown as object },
    create: {
      rowId: `${KIND}:${params.clientId}`, kind: KIND, entityId: params.clientId,
      data: valore as unknown as object, createdAt: new Date().toISOString(),
    },
  });
  return { ok: true };
}

/** Toglie la deroga: la prossima volta i dati si richiedono. */
export async function togliEsoneroScheda(clientId: string): Promise<{ ok: boolean }> {
  await prisma.adminEntry.deleteMany({ where: { rowId: `${KIND}:${clientId}` } });
  return { ok: true };
}
