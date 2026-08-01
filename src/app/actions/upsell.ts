'use server';

/**
 * Classifica upsell delle estetiste. Due modi di vendere in più:
 *
 *  - TRATTAMENTI: aggiunti all'appuntamento quando la cliente era già in
 *    cabina (flag `upsell` messo dall'agenda al momento dell'aggiunta). La
 *    cliente era venuta per la ceretta braccia, è uscita anche con le gambe.
 *    Il merito va a chi esegue il trattamento aggiunto.
 *  - PRODOTTI: creme e prodotti battuti in cassa. Un prodotto non si prenota
 *    mai, si vende sempre a voce: è upsell per definizione, e il merito va
 *    all'operatrice della vendita.
 *
 * Nota: il conteggio dei trattamenti parte da quando esiste il flag — gli
 * appuntamenti vecchi non dicono se un trattamento fu aggiunto in cabina.
 */

import { prisma } from '@/lib/prisma';
import type { AppointmentService } from '@/types';

export interface VoceUpsell {
  data: string;       // giorno YYYY-MM-DD
  cliente: string;
  trattamento: string; // cosa è stato venduto (trattamento o prodotto)
  prezzo: number;
  tipo: 'trattamento' | 'prodotto';
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
  const [appuntamenti, vendite, operatrici] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: dal, lte: al }, status: { notIn: ['cancelled', 'no_show'] } },
      select: { date: true, clientName: true, operatorId: true, services: true },
      orderBy: { date: 'desc' },
    }),
    prisma.posTransaction.findMany({
      where: { date: { gte: dal, lte: al }, isRefund: false },
      select: { date: true, clientName: true, operator: true, productLines: true },
      orderBy: { date: 'desc' },
    }),
    prisma.operator.findMany({ select: { id: true, firstName: true, lastName: true } }),
  ]);

  const nomeDi = new Map(operatrici.map(o => [o.id, `${o.firstName} ${o.lastName}`.trim()]));
  // La cassa salva l'operatrice per nome, non per id: si riaggancia qui.
  const idDaNome = new Map(operatrici.map(o => [`${o.firstName} ${o.lastName}`.trim().toLowerCase(), o.id]));
  const righe = new Map<string, RigaClassificaUpsell>();

  const rigaDi = (operatorId: string, nome: string) => {
    let riga = righe.get(operatorId);
    if (!riga) {
      riga = { operatorId, nome, numero: 0, valore: 0, voci: [] };
      righe.set(operatorId, riga);
    }
    return riga;
  };

  // --- Trattamenti venduti in cabina -----------------------------------
  for (const a of appuntamenti) {
    const services = (a.services as unknown as AppointmentService[] | null) || [];
    for (const s of services) {
      if (!s.upsell) continue;
      // I prodotti nel carrello della seduta si contano SOLO quando vengono
      // incassati (dalle righe di cassa qui sotto): niente doppioni.
      if (s.productId) continue;
      const opId = s.operatorId || a.operatorId;
      const riga = rigaDi(opId, nomeDi.get(opId) || 'Operatrice');
      riga.numero += 1;
      riga.valore += s.price || 0;
      riga.voci.push({ data: a.date, cliente: a.clientName, trattamento: s.treatmentName, prezzo: s.price || 0, tipo: 'trattamento' });
    }
  }

  // --- Prodotti battuti in cassa ---------------------------------------
  type LineaProdotto = { productId?: string; qty?: number };
  const idProdotti = new Set<string>();
  for (const v of vendite) {
    for (const l of (v.productLines as LineaProdotto[] | null) || []) {
      if (l?.productId) idProdotti.add(l.productId);
    }
  }
  const prodotti = idProdotti.size > 0
    ? await prisma.product.findMany({ where: { id: { in: [...idProdotti] } }, select: { id: true, name: true, price: true } })
    : [];
  const prodottoDi = new Map(prodotti.map(p => [p.id, p]));

  for (const v of vendite) {
    const linee = ((v.productLines as LineaProdotto[] | null) || []).filter(l => l?.productId && (l.qty || 0) > 0);
    if (linee.length === 0) continue;
    const nomeOp = (v.operator || '').trim();
    const opId = idDaNome.get(nomeOp.toLowerCase()) || (nomeOp ? `nome:${nomeOp.toLowerCase()}` : 'nome:cassa');
    const riga = rigaDi(opId, nomeOp || 'Cassa');
    for (const l of linee) {
      const p = prodottoDi.get(l.productId!);
      const qty = l.qty || 1;
      riga.numero += 1;
      riga.valore += (p?.price || 0) * qty;
      riga.voci.push({
        data: v.date,
        cliente: v.clientName || 'Cliente occasionale',
        trattamento: `${p?.name || 'Prodotto'}${qty > 1 ? ` ×${qty}` : ''}`,
        prezzo: (p?.price || 0) * qty,
        tipo: 'prodotto',
      });
    }
  }

  return [...righe.values()]
    .map(r => ({
      ...r,
      valore: Math.round(r.valore * 100) / 100,
      voci: r.voci.sort((a, b) => b.data.localeCompare(a.data)),
    }))
    .sort((x, y) => y.numero - x.numero || y.valore - x.valore);
}
