/**
 * Date e orari detti come li direbbe una persona.
 *
 * Al telefono "03/09 15:25" non si può leggere, e nemmeno "le 15:25": chi
 * prende un appuntamento dice "giovedì 3 settembre alle tre e venticinque del
 * pomeriggio". Serve anche quando l'assistente ripete l'appuntamento per farselo
 * confermare — ed è lì che conta di più, perché la cliente deve riconoscere
 * l'orario al volo per dire di sì o di no.
 *
 * Sta in un file suo perché non è roba della voce soltanto: gli stessi orari
 * finiscono nei messaggi WhatsApp di promemoria.
 */

const UNITA = [
  'zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici',
  'diciassette', 'diciotto', 'diciannove',
];
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta'];

/**
 * I numeri da 0 a 59, scritti in lettere.
 *
 * Le due irregolarità dell'italiano: la decina perde la vocale finale davanti a
 * uno e otto (ventuno, ventotto, trentuno), e il tre in coda prende l'accento
 * (ventitré). Senza queste due regole si ottiene "ventiuno", che una voce legge
 * come lo scrive.
 */
export function numeroParlato(n: number): string {
  if (n < 0 || n > 59) return String(n);
  if (n < 20) return UNITA[n];

  const d = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return DECINE[d];

  const decina = (u === 1 || u === 8) ? DECINE[d].slice(0, -1) : DECINE[d];
  return decina + (u === 3 ? 'tré' : UNITA[u]);
}

/** Il momento della giornata, per togliere l'ambiguità fra le 3 e le 15. */
function partiDelGiorno(ore: number): string {
  if (ore >= 18) return ' di sera';
  if (ore >= 13) return ' del pomeriggio';
  if (ore < 12) return ' di mattina';
  return '';
}

/**
 * "15:25" → "le tre e venticinque del pomeriggio".
 *
 * I quarti si dicono come li dice la gente ("e mezza", "e un quarto"): sono i
 * tre casi che ricorrono di continuo in un'agenda a passi di quindici minuti.
 */
export function oraParlata(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;

  if (h === 0 && m === 0) return 'mezzanotte';
  if (h === 12 && m === 0) return 'mezzogiorno';

  const ore12 = h % 12 === 0 ? 12 : h % 12;
  const testaOra = ore12 === 1 ? "l'una" : `le ${numeroParlato(ore12)}`;

  const minuti = m === 0 ? ''
    : m === 15 ? ' e un quarto'
    : m === 30 ? ' e mezza'
    : m === 45 ? ' e tre quarti'
    : ` e ${numeroParlato(m)}`;

  return `${testaOra}${minuti}${partiDelGiorno(h)}`;
}

/** "2026-09-03" → "giovedì 3 settembre". L'anno si dice solo se non è questo. */
export function dataParlata(iso: string, oggiIso?: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;

  const annoCorrente = (oggiIso || new Date().toISOString()).slice(0, 4);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(iso.slice(0, 4) === annoCorrente ? {} : { year: 'numeric' }),
  });
}

/**
 * "2026-09-03" + "15:25" → "giovedì 3 settembre alle tre e venticinque del pomeriggio".
 *
 * `oraParlata` restituisce l'ora con il suo articolo ("le tre", "l'una"), che
 * da sola è la forma giusta. Qui l'articolo va fuso con la preposizione —
 * alle tre, all'una, a mezzogiorno — altrimenti viene fuori "alle le tre".
 */
export function quandoParlato(iso: string, hhmm: string, oggiIso?: string): string {
  const ora = oraParlata(hhmm);
  const quando = ora.startsWith('le ') ? `alle ${ora.slice(3)}`
    : ora.startsWith("l'") ? `all'${ora.slice(2)}`
    : `a ${ora}`;
  return `${dataParlata(iso, oggiIso)} ${quando}`;
}
