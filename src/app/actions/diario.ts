'use server';

/**
 * Le variazioni dell'agenda, per chi ha il diritto di guardarle.
 *
 * Questa e' la parte che risponde alla domanda: «stamattina c'erano piu'
 * appuntamenti, cosa e' successo?». Si sceglie un giorno e si vede tutto
 * quello che e' stato tolto, spostato o cambiato su quel giorno, con nome,
 * ora, prezzo e chi l'ha fatto.
 *
 * Chi puo' leggerla: solo chi ha il permesso di amministrazione. Non e' una
 * cortesia — un registro che possono leggere tutti diventa un registro che
 * qualcuno impara ad aggirare.
 */

import { prisma } from '@/lib/prisma';
import { collegaSpostamenti } from '@/lib/diarioAgenda';
import { sessioneCorrente } from '@/lib/sessione';
import { getRoles } from '@/app/actions/roles';

/**
 * Chi guarda ha il permesso?
 *
 * Il ruolo si legge dalla sessione, che il browser non puo' riscrivere; il
 * permesso dal ruolo. Senza sessione — chi ha fatto l'accesso prima che i
 * cookie esistessero — si risponde di no e si chiede di rientrare: e' una
 * seccatura di dieci secondi, e vale meno del rischio di lasciare aperta
 * proprio questa pagina.
 */
async function puoGuardare(): Promise<{ ok: boolean; errore?: string }> {
  const s = await sessioneCorrente();
  if (!s || s.tipo !== 'operatrice' || !s.roleId) {
    return { ok: false, errore: 'Per vedere le variazioni rifai l\'accesso: serve una sessione riconosciuta.' };
  }
  const ruoli = await getRoles();
  const mio = ruoli.find(r => r.id === s.roleId);
  if (!mio?.permissions?.admin_dashboard) {
    return { ok: false, errore: 'Questa pagina è riservata all\'amministrazione.' };
  }
  return { ok: true };
}

export interface VariazioneAgenda {
  id: string;
  azione: string;
  appointmentId: string;
  clientName: string;
  data: string;
  ora: string;
  trattamento: string;
  prezzo: number;
  motivo: string | null;
  cambiamenti: string[];
  chi: string;
  quando: string;
  /** Vero quando l'annullamento e' in realta' uno spostamento. */
  spostato: boolean;
}

export interface GiornataVariazioni {
  ok: boolean;
  errore?: string;
  variazioni: VariazioneAgenda[];
  /** Quanto vale quello che e' sparito davvero (spostamenti esclusi). */
  persiEuro: number;
  quantiPersi: number;
  quantiEliminati: number;
  quantiSpostati: number;
}

/** Tutto quello che e' successo agli appuntamenti di quel giorno. */
export async function variazioniDelGiorno(giorno: string): Promise<GiornataVariazioni> {
  const permesso = await puoGuardare();
  const vuoto = { variazioni: [], persiEuro: 0, quantiPersi: 0, quantiEliminati: 0, quantiSpostati: 0 };
  if (!permesso.ok) return { ok: false, errore: permesso.errore, ...vuoto };

  await collegaSpostamenti(giorno);
  const righe = await prisma.diarioAgenda.findMany({
    where: { data: giorno },
    orderBy: { quando: 'desc' },
    take: 500,
  });

  const variazioni: VariazioneAgenda[] = righe.map(r => ({
    id: r.id,
    azione: r.azione,
    appointmentId: r.appointmentId,
    clientName: r.clientName,
    data: r.data,
    ora: r.ora,
    trattamento: r.trattamento,
    prezzo: r.prezzo,
    motivo: r.motivo,
    cambiamenti: r.cambiamenti,
    chi: r.chi,
    quando: r.quando,
    spostato: Boolean(r.spostatoIn),
  }));

  const spariti = variazioni.filter(v => (v.azione === 'annullato' || v.azione === 'eliminato') && !v.spostato);
  return {
    ok: true,
    variazioni,
    persiEuro: Math.round(spariti.reduce((s, v) => s + v.prezzo, 0) * 100) / 100,
    quantiPersi: spariti.length,
    quantiEliminati: variazioni.filter(v => v.azione === 'eliminato').length,
    quantiSpostati: variazioni.filter(v => v.spostato).length,
  };
}

/**
 * Il riepilogo della sera, quello che parte su Telegram.
 *
 * Guarda le variazioni fatte OGGI, su qualsiasi giorno dell'agenda: se
 * qualcuno stamattina ha tolto un appuntamento di venerdi' prossimo, deve
 * comparire stasera, non venerdi'.
 */
export interface RiepilogoSera {
  quando: string;
  annullati: VariazioneAgenda[];
  eliminati: VariazioneAgenda[];
  spostati: VariazioneAgenda[];
  persiEuro: number;
}

export async function riepilogoVariazioniDiOggi(): Promise<RiepilogoSera> {
  const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  const righe = await prisma.diarioAgenda.findMany({
    where: { quando: { startsWith: oggi }, azione: { in: ['annullato', 'eliminato'] } },
    orderBy: { quando: 'asc' },
    take: 200,
  });

  // Gli spostamenti si riconoscono giorno per giorno: si collegano prima di
  // contare, o una seduta spostata risulterebbe persa.
  for (const giorno of new Set(righe.map(r => r.data))) await collegaSpostamenti(giorno);
  const aggiornate = await prisma.diarioAgenda.findMany({
    where: { id: { in: righe.map(r => r.id) } },
    orderBy: { quando: 'asc' },
  });

  const vesti = (r: typeof aggiornate[number]): VariazioneAgenda => ({
    id: r.id, azione: r.azione, appointmentId: r.appointmentId, clientName: r.clientName,
    data: r.data, ora: r.ora, trattamento: r.trattamento, prezzo: r.prezzo, motivo: r.motivo,
    cambiamenti: r.cambiamenti, chi: r.chi, quando: r.quando, spostato: Boolean(r.spostatoIn),
  });

  const tutte = aggiornate.map(vesti);
  const spostati = tutte.filter(v => v.spostato);
  const annullati = tutte.filter(v => v.azione === 'annullato' && !v.spostato);
  const eliminati = tutte.filter(v => v.azione === 'eliminato' && !v.spostato);
  return {
    quando: oggi,
    annullati,
    eliminati,
    spostati,
    persiEuro: Math.round([...annullati, ...eliminati].reduce((s, v) => s + v.prezzo, 0) * 100) / 100,
  };
}
