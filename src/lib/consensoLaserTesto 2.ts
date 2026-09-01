/**
 * Il consenso informato per l'epilazione laser, come sta sul foglio.
 *
 * E' la trascrizione fedele del modulo cartaceo del centro: quello che la
 * cliente firma deve dire ESATTAMENTE quello che diceva prima, perche' e' un
 * documento che un giorno qualcuno potrebbe rileggere per capire cosa le era
 * stato spiegato. Non si riassume, non si "migliora" e non si aggiorna senza
 * dirlo a chi il centro lo manda avanti.
 *
 * Sta in un file suo e non dentro la pagina per una ragione pratica: il testo
 * cambia con le normative e con le macchine, la pagina no. Chi deve
 * correggere una frase la trova qui, senza attraversare del codice.
 */

export interface SezioneConsenso {
  titolo?: string;
  /** Paragrafi normali. */
  testo?: string[];
  /** Elenco puntato. */
  punti?: string[];
}

export const CONSENSO_LASER: SezioneConsenso[] = [
  {
    testo: [
      'Nel rapporto tra estetista e cliente si ritiene necessario ed eticamente corretto un ruolo consapevole e attivo di quest\'ultimo in relazione ai trattamenti ai quali volontariamente si sottopone. Per questa ragione con il presente documento Lei viene informato, e l\'operatore che glielo sottopone e contemporaneamente lo illustra Le fornirà ogni più ampia e chiara informazione necessaria alla sua comprensione e si accerterà che Lei abbia bene compreso quanto viene qui di seguito sottoposto alla Sua attenzione e alla finale sottoscrizione.',
      'Vi preghiamo di leggere con attenzione queste note al fine di garantire il miglior risultato del trattamento ed essere informati su eventuali controindicazioni o effetti collaterali.',
    ],
  },
  {
    titolo: 'Epilazione con laser diodo defocalizzato',
    testo: [
      'Il principio su cui si basa l\'epilazione laser è quello della fototermolisi selettiva secondo cui, utilizzando peculiari lunghezze d\'onda, si può ottenere un determinato effetto biologico con minimo danno sui tessuti circostanti. La luce laser, opportunamente regolata, raggiunge il follicolo pilifero fino alla regione del bulbo, dove viene assorbita e trasformata in calore con conseguente necrosi termica e caduta del pelo. Il trattamento è efficace quando il follicolo è in fase di crescita (anagen) ed essendo tale fase non contemporanea anche per follicoli presenti nel medesimo sito anatomico, sono necessari trattamenti multipli, intervallati di 4-5 settimane.',
      'Il laser a diodi (808 nm) è considerato il gold standard per l\'epilazione laser assistita. La lunghezza d\'onda di 808 nm è quella che meglio coniuga penetrazione nei tessuti e assorbimento da parte della melanina. Comunque la crescita dei peli è soggettiva e in particolare i soggetti con disfunzioni endocrine anche lievi, sottoposti a cure cortisoniche od ormonali tipo pillola contraccettiva, o con habitus ansioso-depressivo, potranno avere la ricrescita o la comparsa di nuovi peli. Di conseguenza, anche se questo trattamento è efficace nella maggior parte delle persone, non vi può essere a priori nessuna garanzia di efficacia per ciascun cliente.',
    ],
  },
  {
    titolo: 'Istruzioni per il trattamento di fotoepilazione progressiva',
    punti: [
      'È controindicato l\'uso di farmaci o sostanze fotosensibilizzanti: al momento del trattamento devono essere trascorsi almeno 2 settimane dall\'ultima assunzione di taluni farmaci e/o Vitamine A e K, o di farmaci contenenti acido retinoico o comunque fotosensibilizzanti (cortisone, ipoglicemizzanti, ansiolitici, tranquillanti, antibiotici). Per uso topico contenente acido retinoico può essere sufficiente un\'astensione di 8-10 giorni prima del trattamento.',
      'Nelle 3-4 settimane antecedenti il trattamento non effettuare depilazioni con cerette e/o pinzette e non decolorare i peli.',
      'Depilarsi con il rasoio 2 giorni prima del trattamento o utilizzare un taglia capelli regolato a 0,5 mm.',
      'Evitare l\'esposizione solare e a lampade UV per almeno 2 giorni prima e dopo il trattamento, né praticare sauna, bagno turco e esporsi a qualsiasi altra fonte di calore.',
      'Sospendere l\'uso di creme auto abbronzanti 30 giorni prima dell\'inizio del trattamento.',
      'Utilizzare una protezione solare totale dopo il trattamento.',
      'Evitare l\'impiego di acqua troppo calda nei giorni seguenti il trattamento e lavare la cute con acqua fredda/tiepida.',
      'Nei 2 giorni precedenti la seduta e il giorno della stessa non praticare peeling casalinghi con creme esfolianti, né cospargersi di profumi o tonici a base alcolica il giorno stesso del trattamento né prima né dopo il medesimo e nei giorni a seguire.',
      'Evitare traumatismi nella zona trattata per 1 settimana dopo la seduta (peelings, scrub…).',
      'Informare l\'operatore sull\'eventuale assunzione di farmaci sistemici contenenti acido retinoico.',
    ],
  },
  {
    titolo: 'Effetti indesiderati',
    punti: [
      'Bruciore e dolore durante l\'intervento di laserterapia, che dipende anche dalla sede della depilazione e dalla soglia del dolore personale.',
      'Rossore e gonfiore (edema), in genere per qualche ora o qualche giorno.',
      'Molto raramente ipopigmentazione (chiazze chiare) o iperpigmentazione (chiazze scure) che potrebbero durare fino a sei mesi, e ancora più raramente rimanere definitive.',
    ],
    testo: [
      'Possono anche comparire zone puntiformi di gonfiore e di edema, simili a quelle delle punture di insetti, a livello dei follicoli piliferi: ciò non è altro che l\'esito dell\'esplosione del pelo nel follicolo con conseguente danneggiamento del follicolo stesso, meccanismo che sta alla base di questo tipo di depilazione persistente e testimonianza del buon esito della terapia. A livello di questi punti o nelle zone più intensamente arrossate si può evidenziare anche un minimo scollamento cutaneo che porta alla formazione di micro-vescicole e quindi "crosticine" tipo intensa scottatura solare estiva.',
      'Durante la seduta BISOGNA proteggere gli occhi con appositi occhiali protettivi forniti dall\'operatore.',
    ],
  },
  {
    titolo: 'Controindicazioni',
    punti: [
      'Lesioni cutanee sospette per tumori o herpes nelle regioni da trattare.',
      'Disturbi della cicatrizzazione.',
      'Epilessia.',
      'Assunzione di vitamina A, vitamina K, isotretinoina, farmaci fotosensibilizzanti.',
      'Gravidanza.',
      'Non possono essere trattate persone che soffrono di patologie fotosensibili.',
    ],
  },
  {
    titolo: 'Comportamenti e precauzioni dopo il trattamento laser',
    punti: [
      'Non esporsi al sole o a raggi ultravioletti (lampade abbronzanti) prima del trattamento.',
      'Utilizzare una crema idratante/emolliente ed una protezione solare totale per le zone fotoesposte trattate.',
      'Evitare l\'impiego di acqua troppo calda, preferendo l\'acqua tiepida o fredda nei giorni immediatamente successivi al trattamento.',
    ],
  },
  {
    titolo: 'Effetti collaterali',
    testo: [
      'Come qualsiasi altro trattamento, la fotoepilazione con laser può presentare alcuni effetti collaterali; tra i più comuni si ricorda un transitorio eritema (arrossamento), dolorabilità, prurito ed edema (gonfiore), ipo o iperpigmentazioni e piccoli esiti cicatriziali. Esiste poi la possibilità, se le aree trattate non vengono adeguatamente protette dai raggi solari, che si verifichi una iperpigmentazione o una ipopigmentazione.',
      'Se lo ritiene necessario non abbia alcun timore nel richiedere tutte le ulteriori informazioni che crede utili al fine di risolvere eventuali dubbi o chiarire alcuni aspetti di quanto esposto che non ha pienamente compreso. La invitiamo pertanto, prima di prestare il Suo consenso scritto firmando il presente modulo, a chiarire con l\'operatore che glielo sottopone ogni aspetto che non Le appare sufficientemente comprensibile.',
    ],
  },
  {
    titolo: 'Presa d\'atto',
    testo: [
      'Preso atto di quanto sopra richiamato confermo che l\'operatore mi ha illustrato la natura del trattamento ed il metodo con il quale viene attuato, le problematiche estetiche che ne giustificano l\'effettuazione, i rischi a essa connessi e le eventuali alternative possibili, nonché di aver preso visione dei contenuti della sezione informativa di questo documento e di aver avuto la possibilità di discuterne il testo.',
      'Sono in particolare stato informato che l\'epilazione laser-assistita non è un metodo di epilazione definitivo, in quanto allo stato attuale non esiste nessun elemento scientifico che dimostri il carattere definitivo di questa forma di epilazione e che a tutt\'oggi è sicuramente l\'unica tecnica che permette di avere una riduzione della crescita pilifera nell\'area trattata in una percentuale che va dal 60% all\'80% e che permette di trattare aree pilifere molto vaste con minore rischio di effetti indesiderati e con un\'ottima tollerabilità da parte del cliente. Sono poi messo al corrente che subito dopo il trattamento potrò avere la comparsa di eritema, vescicole, erosioni, follicoliti, e talora alterazioni della pigmentazione.',
      'Inoltre sono stato messo al corrente che tale procedura può determinare rischi o complicanze per cause non inerenti al buon operato dell\'operatore e che non mi sono state fornite garanzie precise circa il risultato che otterrò con questo trattamento. In particolare mi è stato chiarito come l\'esposizione ai raggi ultravioletti nelle due settimane successive alla procedura sia da evitare, così come da evitare sono tutte le manovre traumatizzanti (sfregamento della zona trattata, utilizzo di detergenti inadeguati) che aumentano il rischio di effetti collaterali.',
      'Mi sono state segnalate le procedure alternative, i loro vantaggi e svantaggi, i rischi e i benefici e sono consapevole di averli rifiutati.',
    ],
  },
];

