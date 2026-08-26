'use server';

/**
 * Il conto economico del centro, sui numeri veri.
 *
 * In Amministrazione c'erano già le pagine Cash Flow e Report, ma giravano su
 * dati inventati: un saldo scritto nel codice, quattro settimane finte, un
 * grafico che non ha mai letto una transazione. Servono a niente — anzi,
 * peggio: sembrano veri.
 *
 * Qui non c'è un solo numero inventato. Tutto viene da quello che il
 * gestionale registra davvero: gli incassi di cassa, i costi fissi
 * dichiarati, le spese dei soci, gli investimenti.
 *
 * Sull'IVA una precisazione che conta. Il centro lavora al dettaglio: i
 * prezzi a listino sono già ivati, quindi l'IVA non si aggiunge all'incasso —
 * si tira fuori da dentro (scorporo). Su 100 € incassati con l'aliquota al
 * 22%, l'imponibile è 81,97 e l'IVA 18,03: quei 18,03 sono soldi dello Stato
 * che stanno nel cassetto e vanno messi da parte, non guadagno.
 */

import { prisma } from '@/lib/prisma';
import { getReceiptVatRate } from '@/app/actions/c95';
import { dataApertura } from '@/lib/apertura';
import { filtroInterni } from '@/lib/clientiInterni';

export interface PeriodoConti {
  dal: string;
  al: string;
}

/** Scorporo: da un prezzo già ivato tira fuori imponibile e imposta. */
function scorpora(ivato: number, aliquota: number) {
  const imponibile = ivato / (1 + aliquota / 100);
  return {
    imponibile: Math.round(imponibile * 100) / 100,
    iva: Math.round((ivato - imponibile) * 100) / 100,
  };
}

const CONTANTI = ['contanti'];
/** Cosa lascia traccia in banca: serve a sapere quanto entra davvero sul conto. */
const TRACCIATI = ['carta', 'pos', 'bancomat', 'satispay', 'bonifico'];

export interface RigaMese {
  mese: string;
  ivato: number;
  imponibile: number;
  iva: number;
  costi: number;
  margine: number;
}

export interface ContoEconomico {
  periodo: PeriodoConti;
  aliquota: number;

  /** Quello che è entrato in cassa, IVA compresa: è la cifra che si vede. */
  ivato: number;
  /** Il ricavo vero, tolta l'IVA. È su questo che si ragiona. */
  imponibile: number;
  /** L'IVA incassata per conto dello Stato: da mettere da parte. */
  iva: number;
  incassi: number;

  contanti: number;
  tracciati: number;
  altriMetodi: number;

  /** Costi fissi di competenza del periodo (l'affitto non è un evento, è un rateo). */
  costiFissi: number;
  /** Spese anticipate dai soci nel periodo, al netto dei finanziamenti. */
  speseSoci: number;
  /**
   * Investimenti pagati nel periodo: il centro comprato, i macchinari,
   * l'insegna. Non sono costi del mese e restano fuori dal margine.
   */
  investimenti: number;
  /** Soldi messi dai soci nel periodo: entrano, non escono. */
  finanziamentiSoci: number;
  costiTotali: number;

  /** Imponibile meno costi: quello che resta prima di tasse e contributi. */
  margine: number;
  marginePercento: number;

  /** Contanti fisici in cassaforte, oggi. */
  cassaforte: number;

  mesi: RigaMese[];
  costiPerVoce: { nome: string; importo: number; tipo: 'fisso' | 'soci' | 'investimento' }[];
  giorni: { data: string; ivato: number; incassi: number }[];
}

interface CostoFisso {
  name?: string; amount?: number; isActive?: boolean;
  frequency?: string; category?: string;
}

interface Investimento {
  name?: string; totalCost?: number; date?: string; status?: string;
}

