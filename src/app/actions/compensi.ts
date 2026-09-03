'use server';

/**
 * Quanto si deve a ciascuna, a fine mese.
 *
 * La classifica delle ragazze diceva gia' chi aveva lavorato di piu'. Quello
 * che mancava era il passo dopo: tradurlo in euro da pagare. Si faceva a mano,
 * su un foglio, e il foglio non tornava mai con l'agenda.
 *
 * Il conto e' costruito su tre cose che il gestionale sa gia':
 *  - i trattamenti eseguiti (dall'agenda, riga per riga: se la pedicure l'ha
 *    fatta la collega, quei soldi sono suoi, non di chi teneva l'appuntamento);
 *  - i prodotti venduti in cassa (dal nome dell'operatrice sulla vendita);
 *  - le regole scritte sulla scheda di ognuna: percentuale, soglia, fisso.
 *
 * Lo sconto concordato si spalma sui trattamenti della seduta: se il conto e'
 * sceso, la provvigione scende con lui. Altrimenti si pagherebbe una
 * percentuale su soldi mai incassati.
 */

import { prisma } from '@/lib/prisma';
import type { AppointmentService } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface VoceCompenso {
  data: string;
  cliente: string;
  cosa: string;
  importo: number;
  tipo: 'trattamento' | 'prodotto';
}

export interface CompensoOperatrice {
  operatorId: string;
  nome: string;
  attiva: boolean;
  /** Le cabine automatiche eseguono trattamenti ma non prendono compensi. */
  risorsa: boolean;
  /** Le regole applicate, come stanno sulla sua scheda. */
  percentuale: number;
  percentualeProdotti: number;
  soglia: number;
  percentualeOltre: number;
  fisso: number;
  /** Quanto ha prodotto. */
  numeroTrattamenti: number;
  incassoTrattamenti: number;
  numeroProdotti: number;
  incassoProdotti: number;
  /** Il conto. */
  provvigioneTrattamenti: number;
  provvigioneProdotti: number;
  premioSoglia: number;
  totale: number;
  /** Le righe che compongono il conto, dalla piu' recente. */
  voci: VoceCompenso[];
}

export interface CompensiDelMese {
  mese: string;
  dal: string;
  al: string;
  righe: CompensoOperatrice[];
  totaleDaPagare: number;
  incassoTotale: number;
  /** Quanto hanno prodotto le cabine automatiche: lavoro senza compenso. */
  incassoRisorse: number;
  /** Quanto pesa il personale sull'incasso: la cifra che dice se il mese regge. */
  incidenza: number;
}

/** Primo e ultimo giorno del mese "YYYY-MM". */
function estremi(mese: string): { dal: string; al: string } {
  const [a, m] = mese.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { dal: `${mese}-01`, al: `${mese}-${String(ultimo).padStart(2, '0')}` };
}