/** La dichiarazione finale, quella che sta subito sopra la firma. */
export const DICHIARAZIONE_FINALE = [
  'Certifico di essere maggiorenne. Nel caso in cui non avessi raggiunto la maggiore età, i miei genitori o chi esercita la tutela legale sulla mia persona firmerà unitamente a me il presente modulo dopo avere ricevuto le stesse informazioni che sono state a me date.',
  'Dichiaro che prima di firmare il presente "consenso informato" ho avuto la possibilità di leggere quanto sopra esposto e di aver potuto richiedere ulteriori informazioni aggiungere e di avere compreso quanto letto e ulteriormente spiegato.',
  'Letto quanto sopra con quanto allegato e ritenendo di averlo correttamente compreso e ottenuto i chiarimenti richiesti ACCONSENTO ad essere sottoposto al trattamento estetista/estetico di FOTOEPILAZIONE PROGRESSIVA.',
];

/** Il consenso alle foto: e' separato, perche' si puo' dire di no a quello e sì al resto. */
export const TESTO_FOTO =
  'Acconsento che l\'operatore acquisisca immagini della mia persona prima, durante e dopo il trattamento, '
  + 'per disporre di un riscontro obiettivo della situazione pre-trattamento e dei risultati ottenuti. '
  + 'Il centro garantisce che il materiale fotografico viene trattato solo ed esclusivamente dal personale addetto, '
  + 'a sostegno del trattamento e a scopo documentativo sui risultati ottenuti, a scopo di studio e/o didattico, garantendone la sicurezza.';

