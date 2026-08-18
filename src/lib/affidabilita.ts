/**
 * Chi disdice e chi non si presenta.
 *
 * È l'altra faccia della corona: in agenda si vede subito chi tiene in piedi
 * il centro, ma serve vedere anche chi lo fa perdere. Un posto disdetto
 * all'ultimo momento non si rivende quasi mai, e chi lo fa spesso lo rifà —
 * saperlo PRIMA di dare l'appuntamento cambia la telefonata: si chiede la
 * conferma il giorno prima, o l'acconto.
 *
 * Due scelte che contano più delle soglie:
 *
 *  - si guardano solo gli ULTIMI 12 MESI. Tre disdette di due anni fa, con una
 *    persona che da allora viene sempre, non sono un problema: sarebbe una
 *    condanna a vita per chi ha avuto un brutto periodo.
 *  - il denominatore sono gli appuntamenti CONCLUSI (fatti, disdetti, mancati),
 *    non tutti quelli in agenda. Contare anche i prossimi appuntamenti già
 *    fissati abbasserebbe la percentuale di chi prenota molto, che è l'esatto
 *    contrario di quello che serve sapere.
 *
 * Le soglie sono tarate sui numeri veri del centro: col rosso restano due
 * nomi su centottantaquattro, e un segnale che compare su mezza agenda non lo
 * guarda più nessuno.
 */

/** Quanto indietro si guarda. Stessa finestra della corona. */
export const MESI_AFFIDABILITA = 12;

/** Rosso: ha già saltato tanto, e non per caso. */
export const MANCATI_ROSSO = 3;
export const PERCENTUALE_ROSSO = 25;

/** Giallo: sta cominciando a scappare. Due su pochi appuntamenti è un segnale. */
export const MANCATI_GIALLO = 2;
export const PERCENTUALE_GIALLO = 30;

export type LivelloAffidabilita = 'ok' | 'attenzione' | 'rischio';

export interface Affidabilita {
  /** Fatti + disdetti + mancati: quelli su cui si può giudicare. */
  conclusi: number;
  completati: number;
  disdette: number;
  noShow: number;
  /** Disdette + no-show: i posti bruciati. */
  mancati: number;
  /** Sui conclusi, arrotondata. */
  percentuale: number;
  livello: LivelloAffidabilita;
}

/** Solo questi status dicono com'è andata davvero. */
const CONCLUSI = new Set(['completed', 'cancelled', 'no_show']);

/** La data di taglio (YYYY-MM-DD) da cui contare. */
export function dalQuando(oggi = new Date()): string {
  const d = new Date(oggi);
  d.setMonth(d.getMonth() - MESI_AFFIDABILITA);
  return d.toISOString().slice(0, 10);
}

/**
 * Il giudizio su una persona, dai suoi appuntamenti.
 * Filtra da sé la finestra dei 12 mesi: chi chiama può passare tutto.
 */
export function valutaAffidabilita(
  appuntamenti: { status: string; date: string }[],
  dal = dalQuando(),
): Affidabilita {
  let completati = 0, disdette = 0, noShow = 0;
  for (const a of appuntamenti) {
    if (!CONCLUSI.has(a.status)) continue;
    if (a.date < dal) continue;
    if (a.status === 'completed') completati++;
    else if (a.status === 'cancelled') disdette++;
    else noShow++;
  }
  const mancati = disdette + noShow;
  const conclusi = completati + mancati;
  const percentuale = conclusi > 0 ? Math.round((mancati / conclusi) * 100) : 0;

  let livello: LivelloAffidabilita = 'ok';
  if (mancati >= MANCATI_ROSSO && percentuale >= PERCENTUALE_ROSSO) livello = 'rischio';
  else if (mancati >= MANCATI_GIALLO && percentuale >= PERCENTUALE_GIALLO) livello = 'attenzione';

  return { conclusi, completati, disdette, noShow, mancati, percentuale, livello };
}

/** "4 appuntamenti saltati su 6 negli ultimi 12 mesi": come si dice a voce. */
export function riassuntoAffidabilita(a: Affidabilita): string {
  const pezzi: string[] = [];
  if (a.disdette > 0) pezzi.push(`${a.disdette} ${a.disdette === 1 ? 'disdetta' : 'disdette'}`);
  if (a.noShow > 0) pezzi.push(`${a.noShow} ${a.noShow === 1 ? 'volta' : 'volte'} non presentat${a.noShow === 1 ? 'a' : 'e'}`);
  return `${pezzi.join(' e ')} su ${a.conclusi} appuntament${a.conclusi === 1 ? 'o' : 'i'} negli ultimi ${MESI_AFFIDABILITA} mesi (${a.percentuale}%)`;
}

/** Cosa farci: il consiglio cambia col livello. */
export function consiglioAffidabilita(a: Affidabilita): string {
  return a.livello === 'rischio'
    ? 'Chiedile la conferma il giorno prima e valuta un acconto: quando salta, quel posto non si rivende.'
    : 'Tienila d’occhio: una telefonata di conferma il giorno prima di solito basta.';
}
