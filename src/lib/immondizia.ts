/**
 * Il calendario dell'immondizia.
 *
 * Sembra una sciocchezza e invece è la cosa che si sbaglia più spesso: il
 * sacco si porta fuori la sera prima, chi chiude non è mai la stessa persona,
 * e "stasera cosa si caccia?" finisce per essere una domanda a cui risponde
 * chi se lo ricorda. Sbagliare vuol dire sacchi lasciati sul marciapiede fino
 * alla settimana dopo, e ogni tanto una multa.
 *
 * Qui il calendario si scrive una volta e il gestionale dice ogni sera cosa
 * tocca, senza che nessuno debba ricordarsi niente.
 */

export type TipoRifiuto = 'organico' | 'plastica' | 'carta' | 'vetro' | 'indifferenziata';

export interface Rifiuto {
  id: TipoRifiuto;
  nome: string;
  /** Come lo chiamano tutti, per farlo riconoscere al volo. */
  soprannome: string;
  emoji: string;
  /** Il colore del sacco o del mastello: si riconosce prima di leggere. */
  colore: string;
}

export const RIFIUTI: Rifiuto[] = [
  { id: 'organico', nome: 'Organico', soprannome: 'umido, avanzi', emoji: '🟤', colore: '#8B5E3C' },
  { id: 'plastica', nome: 'Plastica e metalli', soprannome: 'bottiglie, lattine', emoji: '🟡', colore: '#EAB308' },
  { id: 'carta', nome: 'Carta e cartone', soprannome: 'scatole, fogli', emoji: '🔵', colore: '#3B82F6' },
  { id: 'vetro', nome: 'Vetro', soprannome: 'bottiglie, vasetti', emoji: '🟢', colore: '#22C55E' },
  { id: 'indifferenziata', nome: 'Indifferenziata', soprannome: 'secco, quello che resta', emoji: '⚫', colore: '#6B7280' },
];

export function rifiuto(id: string): Rifiuto | undefined {
  return RIFIUTI.find(r => r.id === id);
}

/** 1 = lunedì … 6 = sabato. La domenica non si porta fuori niente. */
export const GIORNI: { n: number; nome: string; corto: string }[] = [
  { n: 1, nome: 'Lunedì', corto: 'Lun' },
  { n: 2, nome: 'Martedì', corto: 'Mar' },
  { n: 3, nome: 'Mercoledì', corto: 'Mer' },
  { n: 4, nome: 'Giovedì', corto: 'Gio' },
  { n: 5, nome: 'Venerdì', corto: 'Ven' },
  { n: 6, nome: 'Sabato', corto: 'Sab' },
];

export interface CalendarioImmondizia {
  /** Per ogni giorno di raccolta (1–6), cosa passano a prendere. */
  giorni: Record<string, TipoRifiuto[]>;
  /**
   * Il sacco si porta fuori la sera prima della raccolta. Se in zona si esce
   * la mattina stessa, questo si spegne e l'avviso parla del giorno corrente.
   */
  seraPrima: boolean;
}

export const CALENDARIO_VUOTO: CalendarioImmondizia = { giorni: {}, seraPrima: true };

/** Che giorno della settimana è, in Italia. 0 = domenica. */
export function giornoSettimana(d: Date = new Date()): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nome);
}

export interface TocaStasera {
  /** Il giorno della raccolta (non della sera in cui si porta fuori). */
  giornoRaccolta: number;
  nomeGiorno: string;
  tipi: Rifiuto[];
  /** Vero se il sacco va portato fuori stasera; falso se la raccolta è oggi stesso. */
  stasera: boolean;
}

/**
 * Cosa si porta fuori adesso.
 *
 * Con `seraPrima` acceso si guarda il giorno dopo: stasera esce il sacco della
 * raccolta di domani. Altrimenti si guarda oggi.
 */
export function cosaTocca(cal: CalendarioImmondizia, ora: Date = new Date()): TocaStasera | null {
  const oggi = giornoSettimana(ora);
  const bersaglio = cal.seraPrima ? (oggi + 1) % 7 : oggi;
  if (bersaglio === 0) return null; // domenica: non passa nessuno
  const tipi = (cal.giorni[String(bersaglio)] || []).map(rifiuto).filter(Boolean) as Rifiuto[];
  if (tipi.length === 0) return null;
  return {
    giornoRaccolta: bersaglio,
    nomeGiorno: GIORNI.find(g => g.n === bersaglio)?.nome || '',
    tipi,
    stasera: cal.seraPrima,
  };
}
