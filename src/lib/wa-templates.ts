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

import { reviewRedirectUrl } from '@/lib/links';

export type TemplateCategory = 'UTILITY' | 'MARKETING';

/**
 * Destinazioni ammesse per un bottone URL.
 *
 * Non si scrive l'indirizzo qui dentro: gli URL veri vivono in lib/links.ts e
 * dipendono dall'ambiente (ERP_URL). Il catalogo nomina la destinazione, chi
 * gliela serve è `resolveButtonUrl`.
 */
export type ButtonLink = 'review-redirect';

/**
 * Bottone del template, come approvato su Meta.
 *
 * Era una riga di prosa ("Confermo (risposta rapida)"), che andava bene finché
 * serviva solo da promemoria per chi creava il template a mano. Da quando
 * l'anteprima e l'archivio devono mostrare i bottoni davvero mandati, serve il
 * dato strutturato: l'etichetta esatta e, per gli URL, dove portano.
 */
export interface WaTemplateButton {
  type: 'URL' | 'QUICK_REPLY';
  /** Etichetta esatta approvata su Meta (max 25 caratteri). */
  text: string;
  /** Solo per i bottoni URL: quale link del gestionale aprono. */
  link?: ButtonLink;
}

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
  buttons?: readonly WaTemplateButton[];
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
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confermo' },
      { type: 'QUICK_REPLY', text: 'Devo spostare' },
    ],
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
    buttons: [
      { type: 'QUICK_REPLY', text: 'Voglio prenotare' },
      { type: 'QUICK_REPLY', text: 'Non inviarmi piu\' messaggi' },
    ],
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
    buttons: [
      { type: 'QUICK_REPLY', text: 'Prenota ora' },
      { type: 'QUICK_REPLY', text: 'Non inviarmi piu\' messaggi' },
    ],
  },

  review: {
    name: 'richiesta_recensione',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente', 'trattamento'],
    body:
      'Ciao {{1}}, grazie per la tua visita da RevoBeauty per {{2}}.\n' +
      'Se ti è piaciuta l\'esperienza, ci lasci una recensione? Bastano 30 secondi e per noi conta molto.',
    buttons: [{ type: 'URL', text: 'Lascia una recensione', link: 'review-redirect' }],
    note:
      'Il link Google va messo come bottone URL statico in fase di approvazione, non nel corpo: così il ' +
      'testo resta UTILITY. Se Meta lo riclassifica MARKETING, servirà il consenso marketing.\n' +
      'Quale link: quello in GOOGLE_REVIEW_URL (lib/links.ts), che punta alla scheda di Maddaloni. Su Google ' +
      'esiste anche una seconda scheda "Revo Beauty" a Marcianise: con quella le recensioni finirebbero ' +
      'sull\'altra sede. Non vale un indirizzo copiato dalla barra durante una ricerca Google: contiene token ' +
      'di sessione (sxsrf, ved, si) e le dimensioni della finestra di chi l\'ha copiato, quindi altrove può scadere.',
  },

  omaggio: {
    name: 'omaggio_inaugurazione',
    category: 'MARKETING',
    language: 'it',
    params: ['nome contatto', 'trattamento omaggio'],
    body:
      'Ciao {{1}}, ti scriviamo da RevoBeauty: la tua seduta omaggio di {{2}} ti sta ancora aspettando.\n' +
      'Quando ti fa comodo prenotarla? Rispondi a questo messaggio con il giorno che preferisci e la fissiamo noi.\n' +
      'Ti aspettiamo in Via Caudina, Maddaloni.',
    note:
      'Campagna una tantum verso chi ha scaricato il coupon dell\'inaugurazione e non ha ancora ' +
      'prenotato. Non è a orario: parte a mano dalla pagina Inaugurazione. È MARKETING, quindi va ' +
      'solo a chi non ha revocato il consenso e ogni contatto la riceve una volta sola.',
  },
} as const satisfies Record<string, WaTemplate>;

export type TemplateKey = keyof typeof WA_TEMPLATES;

/** Le automazioni che mandano messaggi di marketing (servono consenso + opt-out). */
export function isMarketing(key: TemplateKey): boolean {
  return WA_TEMPLATES[key].category === 'MARKETING';
}

/** Indirizzo vero dietro il nome della destinazione di un bottone URL. */
export function resolveButtonUrl(link: ButtonLink): string {
  switch (link) {
    case 'review-redirect':
      return reviewRedirectUrl();
  }
}

/**
 * I bottoni di un template in forma leggibile, per l'anteprima e per l'archivio
 * conversazioni.
 *
 * Esiste perché il corpo del messaggio da solo mente: nel template recensione
 * il link NON sta nel testo, sta solo nel bottone. Chi guardava l'anteprima o la
 * chat dal gestionale vedeva un invito a lasciare una recensione senza nessun
 * link e concludeva, ragionevolmente, che il link non fosse partito.
 */
export function templateButtonLabels(key: TemplateKey): string[] {
  // Il passaggio per WaTemplate non è decorativo: `WA_TEMPLATES` è dichiarato
  // `as const`, quindi i template senza bottoni non hanno proprio la chiave
  // `buttons` e leggerla dall'unione non compilerebbe.
  const tpl: WaTemplate = WA_TEMPLATES[key];
  const buttons = tpl.buttons;
  if (!buttons?.length) return [];
  return buttons.map(b =>
    b.type === 'URL'
      ? `${b.text} → ${b.link ? resolveButtonUrl(b.link) : 'link statico'}`
      : `${b.text} (risposta rapida)`
  );
}

/**
 * Meta rifiuta i parametri con a capo, tab o spazi multipli consecutivi.
 * Meglio normalizzare qui che scoprirlo con un 132005 in produzione.
 */
export function sanitizeParam(value: string, fallback = '-'): string {
  const clean = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return clean || fallback;
}