/**
 * Lo storico che la cliente dichiara.
 *
 * Sono le stesse domande della scheda diagnostica di carta, nello stesso
 * ordine. Le risposte non sono un dettaglio burocratico: cura ormonale,
 * farmaci fotosensibilizzanti, herpes e sole recente sono le cose che possono
 * far rimandare la seduta.
 */
export const DOMANDE_STORICO = [
  { id: 'ormonale', testo: 'Attualmente o in passato è stato/a sotto cura ormonale?', tipo: 'sino' as const },
  { id: 'farmaci', testo: 'Sta assumendo farmaci?', tipo: 'sino' as const, dettaglioSe: 'si', dettaglioEtichetta: 'Quali?' },
  {
    id: 'ultimoMetodo', testo: 'Ultimo metodo di depilazione utilizzato', tipo: 'scelta' as const,
    opzioni: ['Cera', 'Rasoio', 'Crema', 'Elettrica', 'Foto depilazione'],
  },
  { id: 'tempoUltima', testo: 'Quanto tempo è passato dall\'ultima depilazione?', tipo: 'testo' as const },
  { id: 'herpes', testo: 'Ha avuto herpes semplice o genitale?', tipo: 'sino' as const },
  { id: 'ultimoSole', testo: 'Ultima esposizione ai raggi solari', tipo: 'testo' as const },
  { id: 'gravidanza', testo: 'Dichiara di NON essere in stato di gravidanza accertata o presunta', tipo: 'conferma' as const },
];
