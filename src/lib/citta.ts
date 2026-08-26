/**
 * I nomi delle città, scritti da mani diverse.
 *
 * In rubrica la stessa città compare in cinque modi: "maddaloni", "Maddaloni",
 * "Maddalomi", "mjaddaloni", "Maddazaloni". Contandoli come sono, la città
 * principale del centro risulta divisa in cinque righe e nessuna statistica
 * dice la verità.
 *
 * Qui si riportano alla stessa forma. Con un'attenzione che vale più della
 * pulizia: "Valle di Maddaloni" è un altro paese, non un errore di battitura.
 * Per questo due nomi si uniscono solo se hanno lo STESSO numero di parole e
 * differiscono per un paio di lettere — così i refusi si aggiustano e i paesi
 * vicini restano distinti.
 */

const via = (s: string) => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z\s']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Come si scrive: "san felice a cancello" → "San Felice a Cancello". */
const PICCOLE = new Set(['a', 'di', 'da', 'del', 'della', 'in', 'sul', 'sulla', 'e']);
function bella(nome: string): string {
  return nome.split(' ').map((p, i) =>
    i > 0 && PICCOLE.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

/** Quante correzioni servono per passare da una parola all'altra. */
function distanza(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length];
}

/**
 * Raggruppa i nomi scritti male sotto quello scritto più spesso.
 * Torna una mappa: come è scritto in scheda → come va contato.
 */
export function riconciliaCitta(valori: string[]): Map<string, string> {
  const conteggio = new Map<string, number>();
  for (const v of valori) {
    const k = via(v);
    if (!k) continue;
    conteggio.set(k, (conteggio.get(k) || 0) + 1);
  }
  // I più frequenti fanno da riferimento: è quasi sempre la grafia giusta.
  const ordinati = [...conteggio.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const capofila = new Map<string, string>();
  for (const nome of ordinati) {
    const parole = nome.split(' ').length;
    const simile = ordinati.find(altro =>
      altro !== nome
      && (conteggio.get(altro) || 0) > (conteggio.get(nome) || 0)
      && altro.split(' ').length === parole
      && distanza(altro, nome) <= 2,
    );
    capofila.set(nome, simile ? (capofila.get(simile) || simile) : nome);
  }

  const finale = new Map<string, string>();
  for (const v of valori) {
    const k = via(v);
    if (!k) continue;
    finale.set(v, bella(capofila.get(k) || k));
  }
  return finale;
}
