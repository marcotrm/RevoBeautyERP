/**
 * Catalogo dei template WhatsApp usati dalle automazioni.
 *
 * Ogni voce qui deve avere un template OMONIMO approvato su 360dialog Hub
 * (Templates → New). Il campo `body` è esattamente il testo da incollare in
 * fase di creazione: se cambi il testo qui senza rifare l'approvazione, Meta
 * risponde 132001/132000 e il messaggio non parte.
 *
 * Categoria Meta:
 *  - UTILITY   → legata a una transazione in corso (appuntamento). Costo basso,
 *               approvazione facile, non richiede consenso marketing.
 *  - MARKETING → promozionale. Richiede consenso marketing esplicito del cliente
 *               (Client.marketingConsent) e costa di più.
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export interface WaTemplate {
  /** Nome tecnico: minuscolo, underscore. Deve combaciare con quello su 360dialog. */
  name: string;
  category: TemplateCategory;
  language: string;
  /** Descrizione dei parametri posizionali, in ordine. */
  params: string[];
  /** Testo esatto da far approvare. */
  body: string;
  /** Bottoni da configurare in fase di approvazione. */
  buttons?: string[];
  note?: string;
}

/**
 * Nota sui testi: RevoBeauty è un centro di medicina estetica, non un salone.
 * Due conseguenze sulla copy:
 *  - niente concordanze al femminile ("passata", "trovata"): la clientela è mista;
 *  - nei template MARKETING non si nominano procedure mediche (filler, botox,
 *    laser). Meta è restrittiva sui contenuti sanitari e li rifiuta o li fa
 *    passare per revisione manuale: si parla di "trattamento" e basta.
 */
export const WA_TEMPLATES = {
  confirm: {
    name: 'conferma_appuntamento',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente', 'trattamento', 'data', 'ora'],
    body:
      'Ciao {{1}}, il tuo appuntamento da RevoBeauty per {{2}} è confermato: {{3}} alle {{4}}.\n' +
      'Ti aspettiamo in Via Caudina, Maddaloni. Se ti serve spostarlo, rispondi a questo messaggio.',
    note:
      'Parte subito dopo la creazione dell\'appuntamento, non a orario fisso. È il primo contatto ' +
      'della conversazione, quindi deve essere un template: a quel punto il cliente non ci ha ancora ' +
      'scritto e la finestra 24h non è aperta.',
  },

  reminder: {
    name: 'promemoria_appuntamento',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente', 'trattamento', 'data', 'ora'],
    body:
      'Ciao {{1}}, ti ricordiamo il tuo appuntamento da RevoBeauty per {{2}}: {{3}} alle {{4}}.\n' +
      'Se hai bisogno di spostarlo, rispondi a questo messaggio. A presto!',
    buttons: ['Confermo (risposta rapida)', 'Devo spostare (risposta rapida)'],
    note: 'I due bottoni di risposta rapida aprono la finestra 24h: dopo che il cliente ne tocca uno potete rispondere a testo libero senza costi di template.',
  },

  recall: {
    name: 'recall_cliente_dormiente',
    category: 'MARKETING',
    language: 'it',
    params: ['nome cliente'],
    body:
      'Ciao {{1}}, è passato un po\' dal tuo ultimo trattamento da RevoBeauty.\n' +
      'Se vuoi riprendere il percorso o valutare qualcosa di nuovo, rispondi a questo messaggio: troviamo insieme il momento giusto.',
    buttons: ['Voglio prenotare (risposta rapida)', 'Non inviarmi più messaggi (opt-out)'],
    note: 'Marketing: parte solo ai clienti con consenso marketing. Il bottone di opt-out è richiesto da Meta sulle categorie marketing ed è già gestito nel webhook.',
  },

  birthday: {
    name: 'auguri_compleanno',
    category: 'MARKETING',
    language: 'it',
    params: ['nome cliente', 'sconto (es. "il 20%")', 'data di scadenza'],
    body:
      'Tanti auguri {{1}}! Per il tuo compleanno RevoBeauty ti riserva {{2}} sul prossimo trattamento, valido fino al {{3}}.\n' +
      'Scrivici per fissare l\'appuntamento: ti aspettiamo.',
    buttons: ['Prenota ora (risposta rapida)', 'Non inviarmi più messaggi (opt-out)'],
  },

  review: {
    name: 'richiesta_recensione',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente', 'trattamento'],
    body:
      'Ciao {{1}}, grazie per la tua visita da RevoBeauty per {{2}}.\n' +
      'Se ti è piaciuta l\'esperienza, ci lasci una recensione? Bastano 30 secondi e per noi conta molto.',
    buttons: ['Lascia una recensione (bottone URL statico verso il link Google)'],
    note: 'Il link Google va messo come bottone URL statico in fase di approvazione, non nel corpo: così il testo resta UTILITY. Se Meta lo riclassifica MARKETING, servirà il consenso marketing.',
  },
} as const satisfies Record<string, WaTemplate>;

export type TemplateKey = keyof typeof WA_TEMPLATES;

/** Le automazioni che mandano messaggi di marketing (servono consenso + opt-out). */
export function isMarketing(key: TemplateKey): boolean {
  return WA_TEMPLATES[key].category === 'MARKETING';
}

/**
 * Meta rifiuta i parametri con a capo, tab o spazi multipli consecutivi.
 * Meglio normalizzare qui che scoprirlo con un 132005 in produzione.
 */
export function sanitizeParam(value: string, fallback = '-'): string {
  const clean = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return clean || fallback;
}
