/**
 * Una data di nascita che sta in piedi.
 *
 * In anagrafica sono finite: 1890, 1198, l'anno 200, e una signora nata nel
 * 275760. Nessuno le ha scritte apposta — si sbaglia una cifra battendo in
 * fretta col telefono all'orecchio, e il gestionale le ha prese per buone.
 *
 * Da li' in poi il danno e' silenzioso: gli auguri partono nel giorno
 * sbagliato, l'eta' media dei clienti non vuol dire piu' niente, e un
 * consenso al laser risulta firmato da una persona di centotrentasei anni.
 *
 * Il controllo sta qui, in un posto solo, perche' le date entrano da quattro
 * porte diverse — la finestra Nuovo Cliente, il check-in, il modulo del
 * consenso, l'app — e un controllo scritto su una porta sola e' un controllo
 * che qualcuno aggirera' senza saperlo.
 */

/** Piu' di cosi' non si campa: il record verificato e' 122 anni. */
const ETA_MASSIMA = 110;

/** Sotto questa eta' un trattamento estetico non si fa senza un genitore. */
const ETA_MINORENNE = 18;

/** I pezzi di una data ISO, senza passare da `new Date` e dai suoi fusi. */
function pezzi(iso: string): { anno: number; mese: number; giorno: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  const anno = Number(m[1]), mese = Number(m[2]), giorno = Number(m[3]);
  if (mese < 1 || mese > 12 || giorno < 1) return null;
  if (giorno > new Date(anno, mese, 0).getDate()) return null;
  return { anno, mese, giorno };
}

/** Gli anni compiuti oggi, o null se quella data non e' una data. */
export function etaDa(iso: string): number | null {
  const p = pezzi(iso);
  if (!p) return null;
  const oggi = new Date();
  let anni = oggi.getFullYear() - p.anno;
  const compiuti = oggi.getMonth() + 1 > p.mese || (oggi.getMonth() + 1 === p.mese && oggi.getDate() >= p.giorno);
  if (!compiuti) anni -= 1;
  return anni;
}

/**
 * Cosa non va in questa data, detto a chi la sta scrivendo — o null se va bene.
 *
 * Blocca solo l'impossibile. Il dubbio non si blocca: una quindicenne che
 * viene a farsi le unghie esiste, e un gestionale che le dice di no fa
 * scrivere «15/08/1990» a caso pur di andare avanti — che e' peggio del
 * problema, perche' il dato falso non lo riconosce piu' nessuno.
 */
export function problemaDataNascita(iso: string): string | null {
  if (!iso?.trim()) return null;

  const p = pezzi(iso);
  if (!p) return 'Questa data non esiste: scrivila come 31/08/1989.';

  const eta = etaDa(iso);
  if (eta === null) return 'Questa data non esiste: scrivila come 31/08/1989.';
  if (eta < 0) return 'La data di nascita è nel futuro: controlla l\'anno.';
  if (eta > ETA_MASSIMA) {
    return `Con questa data avrebbe ${eta} anni: hai scritto ${p.anno}, controlla l'anno.`;
  }
  return null;
}

/**
 * Un dubbio, non un errore: si scrive sotto e si va avanti lo stesso.
 *
 * Nata quest'anno vuol dire quasi sempre anno sbagliato (2026 al posto di
 * 1926, o del giorno dell'appuntamento battuto per sbaglio); minorenne vuol
 * dire che al banco serve un genitore. Nessuna delle due impedisce di salvare.
 */
export function avvisoDataNascita(iso: string): string | null {
  const eta = etaDa(iso);
  if (eta === null) return null;
  if (eta <= 1) return `Risulta nata quest'anno (${eta === 0 ? 'meno di un anno' : '1 anno'}): sicuro dell'anno?`;
  if (eta < ETA_MINORENNE) return `Ha ${eta} anni: è minorenne, per i trattamenti serve il consenso di un genitore.`;
  return null;
}