/** Quanti mesi (anche a metà) copre il periodo: i costi fissi si spalmano. */
function mesiCoperti(dal: string, al: string): number {
  const a = new Date(`${dal}T12:00:00Z`).getTime();
  const b = new Date(`${al}T12:00:00Z`).getTime();
  const giorni = Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  return giorni / 30.44; // media dei giorni in un mese
}

export async function contoEconomico(periodo: PeriodoConti): Promise<ContoEconomico> {
  const [aliquota, apertura, interni, righeGrezze, righeAdmin, spese, movimenti] = await Promise.all([
    getReceiptVatRate(),
    dataApertura(),
    filtroInterni(prisma),
    prisma.posTransaction.findMany({ where: { date: { gte: periodo.dal, lte: periodo.al } } }),
    prisma.adminEntry.findMany({ where: { kind: { in: ['fixed_cost', 'investment'] } } }),
    prisma.partnerExpense.findMany(),
    prisma.cassaMovement.findMany(),
  ]);

  /*
    Fuori le prove: quelle di prima dell'apertura e quelle battute sulle
    schede di casa. Sono incassi che non sono mai entrati, e in un conto
    economico contano doppio — gonfiano i ricavi e falsano l'IVA da versare.
  */
  const transazioni = righeGrezze.filter(t => t.date >= apertura && !interni.daEscludere(t));

  // ---------- Incassi ----------
  const ivato = Math.round(transazioni.reduce((s, t) => s + t.total, 0) * 100) / 100;
  const { imponibile, iva } = scorpora(ivato, aliquota);

  const perMetodo = (elenco: string[]) => Math.round(transazioni
    .filter(t => elenco.includes((t.paymentMethod || '').toLowerCase().split(' ')[0]))
    .reduce((s, t) => s + t.total, 0) * 100) / 100;
  const contanti = perMetodo(CONTANTI);
  const tracciati = perMetodo(TRACCIATI);

  // ---------- Costi ----------
  const fissi = righeAdmin
    .filter(r => r.kind === 'fixed_cost')
    .map(r => r.data as unknown as CostoFisso)
    .filter(c => c?.isActive !== false && (c?.amount || 0) > 0);

  /*
    Un costo fisso non è una spesa del giorno in cui si paga: l'affitto di
    novecento euro pesa su tutti i giorni del mese. Qui si trasforma in un
    rateo mensile e si moltiplica per i mesi (anche a metà) del periodo.
  */
  const mensilizza = (c: CostoFisso) => {
    const importo = c.amount || 0;
    switch ((c.frequency || 'mensile').toLowerCase()) {
      case 'annuale': return importo / 12;
      case 'trimestrale': return importo / 3;
      case 'semestrale': return importo / 6;
      case 'settimanale': return importo * 4.33;
      default: return importo;
    }
  };
  const quota = mesiCoperti(periodo.dal, periodo.al);
  const costiFissi = Math.round(fissi.reduce((s, c) => s + mensilizza(c) * quota, 0) * 100) / 100;

  /*
    Fra le "spese soci" ci sono anche i finanziamenti: soldi che il socio
    METTE nel centro, non che il centro spende. Contarli come costo farebbe
    sembrare in perdita un mese in cui è entrato capitale, che è il contrario
    di quello che è successo.
  */
  const eFinanziamento = (testo: string) => /finanziament/i.test(testo || '');
  const tutteDelPeriodo = spese.filter(s => s.date >= periodo.dal && s.date <= periodo.al);
  const speseDelPeriodo = tutteDelPeriodo.filter(s => !eFinanziamento(s.description));
  const speseSoci = Math.round(speseDelPeriodo.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const finanziamentiSoci = Math.round(
    tutteDelPeriodo.filter(s => eFinanziamento(s.description)).reduce((s, x) => s + x.amount, 0) * 100,
  ) / 100;

  const inv = righeAdmin
    .filter(r => r.kind === 'investment')
    .map(r => r.data as unknown as Investimento)
    .filter(i => i?.date && i.date >= periodo.dal && i.date <= periodo.al && (i.totalCost || 0) > 0);
  const investimenti = Math.round(inv.reduce((s, i) => s + (i.totalCost || 0), 0) * 100) / 100;

  /*
    Gli investimenti restano fuori dal margine.

    Comprare il centro per 28.000 € non è un costo di luglio: è un bene che
    resta e si consuma in anni. Sommarlo alle spese del mese darebbe un rosso
    da meno quattromila per cento, che non racconta niente di come sta
    andando il lavoro. Si mostrano a parte, dove servono davvero: nel conto
    dei soldi usciti.
  */
  const costiTotali = Math.round((costiFissi + speseSoci) * 100) / 100;
  const margine = Math.round((imponibile - costiTotali) * 100) / 100;

  // ---------- Mese per mese (ultimi 12, sempre, per vedere la tendenza) ----------
  const oggi = new Date();
  const mesi: RigaMese[] = [];
  const tutteTx = (await prisma.posTransaction.findMany({
    where: { date: { gte: new Date(oggi.getFullYear(), oggi.getMonth() - 11, 1).toISOString().slice(0, 10) } },
  })).filter(t => t.date >= apertura && !interni.daEscludere(t));
  for (let i = 11; i >= 0; i--) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const chiave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const delMese = tutteTx.filter(t => t.date.startsWith(chiave));
    const lordoMese = Math.round(delMese.reduce((s, t) => s + t.total, 0) * 100) / 100;
    const s = scorpora(lordoMese, aliquota);
    const speseMese = spese
      .filter(x => x.date.startsWith(chiave) && !eFinanziamento(x.description))
      .reduce((tot, x) => tot + x.amount, 0);
    const fissiMese = fissi.reduce((tot, c) => tot + mensilizza(c), 0);
    const costiMese = Math.round((speseMese + fissiMese) * 100) / 100;
    mesi.push({
      mese: chiave,
      ivato: lordoMese,
      imponibile: s.imponibile,
      iva: s.iva,
      costi: costiMese,
      margine: Math.round((s.imponibile - costiMese) * 100) / 100,
    });
  }

  // ---------- Giorno per giorno, dentro al periodo ----------
  const perGiorno = new Map<string, { ivato: number; incassi: number }>();
  for (const t of transazioni) {
    const r = perGiorno.get(t.date) || { ivato: 0, incassi: 0 };
    r.ivato += t.total;
    r.incassi += 1;
    perGiorno.set(t.date, r);
  }
  const giorni = [...perGiorno.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, v]) => ({ data, ivato: Math.round(v.ivato * 100) / 100, incassi: v.incassi }));

  const costiPerVoce = [
    ...fissi.map(c => ({
      nome: `${c.name || 'Costo fisso'} (${c.frequency || 'mensile'})`,
      importo: Math.round(mensilizza(c) * quota * 100) / 100,
      tipo: 'fisso' as const,
    })),
    ...speseDelPeriodo.map(s => ({ nome: `${s.description} — ${s.partner}`, importo: s.amount, tipo: 'soci' as const })),
    ...inv.map(i => ({ nome: i.name || 'Investimento', importo: i.totalCost || 0, tipo: 'investimento' as const })),
  ].sort((a, b) => b.importo - a.importo);

  return {
    periodo, aliquota,
    ivato, imponibile, iva, incassi: transazioni.length,
    contanti, tracciati,
    altriMetodi: Math.round((ivato - contanti - tracciati) * 100) / 100,
    costiFissi, speseSoci, investimenti, finanziamentiSoci, costiTotali,
    margine,
    marginePercento: imponibile > 0 ? Math.round((margine / imponibile) * 1000) / 10 : 0,
    cassaforte: movimenti.reduce((s, m) => s + (m.type === 'withdraw' ? -m.cash : m.cash), 0),
    mesi, costiPerVoce, giorni,
  };
}
