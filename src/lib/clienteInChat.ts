/**
 * Tutto quello che il gestionale sa di chi sta scrivendo.
 *
 * Serve perché una segretaria che risponde bene ma non sa chi ha davanti resta
 * un centralino. Le differenze si sentono in tre punti precisi:
 *
 *  - **Il prezzo.** Se la cliente ha un prezzo personalizzato in scheda, o un
 *    pacchetto già pagato con sedute residue, il prezzo di listino è la
 *    risposta sbagliata. Dire «sono 60 euro» a chi ha tre sedute prepagate è
 *    il genere di errore che al banco non succede mai e che a un bot fa
 *    perdere la faccia in una riga.
 *
 *  - **«Il solito».** Metà delle richieste vere suonano così. Senza lo storico
 *    la risposta è «cosa intendi?», e a quel punto la cliente ha già capito
 *    con chi sta parlando.
 *
 *  - **L'operatrice.** Chi va sempre dalla stessa persona non lo dice, lo dà
 *    per scontato. Proporle un orario con un'altra senza dire niente è il modo
 *    più veloce per farsi disdire l'appuntamento il giorno prima.
 *
 * Niente di tutto questo viene detto alla cliente così com'è: è materiale per
 * la segretaria, che lo usa per rispondere come una persona che la conosce.
 */

import { prisma } from './prisma';
import { todayInItaly } from './voice';
import { saldoWallet } from './wallet';
import { prossimiAppuntamenti } from './agendaAgente';

/** Prezzo e durata su misura, scritti nella scheda della cliente. */
interface PrezzoSuMisura {
  treatmentId: string;
  treatmentName: string;
  price: number;
  duration: number;
}

export interface PacchettoAperto {
  nome: string;
  rimaste: number;
  totali: number;
  /** Pacchetto a 0 €: è un omaggio, non una seduta già pagata. */
  omaggio: boolean;
  scade: string;
}

export interface SchedaInChat {
  id: string;
  nome: string;
  nomeCompleto: string;
  uomo: boolean;
  /** Prezzi personalizzati: vincono sul listino. */
  suMisura: PrezzoSuMisura[];
  pacchetti: PacchettoAperto[];
  creditoEuro: number;
  punti: number;
  buoniEuro: number;
  ultimaVisita: string | null;
  quanteVolte: number;
  /** I trattamenti fatti di recente, dal più recente: è il "solito". */
  storico: Array<{ trattamento: string; con: string; quando: string }>;
  /** Chi la segue di solito, se c'è una risposta chiara. */
  operatriceAbituale: string | null;
}

const NON_CONTA = ['cancelled', 'no_show', 'no-show'];

/**
 * Chi è di solito la sua operatrice.
 *
 * Solo se è una risposta vera: con due visite su cinque non è "la sua
 * operatrice", è un caso. Sotto la metà delle visite non si dice niente,
 * perché una preferenza inventata è peggio di nessuna preferenza.
 */
function abituale(visite: Array<{ operatorName: string }>): string | null {
  if (visite.length < 3) return null;
  const conteggio = new Map<string, number>();
  for (const v of visite) {
    if (!v.operatorName) continue;
    conteggio.set(v.operatorName, (conteggio.get(v.operatorName) || 0) + 1);
  }
  const [nome, quante] = [...conteggio.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!nome || quante < Math.ceil(visite.length / 2)) return null;
  return nome.split(' ')[0];
}

/** La scheda completa, o `null` se questo numero non è in rubrica. */
export async function schedaDiChiScrive(phone: string): Promise<SchedaInChat | null> {
  const coda = phone.replace(/\D/g, '').slice(-9);
  if (coda.length < 6) return null;

  const cliente = await prisma.client.findFirst({
    where: { phone: { endsWith: coda } },
    select: {
      id: true, firstName: true, lastName: true, gender: true,
      customTreatments: true, loyaltyPoints: true, lastVisit: true, visitCount: true,
    },
  });
  if (!cliente) return null;

  const oggi = todayInItaly();

  const [passati, pacchetti, buoni, wallet] = await Promise.all([
    // Lo storico: quello che ha già fatto, non quello che deve fare.
    prisma.appointment.findMany({
      where: { clientId: cliente.id, date: { lt: oggi }, status: { notIn: NON_CONTA } },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      select: { date: true, treatmentName: true, operatorName: true },
      take: 12,
    }),
    prisma.clientPackage.findMany({
      where: { clientId: cliente.id, status: 'active' },
      select: { packageName: true, totalSessions: true, usedSessions: true, pricePaid: true, expiryDate: true },
    }),
    prisma.giftCard.findMany({
      where: {
        status: 'active',
        remainingBalance: { gt: 0 },
        OR: [{ buyerId: cliente.id }, { recipientPhone: { endsWith: coda } }],
      },
      select: { remainingBalance: true },
    }),
    saldoWallet(cliente.id).catch(() => null),
  ]);

  const suMisura: PrezzoSuMisura[] = Array.isArray(cliente.customTreatments)
    ? (cliente.customTreatments as unknown[])
        .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
        .map(c => ({
          treatmentId: String(c.treatmentId || ''),
          treatmentName: String(c.treatmentName || ''),
          price: Number(c.price) || 0,
          duration: Number(c.duration) || 0,
        }))
        .filter(c => c.treatmentId)
    : [];

  return {
    id: cliente.id,
    nome: cliente.firstName,
    nomeCompleto: `${cliente.firstName} ${cliente.lastName}`.trim(),
    uomo: cliente.gender === 'M',
    suMisura,
    pacchetti: pacchetti
      .filter(p => p.totalSessions - p.usedSessions > 0)
      .map(p => ({
        nome: p.packageName,
        rimaste: p.totalSessions - p.usedSessions,
        totali: p.totalSessions,
        omaggio: p.pricePaid === 0,
        scade: p.expiryDate,
      })),
    creditoEuro: wallet?.totale ?? 0,
    punti: cliente.loyaltyPoints || 0,
    buoniEuro: buoni.reduce((s, b) => s + b.remainingBalance, 0),
    ultimaVisita: cliente.lastVisit || null,
    quanteVolte: cliente.visitCount || 0,
    storico: passati.slice(0, 6).map(a => ({
      trattamento: a.treatmentName,
      con: (a.operatorName || '').split(' ')[0],
      quando: a.date,
    })),
    operatriceAbituale: abituale(passati),
  };
}

/** Comodo per `chi_e`: la scheda più i prossimi appuntamenti. */
export async function schedaConAppuntamenti(phone: string) {
  const scheda = await schedaDiChiScrive(phone);
  if (!scheda) return null;
  const appuntamenti = await prossimiAppuntamenti(scheda.id);
  return { scheda, appuntamenti };
}
