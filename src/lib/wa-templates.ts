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
      'Ti aspettiamo in Via Caudina 30, Maddaloni. Se ti serve spostarlo, rispondi a questo messaggio.',
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
    // Nome nuovo perché il testo è cambiato: Meta non lascia modificare il
    // corpo di un template già approvato, se ne fa approvare un altro. Il
    // vecchio `auguri_compleanno` resta lì finché non lo si cancella a mano.
    name: 'auguri_compleanno_v2',
    category: 'MARKETING',
    language: 'it',
    params: ['nome cliente', 'regalo (es. "il 20%" o "una Lampada")', 'data di scadenza'],
    body:
      'Buon compleanno {{1}}! 🎉\n' +
      'Da parte di tutte noi di RevoBeauty un regalo per te: {{2}} sul prossimo trattamento, da usare entro il {{3}}.\n' +
      'Passa a trovarci, ti aspettiamo!',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Prenota ora' },
      { type: 'QUICK_REPLY', text: 'Non inviarmi piu\' messaggi' },
    ],
    note:
      'Il testo precedente ("RevoBeauty ti riserva… valido fino al…") suonava da circolare. ' +
      'Il regalo {{2}} deve reggere sia uno sconto ("il 20%") sia un trattamento ("una Lampada"): ' +
      'per questo la frase dice "un regalo per te: X sul prossimo trattamento" e non "un regalo: X".',
  },

  copriBuchi: {
    name: 'slot_liberato',
    category: 'MARKETING',
    language: 'it',
    params: ['nome cliente', 'trattamento (es. "Refill unghie")', 'giorno e ora (es. "oggi alle 16:30")'],
    body:
      'Ciao {{1}}, si è appena liberato un posto da RevoBeauty per {{2}}: {{3}}.\n' +
      'Lo tieni tu? Rispondi con il bottone qui sotto — lo prende la prima che risponde.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Lo prendo io' },
      { type: 'QUICK_REPLY', text: 'Non stavolta' },
    ],
    note:
      'Copri buchi: parte quando una cliente disdice e resta un posto vuoto in giornata. Va a ' +
      'blocchi di dieci clienti attive, con mezz\'ora fra un blocco e l\'altro, e si ferma alla ' +
      'prima che dice sì. È MARKETING, quindi solo a chi ha dato il consenso.',
  },

  copriBuchiPreso: {
    name: 'slot_gia_preso',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente'],
    body:
      'Grazie {{1}}! Purtroppo il posto l\'ha appena preso un\'altra cliente.\n' +
      'Ti avvisiamo al prossimo che si libera. A presto!',
    note:
      'Risposta a chi dice sì dopo che il posto è già andato. Senza, la seconda che risponde ' +
      'resta senza risposta e rischia di presentarsi lo stesso. È UTILITY: risponde a un ' +
      'messaggio suo, non propone niente.',
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

  /**
   * La richiesta di recensione col link, che il primo template non ha mai avuto.
   *
   * `richiesta_recensione` è stato approvato SENZA il bottone: alle clienti
   * arriva "ci lasci una recensione?" e nient'altro — nessun link, nessuna
   * indicazione di dove andare. Chi ci prova cerca il centro su Maps, sbaglia
   * scheda (a Marcianise ce n'è un'altra) o lascia perdere.
   *
   * Un template approvato non si modifica dal gestionale, quindi la versione
   * col bottone deve avere un nome nuovo. Il testo cambia anche nel corpo:
   * dice esplicitamente di toccare il bottone qui sotto, perché su WhatsApp
   * il bottone è staccato dal messaggio e chi non lo aspetta non lo vede.
   */
  reviewV2: {
    name: 'richiesta_recensione_link',
    category: 'UTILITY',
    language: 'it',
    params: ['nome cliente', 'trattamento'],
    body:
      'Ciao {{1}}, grazie per essere venuta da RevoBeauty per {{2}}.\n' +
      'Ci lasci una recensione su Google? Tocca il bottone qui sotto: si apre la pagina del centro, ' +
      'scegli le stelle e hai finito. Sono 30 secondi e per noi valgono tantissimo.',
    buttons: [{ type: 'URL', text: 'Lascia la recensione', link: 'review-redirect' }],
    note:
      'È la versione col bottone URL di `richiesta_recensione`. Il link non sta nel corpo ma nel ' +
      'bottone: così il testo resta UTILITY (niente consenso marketing) e l\'indirizzo si può cambiare ' +
      'senza rifare l\'approvazione, perché punta al nostro /r/recensione e non a Google.\n' +
      'Nome diverso dal primo perché Meta non lascia riscrivere un template già approvato, e lo stesso ' +
      'nome non si può riusare per 30 giorni dopo la cancellazione.',
  },

  /**
   * L'affiliato scopre di aver guadagnato mentre succede.
   *
   * Finora l'unico modo per saperlo era aprire il portale col link che gli
   * avevamo mandato a mano: nessuno lo fa, e un affiliato che non vede
   * arrivare niente smette di mandare gente nel giro di un mese.
   *
   * Non si dice CHI è la cliente né cosa ha fatto: l'affiliato ha diritto ai
   * suoi soldi, non alla scheda della persona. È anche l'unico modo per non
   * trasformare un accordo commerciale in una fuga di dati.
   */
  affiliatoIncasso: {
    name: 'affiliato_incasso',
    category: 'UTILITY',
    language: 'it',
    params: ['nome referente', 'quanto ha speso', 'quanto guadagna lui'],
    body:
      'Ciao {{1}}, una persona che ci hai mandato tu oggi ha speso {{2}} da RevoBeauty.\n' +
      'La tua parte è {{3}}. Grazie!',
    note:
      'Avviso al partner del programma affiliazione, non al cliente finale. È UTILITY perché ' +
      'riguarda un accordo commerciale in corso, non una promozione. Niente nome della cliente: ' +
      'l\'affiliato ha diritto alla sua percentuale, non ai dati di chi entra.',
  },

  /**
   * Il conto del mese, il primo del mese.
   *
   * Serve a chiudere il cerchio: gli avvisi singoli fanno vedere il movimento,
   * questo fa vedere il totale — ed è il numero su cui si litiga se non lo
   * mandi tu per primo.
   */
  affiliatoMese: {
    name: 'affiliato_mese',
    category: 'UTILITY',
    language: 'it',
    params: ['nome referente', 'mese appena chiuso', 'quanto ha guadagnato', 'quante persone'],
    body:
      'Ciao {{1}}, ecco il riepilogo di {{2}}.\n' +
      'Hai guadagnato {{3}} grazie a {{4}} che sono venute da noi.\n' +
      'Grazie di cuore, a presto!',
    note:
      'Riepilogo mensile al partner: parte il primo del mese sul mese appena chiuso. Il quarto ' +
      'parametro è già scritto per esteso ("3 persone" / "una persona"), così il messaggio regge ' +
      'anche al singolare senza dover approvare due template.',
  },

  codiceApp: {
    name: 'codice_accesso_app',
    category: 'UTILITY',
    language: 'it',
    params: ['codice a 6 cifre'],
    body:
      'Il tuo codice per entrare nell\'app RevoBeauty è {{1}}\n' +
      'Vale 5 minuti e si usa una volta sola. Non condividerlo con nessuno: chi ce l\'ha entra nel tuo account.\n' +
      'Se non hai chiesto tu di accedere, ignora questo messaggio.',
    note:
      'Codice usa-e-getta per l\'accesso all\'app clienti. È UTILITY e non AUTHENTICATION perché ' +
      'Meta non lascia creare i template di autenticazione dalle API: parte comunque solo su ' +
      'richiesta della cliente, quindi non serve consenso marketing.',
  },
  omaggio: {
    name: 'omaggio_inaugurazione',
    category: 'MARKETING',
    language: 'it',
    params: ['nome contatto', 'trattamento omaggio'],
    body:
      'Ciao {{1}}, ti scriviamo da RevoBeauty: la tua seduta omaggio di {{2}} ti sta ancora aspettando.\n' +
      'Quando ti fa comodo prenotarla? Rispondi a questo messaggio con il giorno che preferisci e la fissiamo noi.\n' +
      'Ti aspettiamo in Via Caudina 30, Maddaloni.',
    note:
      'Campagna una tantum verso chi ha scaricato il coupon dell\'inaugurazione e non ha ancora ' +
      'prenotato. Non è a orario: parte a mano dalla pagina Inaugurazione. È MARKETING, quindi va ' +
      'solo a chi non ha revocato il consenso e ogni contatto la riceve una volta sola.',
  },
} as const satisfies Record<string, WaTemplate>;

export type TemplateKey = keyof typeof WA_TEMPLATES;

/**
 * Il messaggio con cui il centro scrive per primo.
 *
 * Sta fuori da WA_TEMPLATES perché non lo manda nessuna automazione: lo manda
 * un'operatrice, a mano, dalla chat. Serve da quando il numero è passato su
 * WABA e WhatsApp sul telefono non si apre più: l'unico modo di contattare una
 * cliente è il gestionale, e Meta lo consente solo con un template approvato.
 * Gli altri template non vanno bene, parlano tutti di un appuntamento o di una
 * promozione.
 *
 * È UTILITY e non MARKETING perché non propone niente: risponde a chi ha
 * chiesto lei di essere contattata. Costa meno e Meta lo approva senza storie,
 * a patto che non prometta sconti — e infatti non ne promette.
 */
export const NOME_APERTURA = 'apertura_conversazione';
export const TESTO_APERTURA =
  'Ciao {{1}}, ti scriviamo da RevoBeauty.\n' +
  'Rispondi pure a questo messaggio: dicci di cosa hai bisogno e quando ti fa comodo, e ti troviamo posto.\n' +
  'Ti aspettiamo in Via Caudina 30, Maddaloni.';

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
