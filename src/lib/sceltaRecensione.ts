/**
 * Quale dei due messaggi di richiesta recensione mandare.
 *
 * Sul WhatsApp del centro ce ne sono due, tutti e due approvati e tutti e due
 * col bottone che apre la pagina delle recensioni:
 *
 *  - `richiesta_recensione` — categoria UTILITY (di servizio);
 *  - `richiesta_recensione_link` — categoria MARKETING (promozionale).
 *
 * Si sceglie quello DI SERVIZIO, e non è un cavillo: un messaggio di servizio
 * arriva a tutte le clienti (non serve il consenso marketing), costa meno a
 * messaggio, e soprattutto viene consegnato anche a chi ha detto a WhatsApp di
 * non voler ricevere promozioni da questo numero — a quelle persone i
 * promozionali spariscono senza errore, e dal gestionale sembra che tutto sia
 * andato bene.
 *
 * Il bottone è la ragione per cui il secondo template è nato: ora ce l'hanno
 * entrambi, quindi il primo non ha più svantaggi.
 */

export interface TemplateRemoto {
  name: string;
  status: string;
  category: string;
  language: string;
  buttons?: { type: string; url?: string }[];
}

export interface SceltaRecensione {
  /** Il nome del template da mandare, se ce n'è uno mandabile. */
  nome?: string;
  /** Vero se quello scelto ha il bottone col link. */
  conLink: boolean;
  /** Vero se quello scelto è promozionale: allora serve il consenso marketing. */
  promozionale: boolean;
  /** Perché non si può mandare, quando non si può. */
  problema?: string;
}

const haUrl = (t: TemplateRemoto) =>
  Boolean(t.buttons?.some(b => b.type.toUpperCase() === 'URL' && b.url));

const approvato = (t: TemplateRemoto) => t.status.toUpperCase() === 'APPROVED';
const italiano = (t: TemplateRemoto) => t.language.toLowerCase().startsWith('it');
const diServizio = (t: TemplateRemoto) => t.category.toUpperCase().startsWith('UTILITY');

/**
 * Sceglie fra i template che stanno davvero su WhatsApp.
 * `nomi` sono i due nomi del catalogo, in ordine di preferenza a parità di tutto.
 */
export function scegliRecensione(remoti: TemplateRemoto[], nomi: string[]): SceltaRecensione {
  const candidati = remoti.filter(t => nomi.includes(t.name) && italiano(t) && approvato(t));
  if (candidati.length === 0) {
    return { conLink: false, promozionale: false, problema: 'Nessun messaggio di richiesta recensione approvato su WhatsApp.' };
  }

  // Ordine: prima quelli col bottone, poi fra questi quelli di servizio.
  const ordinati = [...candidati].sort((a, b) => {
    if (haUrl(a) !== haUrl(b)) return haUrl(a) ? -1 : 1;
    if (diServizio(a) !== diServizio(b)) return diServizio(a) ? -1 : 1;
    return nomi.indexOf(a.name) - nomi.indexOf(b.name);
  });

  const scelto = ordinati[0];
  return {
    nome: scelto.name,
    conLink: haUrl(scelto),
    promozionale: !diServizio(scelto),
    problema: haUrl(scelto)
      ? undefined
      : 'Il messaggio approvato non ha il bottone col link: la cliente legge la richiesta ma non ha dove andare.',
  };
}
