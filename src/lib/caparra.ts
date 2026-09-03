/**
 * La caparra: il posto si tiene se qualcosa e' stato lasciato.
 *
 * Il buco in agenda e' il costo piu' alto che c'e', e non si vede: l'ora resta
 * vuota, l'operatrice e' pagata lo stesso, e chi voleva quel posto ha gia'
 * prenotato altrove. Chiedere una caparra e' l'unico modo che funziona
 * davvero — chi ha lasciato venti euro, viene.
 *
 * Qui dentro c'e' la regola (a chi si chiede, quanto, entro quando) e lo stato
 * della singola caparra. Il pagamento vero puo' arrivare in due modi:
 *
 *  - AUTOMATICO, se e' configurata la chiave Stripe: la cliente paga online
 *    subito dopo aver prenotato e l'appuntamento si conferma da solo;
 *  - A MANO, altrimenti: parte un messaggio col link di pagamento del centro
 *    (Satispay, PayPal, quello che si vuole) e chi e' al banco segna quando
 *    arriva. Nessuna carta passa dal gestionale.
 *
 * La caparra pagata non e' un incasso in piu': al check-out si scala dal
 * conto. Diventa incasso solo se la cliente non si presenta — e allora si
 * trattiene, ma quella e' una decisione che prende una persona, non il
 * software.
 */

export type StatoCaparra = 'attesa' | 'pagata' | 'trattenuta' | 'restituita' | 'usata';

export interface Caparra {
  /** Quanto e' stato chiesto. */
  richiesta: number;
  stato: StatoCaparra;
  /** Come e' stata pagata: 'stripe' | 'link' | 'contanti' | 'carta'… */
  metodo?: string;
  /** Il link mandato alla cliente per pagare. */
  link?: string;
  chiestaIl?: string;
  pagataIl?: string;
  /** Entro quando deve arrivare: dopo, il posto non si tiene piu'. */
  scadenza?: string;
  /** La riga di cassa, quando la caparra e' stata trattenuta o incassata. */
  txId?: string;
  nota?: string;
  /** Chi l'ha segnata a mano. */
  segnataDa?: string;
}

export interface RegoleCaparra {
  attiva: boolean;
  /** Quanto: una cifra fissa, oppure una percentuale del conto. */
  tipo: 'fissa' | 'percentuale';
  importo: number;
  /** Non si chiede sotto questo conto: per una ceretta da 15 € e' un'offesa. */
  minimoConto: number;
  /** Ore entro cui deve arrivare, altrimenti il posto si libera. */
  oreValidita: number;
  /** Entro quante ore dall'appuntamento si puo' disdire senza perderla. */
  oreDisdetta: number;
  /**
   * A chi si chiede:
   *  - 'tutte': sempre (dove il conto supera il minimo)
   *  - 'nuove': solo a chi non e' mai venuta
   *  - 'inaffidabili': solo a chi ha gia' saltato appuntamenti
   *  - 'categorie': solo per certi trattamenti (laser, cabina lunga…)
   */
  aChi: 'tutte' | 'nuove' | 'inaffidabili' | 'categorie';
  /** Le categorie per cui vale, quando `aChi` e' 'categorie'. */
  categorie: string[];
  /** Il link di pagamento del centro, per la modalita' a mano. */
  linkPagamento: string;
  /** Il testo che accompagna il link su WhatsApp. */
  messaggio: string;
}

export const REGOLE_CAPARRA_DEFAULT: RegoleCaparra = {
  attiva: false,
  tipo: 'fissa',
  importo: 20,
  minimoConto: 40,
  oreValidita: 24,
  oreDisdetta: 24,
  aChi: 'inaffidabili',
  categorie: [],
  linkPagamento: '',
  messaggio: '',
};

/** Quanto si chiede per questo conto, secondo le regole. Zero = non si chiede. */
export function importoCaparra(regole: RegoleCaparra, conto: number): number {
  if (!regole.attiva || conto < regole.minimoConto) return 0;
  const grezzo = regole.tipo === 'percentuale'
    ? (conto * regole.importo) / 100
    : regole.importo;
  // Mai piu' del conto: una caparra piu' alta del trattamento non e' una
  // caparra, e' un pagamento anticipato mascherato.
  return Math.min(Math.round(grezzo * 100) / 100, conto);
}

/** Vero se a questa cliente, per questo trattamento, la caparra va chiesta. */
export function serveCaparra(regole: RegoleCaparra, dati: {
  conto: number;
  categorie: string[];
  clienteNuova: boolean;
  saltiPrecedenti: number;
}): boolean {
  if (!regole.attiva) return false;
  if (dati.conto < regole.minimoConto) return false;
  switch (regole.aChi) {
    case 'tutte': return true;
    case 'nuove': return dati.clienteNuova;
    case 'inaffidabili': return dati.saltiPrecedenti > 0;
    case 'categorie': return dati.categorie.some(c => regole.categorie.includes(c));
    default: return false;
  }
}

/** Il testo del messaggio, con dentro cifra, link e scadenza. */
export function testoRichiesta(regole: RegoleCaparra, dati: {
  nome: string; importo: number; quando: string; link: string; scadenzaOre: number;
}): string {
  if (regole.messaggio.trim()) {
    return regole.messaggio
      .replace(/\{nome\}/g, dati.nome)
      .replace(/\{importo\}/g, dati.importo.toFixed(2).replace('.', ','))
      .replace(/\{quando\}/g, dati.quando)
      .replace(/\{link\}/g, dati.link)
      .replace(/\{ore\}/g, String(dati.scadenzaOre));
  }
  return `Ciao ${dati.nome}! Per tenerti il posto di ${dati.quando} ti chiediamo una caparra di ${dati.importo.toFixed(2).replace('.', ',')} €. `
    + `La scaliamo dal conto il giorno del trattamento. Puoi pagarla qui: ${dati.link} `
    + `(entro ${dati.scadenzaOre} ore, poi l'orario torna libero). Grazie!`;
}

/** Come si legge lo stato, per chi guarda l'agenda. */
export function descriviStato(c: Caparra): { testo: string; tono: 'attesa' | 'ok' | 'persa' } {
  switch (c.stato) {
    case 'pagata': return { testo: `Caparra di ${eur(c.richiesta)} pagata`, tono: 'ok' };
    case 'usata': return { testo: `Caparra di ${eur(c.richiesta)} scalata dal conto`, tono: 'ok' };
    case 'trattenuta': return { testo: `Caparra di ${eur(c.richiesta)} trattenuta`, tono: 'persa' };
    case 'restituita': return { testo: `Caparra di ${eur(c.richiesta)} restituita`, tono: 'persa' };
    default: return { testo: `Caparra di ${eur(c.richiesta)} da pagare`, tono: 'attesa' };
  }
}

function eur(n: number): string {
  return `${(n || 0).toFixed(2).replace('.', ',')} €`;
}

/** Scaduta e mai pagata: il posto non si tiene piu'. */
export function caparraScaduta(c: Caparra | null | undefined, adesso = new Date()): boolean {
  if (!c || c.stato !== 'attesa' || !c.scadenza) return false;
  const t = Date.parse(c.scadenza);
  return !Number.isNaN(t) && t < adesso.getTime();
}
