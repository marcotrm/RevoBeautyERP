'use server';

/**
 * Chi frequenta il centro: età e genere.
 *
 * È la domanda che sta prima di ogni decisione — che trattamenti spingere,
 * come scrivere i messaggi, dove mettere i soldi della pubblicità — e finora
 * il gestionale non la sapeva rispondere: i dati c'erano, sparsi in
 * trecentosettantasei schede, ma nessuno li aveva mai messi in fila.
 *
 * Due avvertenze, scritte anche a schermo perché cambiano la lettura:
 *
 *  - si contano le clienti VENUTE davvero (almeno un trattamento fatto), non
 *    le schede in rubrica: fra queste ci sono anche i contatti raccolti
 *    all'inaugurazione che non hanno mai messo piede in centro;
 *  - le percentuali si calcolano su chi il dato ce l'ha. Chi non ha la data di
 *    nascita non finisce in una fascia "sconosciuti" che sporca il grafico: si
 *    dice a parte quante sono, perché quello è un problema da risolvere al
 *    banco, non una fascia d'età.
 */

import { prisma } from '@/lib/prisma';
import { dataApertura } from '@/lib/apertura';
import { filtroInterni } from '@/lib/clientiInterni';
import { etaDa } from '@/lib/helpers';
import { riconciliaCitta } from '@/lib/citta';

export interface FasciaDemografica {
  nome: string;
  clienti: number;
  percentuale: number;
  spesa: number;
  spesaMedia: number;
}

export interface Demografia {
  /** Clienti che sono venute almeno una volta da quando il centro ha aperto. */
  venute: number;
  eta: FasciaDemografica[];
  /** Quante, fra le venute, non hanno la data di nascita in scheda. */
  senzaNascita: number;
  genere: FasciaDemografica[];
  /** Quante, fra le venute, non hanno il genere in scheda. */
  senzaGenere: number;
  /** Da dove vengono, dalla città più rappresentata all'ultima. */
  citta: FasciaDemografica[];
  /** Quante, fra le venute, non hanno la città in scheda. */
  senzaCitta: number;
  /** Età media di chi frequenta, sulle schede complete. */
  etaMedia: number;
}

const FASCE: { nome: string; da: number; a: number }[] = [
  { nome: 'Fino a 19', da: 0, a: 19 },
  { nome: '20-29', da: 20, a: 29 },
  { nome: '30-39', da: 30, a: 39 },
  { nome: '40-49', da: 40, a: 49 },
  { nome: '50-59', da: 50, a: 59 },
  { nome: '60 e oltre', da: 60, a: 200 },
];

export async function demografiaClienti(): Promise<Demografia> {
  const [apertura, interni, clienti] = await Promise.all([
    dataApertura(),
    filtroInterni(prisma),
    prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, gender: true, birthDate: true, city: true } }),
  ]);

  const [appuntamenti, incassi] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: 'completed', date: { gte: apertura } },
      select: { clientId: true, clientName: true },
    }),
    prisma.posTransaction.findMany({
      where: { isRefund: false, total: { gt: 0 }, date: { gte: apertura } },
      select: { clientName: true, total: true },
    }),
  ]);

  // Chi è venuta davvero, senza le schede di casa.
  const venute = new Set(
    appuntamenti.filter(a => !interni.daEscludere(a)).map(a => a.clientId).filter(Boolean) as string[],
  );

  // La spesa arriva dalla cassa, che conosce solo il nome: si riaggancia qui.
  const spesaPerNome = new Map<string, number>();
  for (const t of incassi) {
    if (interni.daEscludere(t)) continue;
    const k = (t.clientName || '').trim().toLowerCase();
    if (!k) continue;
    spesaPerNome.set(k, Math.round(((spesaPerNome.get(k) || 0) + t.total) * 100) / 100);
  }

  const schede = clienti.filter(c => venute.has(c.id));
  const spesaDi = (c: { firstName: string; lastName: string }) =>
    spesaPerNome.get(`${c.firstName} ${c.lastName}`.trim().toLowerCase()) || 0;

  // ---- Età ----
  const conEta = schede
    .map(c => ({ c, anni: c.birthDate ? etaDa(c.birthDate) : null }))
    .filter((x): x is { c: typeof schede[number]; anni: number } => x.anni !== null);

  const eta: FasciaDemografica[] = FASCE.map(f => {
    const dentro = conEta.filter(x => x.anni >= f.da && x.anni <= f.a);
    const spesa = Math.round(dentro.reduce((s, x) => s + spesaDi(x.c), 0) * 100) / 100;
    return {
      nome: f.nome,
      clienti: dentro.length,
      percentuale: conEta.length ? Math.round((dentro.length / conEta.length) * 1000) / 10 : 0,
      spesa,
      spesaMedia: dentro.length ? Math.round((spesa / dentro.length) * 100) / 100 : 0,
    };
  });

  // ---- Genere ----
  const conGenere = schede.filter(c => c.gender === 'F' || c.gender === 'M');
  const genere: FasciaDemografica[] = (['F', 'M'] as const).map(g => {
    const dentro = conGenere.filter(c => c.gender === g);
    const spesa = Math.round(dentro.reduce((s, c) => s + spesaDi(c), 0) * 100) / 100;
    return {
      nome: g === 'F' ? 'Donne' : 'Uomini',
      clienti: dentro.length,
      percentuale: conGenere.length ? Math.round((dentro.length / conGenere.length) * 1000) / 10 : 0,
      spesa,
      spesaMedia: dentro.length ? Math.round((spesa / dentro.length) * 100) / 100 : 0,
    };
  });

  // ---- Città ----
  const conCitta = schede.filter(c => (c.city || '').trim());
  const comeSiScrive = riconciliaCitta(conCitta.map(c => c.city as string));
  const perCitta = new Map<string, { clienti: number; spesa: number }>();
  for (const c of conCitta) {
    const nome = comeSiScrive.get(c.city as string) || (c.city as string).trim();
    const v = perCitta.get(nome) || { clienti: 0, spesa: 0 };
    v.clienti += 1;
    v.spesa = Math.round((v.spesa + spesaDi(c)) * 100) / 100;
    perCitta.set(nome, v);
  }
  const citta: FasciaDemografica[] = [...perCitta.entries()]
    .map(([nome, v]) => ({
      nome,
      clienti: v.clienti,
      percentuale: conCitta.length ? Math.round((v.clienti / conCitta.length) * 1000) / 10 : 0,
      spesa: v.spesa,
      spesaMedia: v.clienti ? Math.round((v.spesa / v.clienti) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.clienti - a.clienti || b.spesa - a.spesa);

  return {
    venute: schede.length,
    citta,
    senzaCitta: schede.length - conCitta.length,
    eta,
    senzaNascita: schede.length - conEta.length,
    genere,
    senzaGenere: schede.length - conGenere.length,
    etaMedia: conEta.length ? Math.round(conEta.reduce((s, x) => s + x.anni, 0) / conEta.length) : 0,
  };
}
