/**
 * Revo Score: il punteggio del PERCORSO della cliente, da 0 a 100.
 *
 * Misura quanto sta seguendo il suo cammino — costanza, percorsi,
 * completezza, partecipazione — mai «quanto è bella»: un numero che
 * giudica il corpo ferisce e non fa tornare nessuno. Ogni componente
 * si spiega in una riga, e la spiegazione viaggia insieme al numero.
 *
 * Pesi v1 (senza la Beauty Routine, che arriverà con la fase 3):
 *   costanza 35 · percorso 30 · cura completa 20 · community 15
 */

import { prisma } from '@/lib/prisma';

const GIORNO = 86400000;
const oggiISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

export interface ComponenteScore {
  codice: 'costanza' | 'percorso' | 'cura' | 'community';
  nome: string;
  punti: number;
  massimo: number;
  spiegazione: string;
}

export interface RisultatoScore {
  totale: number;
  livello: string;
  componenti: ComponenteScore[];
}

/** Starter <40 · Silver 40 · Gold 60 · Platinum 75 · Diamond 90 */
export function livelloDaScore(totale: number): string {
  if (totale >= 90) return 'Diamond';
  if (totale >= 75) return 'Platinum';
  if (totale >= 60) return 'Gold';
  if (totale >= 40) return 'Silver';
  return 'Starter';
}

export async function calcolaScore(clientId: string): Promise<RisultatoScore> {
  const oggi = oggiISO();
  const da180 = new Date(Date.now() - 180 * GIORNO).toISOString().slice(0, 10);
  const da120 = new Date(Date.now() - 120 * GIORNO).toISOString().slice(0, 10);

  const [sedute, futuri, pacchetti, account, movimenti, noShow] = await Promise.all([
    prisma.appointment.findMany({
      where: { clientId, status: 'completed', date: { gte: da180, lte: oggi } },
      orderBy: { date: 'asc' },
      select: { date: true, treatmentCategory: true },
    }),
    prisma.appointment.count({
      where: { clientId, date: { gt: oggi }, status: { in: ['confirmed', 'pending'] } },
    }),
    prisma.clientPackage.findMany({
      where: { clientId, status: 'active' },
      select: { usedSessions: true, totalSessions: true },
    }),
    prisma.mobileAccount.findUnique({ where: { clientId }, select: { id: true } }),
    prisma.loyaltyMovement.count({ where: { clientId } }),
    prisma.appointment.count({
      where: { clientId, status: 'no_show', date: { gte: da120 } },
    }),
  ]);

  // ── Costanza (35): il ritmo. Con almeno 3 sedute si misura il ritmo vero
  //    (giorni dall'ultima vs. il proprio intervallo medio); con meno storia
  //    si parte da metà — nessuna nasce con zero.
  let costanza: number;
  let spiegaCostanza: string;
  if (sedute.length >= 3) {
    let somma = 0;
    for (let i = 1; i < sedute.length; i++) {
      somma += (Date.parse(sedute[i].date) - Date.parse(sedute[i - 1].date)) / GIORNO;
    }
    const media = somma / (sedute.length - 1);
    const daUltima = (Date.parse(oggi) - Date.parse(sedute[sedute.length - 1].date)) / GIORNO;
    // dentro 1.2× la propria media = pieno; a 2× si è a zero
    const rapporto = Math.max(0, Math.min(1, (2 - daUltima / media) / 0.8));
    costanza = Math.round(35 * rapporto);
    spiegaCostanza =
      daUltima <= media * 1.2
        ? 'Stai tenendo il tuo ritmo: brava!'
        : `In genere torni ogni ${Math.round(media)} giorni: ti aspettiamo.`;
  } else {
    costanza = 18;
    spiegaCostanza = 'Il tuo ritmo si vedrà con le prossime sedute.';
  }

  // ── Percorso (30): pacchetti che avanzano + il prossimo passo in agenda.
  const avanzamenti = pacchetti.map((p) => p.usedSessions / Math.max(p.totalSessions, 1));
  const migliore = avanzamenti.length ? Math.max(...avanzamenti) : 0;
  const percorso = Math.round(migliore * 20) + (futuri > 0 ? 10 : 0);
  const spiegaPercorso =
    futuri > 0
      ? 'Hai già il prossimo appuntamento: il percorso cammina.'
      : 'Prenota il prossimo passo per far salire il punteggio.';

  // ── Cura completa (20): quante aree diverse negli ultimi 120 giorni.
  const categorie = new Set(
    sedute.filter((s) => s.date >= da120).map((s) => s.treatmentCategory || 'altro')
  ).size;
  const cura = categorie >= 4 ? 20 : categorie === 3 ? 17 : categorie === 2 ? 13 : categorie === 1 ? 8 : 0;
  const spiegaCura =
    categorie >= 3
      ? 'Ti prendi cura di te a tutto tondo.'
      : 'Prova un\'area nuova: viso, corpo, laser o unghie.';

  // ── Community (15): app, punti che girano, affidabilità.
  let community = 0;
  if (account) community += 5;
  if (movimenti > 0) community += 5;
  community += noShow === 0 ? 5 : Math.max(0, 5 - noShow * 3);
  const spiegaCommunity =
    noShow > 0 ? 'Gli appuntamenti mancati pesano sul punteggio.' : 'Sei una cliente su cui contare.';

  const componenti: ComponenteScore[] = [
    { codice: 'costanza', nome: 'Costanza', punti: costanza, massimo: 35, spiegazione: spiegaCostanza },
    { codice: 'percorso', nome: 'Percorso', punti: Math.min(percorso, 30), massimo: 30, spiegazione: spiegaPercorso },
    { codice: 'cura', nome: 'Cura completa', punti: cura, massimo: 20, spiegazione: spiegaCura },
    { codice: 'community', nome: 'Community', punti: Math.min(community, 15), massimo: 15, spiegazione: spiegaCommunity },
  ];
  const totale = componenti.reduce((s, c) => s + c.punti, 0);

  return { totale, livello: livelloDaScore(totale), componenti };
}

/**
 * La fotografia del giorno, per tutte le clienti con l'app.
 * Idempotente: una riga per giorno per cliente (upsert).
 */
export async function snapshotScoreGiornaliero(): Promise<{ salvati: number }> {
  const oggi = oggiISO();
  const account = await prisma.mobileAccount.findMany({ select: { clientId: true } });
  let salvati = 0;
  for (const a of account) {
    try {
      const r = await calcolaScore(a.clientId);
      await prisma.scoreSnapshot.upsert({
        where: { clientId_data: { clientId: a.clientId, data: oggi } },
        update: { totale: r.totale, componenti: Object.fromEntries(r.componenti.map((c) => [c.codice, c.punti])) },
        create: {
          clientId: a.clientId,
          data: oggi,
          totale: r.totale,
          componenti: Object.fromEntries(r.componenti.map((c) => [c.codice, c.punti])),
          createdAt: new Date().toISOString(),
        },
      });
      salvati++;
    } catch (err) {
      console.error('[score] snapshot fallito per', a.clientId, err);
    }
  }
  return { salvati };
}
