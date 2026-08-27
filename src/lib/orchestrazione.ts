/**
 * Chi risponde: il modello grosso o quello piccolo.
 *
 * La segretaria chiamava Opus per tutto. Ma "tutto" è quasi sempre «a che ora
 * aprite», «quanto costa la ceretta», «dove siete»: domande a cui si risponde
 * leggendo un dato dal gestionale e scrivendo una riga. Pagare l'intelligenza
 * più cara che c'è per leggere un orario è come mandare il direttore a
 * rispondere al citofono.
 *
 * Quindi due modelli, e una regola sola per decidere:
 *
 *   il modello piccolo LEGGE, il modello grosso SCRIVE.
 *
 * Finché la conversazione è fatta di domande — listino, orari, indirizzo,
 * quando c'è posto — risponde il piccolo. Nel momento in cui tocca qualcosa
 * che resta (un appuntamento preso, spostato, disdetto) o qualcosa che va
 * capito (una foto, un vocale, una cliente da passare a una persona), il turno
 * riparte da zero sul grosso.
 *
 * ── Perché ripartire da zero e non continuare ───────────────────────────
 * Se il piccolo ha già deciso *quale* trattamento, *quale* giorno e *quale*
 * ora, farlo confermare dal grosso non serve a niente: la decisione era già
 * presa. Il turno si butta e si rifà, con la stessa conversazione davanti ma
 * con la testa buona dall'inizio. Costa un turno piccolo sprecato — un quinto
 * di quello grosso — e compra che nessun appuntamento venga deciso dal modello
 * economico.
 *
 * ── Perché non un classificatore ────────────────────────────────────────
 * La strada ovvia sarebbe un modello che legge il messaggio e decide chi deve
 * rispondere. Ma un classificatore è una chiamata in più su OGNI messaggio, e
 * soprattutto può sbagliare in silenzio: manda al piccolo la cliente che
 * voleva disdire, e non lo sa nessuno. Qui invece non c'è niente da
 * indovinare: l'escalation la fa scattare il piccolo stesso, nel momento in
 * cui allunga la mano su uno strumento che scrive.
 */

/** Gli strumenti che nessun modello economico deve poter usare. */
export const STRUMENTI_DELICATI = new Set([
  // Scrivono in agenda, o preparano la scrittura.
  'verifica_prenotazione',
  'prenota',
  'sposta_appuntamento',
  'disdici_appuntamento',
  // Non scrive niente, ma è la resa: prima di arrendersi ci prova la testa buona.
  'passa_a_persona',
]);

export type Livello = 'lavoro' | 'testa';

/**
 * Il modello che regge la conversazione normale.
 *
 * Haiku di partenza: sa leggere un listino, chiamare uno strumento e scrivere
 * due righe in italiano, che è il 90% del lavoro. Se dovesse risultare troppo
 * letterale — risposte che sembrano un modulo — il gradino sopra è
 * `claude-sonnet-5`, e si cambia da una variabile senza rilasciare.
 */
export function modelloDiLavoro(): string {
  return process.env.WA_MODELLO_LAVORO || 'claude-haiku-4-5';
}

/** Il modello che decide quando si tocca l'agenda. */
export function modelloDiTesta(): string {
  return process.env.WA_MODELLO_TESTA || process.env.WA_SEGRETARIA_MODEL || 'claude-opus-5';
}

export function modelloPer(livello: Livello): string {
  return livello === 'testa' ? modelloDiTesta() : modelloDiLavoro();
}

/**
 * Quanto a fondo ragionare, sul modello di testa.
 *
 * `medium` e non `high` (che è il valore di partenza dell'API): qui si risponde
 * a «giovedì avete posto», non si progetta niente. E quello che deve andare per
 * forza bene — quello che finisce scritto in agenda — non lo protegge lo sforzo
 * del modello: lo protegge il gettone di conferma, che è una porta e non un
 * consiglio.
 */
function sforzo(): 'low' | 'medium' | 'high' | 'xhigh' | 'max' {
  const scelto = process.env.WA_SEGRETARIA_EFFORT;
  return scelto === 'low' || scelto === 'high' || scelto === 'xhigh' || scelto === 'max' ? scelto : 'medium';
}

/**
 * I parametri di ragionamento giusti PER QUEL modello.
 *
 * Non sono uguali per tutti, e sbagliarli non degrada: rifiuta la richiesta.
 * Haiku 4.5 non conosce `effort` e risponde 400 se glielo mandi; la famiglia
 * Opus/Sonnet 5 non conosce più `budget_tokens` e risponde 400 se glielo
 * mandi. Quindi la scelta del modello e la scelta dei parametri sono la stessa
 * decisione, e stanno qui insieme invece che in due punti che prima o poi
 * divergono.
 */
export function parametriRagionamento(model: string): {
  thinking?: { type: 'adaptive' };
  output_config?: { effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' };
} {
  const pensa = /^claude-(opus-5|opus-4-[678]|sonnet-5|fable-5|mythos-5)/.test(model);
  return pensa ? { thinking: { type: 'adaptive' }, output_config: { effort: sforzo() } } : {};
}

/**
 * Su quale livello parte questo turno.
 *
 * Foto e vocali vanno sul grosso senza discutere. La foto perché va guardata,
 * e perché il confine su cosa NON dire guardandola è la regola più delicata
 * che abbiamo. Il vocale perché la trascrizione è approssimativa proprio dove
 * conta — nomi, giorni, orari — e capire cosa intendeva davvero è esattamente
 * il lavoro per cui si paga il modello buono.
 *
 * E una conversazione che è già salita non riscende: se dieci minuti fa stava
 * prendendo un appuntamento, la battuta dopo fa parte di quella cosa lì.
 */
export function livelloDiPartenza(segnali: {
  conFoto: boolean;
  daVocale: boolean;
  giaSalita: boolean;
}): { livello: Livello; perche: string } {
  if (segnali.giaSalita) return { livello: 'testa', perche: 'conversazione già salita' };
  if (segnali.conFoto) return { livello: 'testa', perche: 'c\'è una foto da guardare' };
  if (segnali.daVocale) return { livello: 'testa', perche: 'arriva da un vocale' };
  return { livello: 'lavoro', perche: 'domanda normale' };
}