export async function compensiDelMese(mese: string): Promise<CompensiDelMese> {
  const { dal, al } = estremi(mese);

  const [appuntamenti, vendite, operatrici] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: dal, lte: al }, status: 'completed' },
      select: {
        date: true, clientName: true, operatorId: true, operatorName: true,
        treatmentName: true, price: true, services: true, discountAmount: true,
      },
      orderBy: { date: 'desc' },
    }),
    prisma.posTransaction.findMany({
      where: { date: { gte: dal, lte: al }, isRefund: false },
      select: { date: true, clientName: true, operator: true, productLines: true, total: true },
      orderBy: { date: 'desc' },
    }),
    prisma.operator.findMany({ orderBy: { firstName: 'asc' } }),
  ]);

  const nomeDi = new Map(operatrici.map(o => [o.id, `${o.firstName} ${o.lastName}`.trim()]));
  const idDaNome = new Map(operatrici.map(o => [`${o.firstName} ${o.lastName}`.trim().toLowerCase(), o.id]));

  const righe = new Map<string, CompensoOperatrice>();
  const rigaDi = (id: string, nome: string): CompensoOperatrice => {
    let r = righe.get(id);
    if (!r) {
      const op = operatrici.find(o => o.id === id);
      r = {
        operatorId: id,
        nome: nome || 'Operatrice',
        attiva: op ? op.isActive : true,
        risorsa: op ? op.isResource : false,
        percentuale: op?.commission || 0,
        percentualeProdotti: op?.commissionProdotti || 0,
        soglia: op?.commissionSoglia || 0,
        percentualeOltre: op?.commissionOltre || 0,
        fisso: op?.compensoFisso || 0,
        numeroTrattamenti: 0, incassoTrattamenti: 0,
        numeroProdotti: 0, incassoProdotti: 0,
        provvigioneTrattamenti: 0, provvigioneProdotti: 0, premioSoglia: 0,
        totale: 0, voci: [],
      };
      righe.set(id, r);
    }
    return r;
  };

  // --- Trattamenti eseguiti ---------------------------------------------
  for (const a of appuntamenti) {
    const servizi = ((a.services as unknown as AppointmentService[] | null) || [])
      .filter(s => !s.productId);
    const lista = servizi.length > 0
      ? servizi
      : [{ treatmentName: a.treatmentName, price: a.price, operatorId: a.operatorId } as AppointmentService];

    /*
      Lo sconto della seduta si divide fra i trattamenti in proporzione al
      prezzo: chi ha fatto la parte piu' cara ne porta la fetta piu' grande.
    */
    const listino = lista.reduce((t, s) => t + (s.price || 0), 0);
    const fattore = listino > 0 && a.discountAmount
      ? Math.max(0, listino - a.discountAmount) / listino
      : 1;

    for (const s of lista) {
      const prezzo = round2((s.price || 0) * fattore);
      if (prezzo <= 0) continue; // seduta da pacchetto: gia' pagata quando il pacchetto e' stato venduto
      const opId = s.operatorId || a.operatorId;
      const r = rigaDi(opId, nomeDi.get(opId) || a.operatorName || 'Operatrice');
      r.numeroTrattamenti += 1;
      r.incassoTrattamenti += prezzo;
      r.voci.push({ data: a.date, cliente: a.clientName, cosa: s.treatmentName, importo: prezzo, tipo: 'trattamento' });
    }
  }

  // --- Prodotti venduti in cassa ----------------------------------------
  type Linea = { productId?: string; qty?: number };
  const idProdotti = new Set<string>();
  for (const v of vendite) {
    for (const l of (v.productLines as Linea[] | null) || []) if (l?.productId) idProdotti.add(l.productId);
  }
  const prodotti = idProdotti.size > 0
    ? await prisma.product.findMany({ where: { id: { in: [...idProdotti] } }, select: { id: true, name: true, price: true } })
    : [];
  const prodottoDi = new Map(prodotti.map(p => [p.id, p]));

  for (const v of vendite) {
    const linee = ((v.productLines as Linea[] | null) || []).filter(l => l?.productId && (l.qty || 0) > 0);
    if (linee.length === 0) continue;
    const nome = (v.operator || '').trim();
    const opId = idDaNome.get(nome.toLowerCase());
    // Senza un'operatrice riconosciuta la vendita non ha padrone: non si
    // inventa una riga di compenso a nome di nessuno.
    if (!opId) continue;
    const r = rigaDi(opId, nomeDi.get(opId) || nome);
    for (const l of linee) {
      const p = prodottoDi.get(l.productId as string);
      const qty = l.qty || 1;
      const importo = round2((p?.price || 0) * qty);
      if (importo <= 0) continue;
      r.numeroProdotti += qty;
      r.incassoProdotti += importo;
      r.voci.push({
        data: v.date, cliente: v.clientName || 'Cliente occasionale',
        cosa: `${p?.name || 'Prodotto'}${qty > 1 ? ` ×${qty}` : ''}`,
        importo, tipo: 'prodotto',
      });
    }
  }

  // Le operatrici senza niente questo mese restano in elenco a zero: un'assenza
  // dalla lista si legge come "non l'ho ancora fatto", non come "non ha fatto".
  for (const o of operatrici) {
    if (o.isResource) continue;
    rigaDi(o.id, `${o.firstName} ${o.lastName}`.trim());
  }

  // --- Il conto ---------------------------------------------------------
  const lista = [...righe.values()].map(r => {
    const prodotto = round2(r.incassoTrattamenti + r.incassoProdotti);
    /*
      La soglia premia il mese buono: fino alla soglia vale la percentuale
      normale, sopra vale quella maggiorata — e solo sulla parte sopra, come
      gli scaglioni. Cosi' un euro in piu' non ribalta tutto il conto.
    */
    const sopra = r.soglia > 0 && r.percentualeOltre > 0 && r.incassoTrattamenti > r.soglia
      ? r.incassoTrattamenti - r.soglia
      : 0;
    const base = round2(r.incassoTrattamenti - sopra);
    const provvigioneTrattamenti = round2((base * r.percentuale) / 100);
    const premioSoglia = round2((sopra * r.percentualeOltre) / 100);
    const provvigioneProdotti = round2((r.incassoProdotti * r.percentualeProdotti) / 100);
    return {
      ...r,
      incassoTrattamenti: round2(r.incassoTrattamenti),
      incassoProdotti: round2(r.incassoProdotti),
      provvigioneTrattamenti,
      provvigioneProdotti,
      premioSoglia,
      totale: round2(r.fisso + provvigioneTrattamenti + premioSoglia + provvigioneProdotti),
      voci: r.voci.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 400),
      prodotto,
    };
  }).sort((a, b) => b.totale - a.totale || b.incassoTrattamenti - a.incassoTrattamenti);

  const incassoTotale = round2(vendite.reduce((t, v) => t + v.total, 0));
  // Le cabine restano fuori dall'elenco dei compensi: a una macchina non si
  // paga la percentuale. Quello che ha prodotto si dice a parte, altrimenti
  // sembrerebbe sparito.
  const persone = lista.filter(r => !r.risorsa);
  const incassoRisorse = round2(lista.filter(r => r.risorsa).reduce((t, r) => t + r.incassoTrattamenti + r.incassoProdotti, 0));
  const totaleDaPagare = round2(persone.reduce((t, r) => t + r.totale, 0));

  return {
    mese, dal, al,
    righe: persone,
    incassoRisorse,
    totaleDaPagare,
    incassoTotale,
    incidenza: incassoTotale > 0 ? round2((totaleDaPagare / incassoTotale) * 100) : 0,
  };
}

/** Le regole di compenso di un'operatrice, dalla sua scheda. */
export async function salvaRegoleCompenso(operatorId: string, regole: {
  commission?: number;
  commissionProdotti?: number;
  commissionSoglia?: number;
  commissionOltre?: number;
  compensoFisso?: number;
}): Promise<{ ok: boolean }> {
  const pulito = (n: unknown) => Math.max(0, Number(n) || 0);
  await prisma.operator.update({
    where: { id: operatorId },
    data: {
      ...(regole.commission !== undefined ? { commission: pulito(regole.commission) } : {}),
      ...(regole.commissionProdotti !== undefined ? { commissionProdotti: pulito(regole.commissionProdotti) } : {}),
      ...(regole.commissionSoglia !== undefined ? { commissionSoglia: pulito(regole.commissionSoglia) } : {}),
      ...(regole.commissionOltre !== undefined ? { commissionOltre: pulito(regole.commissionOltre) } : {}),
      ...(regole.compensoFisso !== undefined ? { compensoFisso: pulito(regole.compensoFisso) } : {}),
    },
  });
  return { ok: true };
}
