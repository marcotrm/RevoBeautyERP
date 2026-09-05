/**
 * I testi dei consensi, prima versione.
 *
 * ATTENZIONE — questi testi sono una BOZZA DI PARTENZA scritta per far
 * funzionare il meccanismo, non un parere legale. Vanno letti e corretti dal
 * consulente privacy del centro prima di farli firmare a qualcuno: il
 * gestionale garantisce che quello che la cliente ha letto resti scritto e
 * immutabile, non che quel testo sia giuridicamente completo.
 *
 * Come si cambiano: NON si riscrivono qui e basta. Si pubblica una versione
 * nuova (Impostazioni → Consensi), cosi' chi ha firmato la vecchia continua a
 * risultare legato a quella, che e' l'unica cosa che conta quando qualcuno
 * chiede a cosa avesse acconsentito.
 */

export interface TestoConsenso {
  tipo: string;
  titolo: string;
  sommario: string;
  testo: string;
  firmaRichiesta: boolean;
  /** Senza, il servizio non si puo' erogare. Il marketing non lo e' mai. */
  necessario: boolean;
}

export const VERSIONE_INIZIALE = '2026-09-05';

export const TESTI_INIZIALI: TestoConsenso[] = [
  {
    tipo: 'privacy',
    titolo: 'Informativa privacy',
    sommario: 'Chi tratta i tuoi dati, perché e per quanto tempo.',
    firmaRichiesta: false,
    necessario: true,
    testo: `Il centro estetico raccoglie e conserva i tuoi dati per gestire gli appuntamenti, i trattamenti e gli obblighi fiscali.

QUALI DATI: nome, cognome, contatti, data di nascita, indirizzo, e le informazioni che ci dai sui trattamenti (preferenze, sensibilità dichiarate, note delle sedute).

PERCHÉ: per prenotare e svolgere i trattamenti, per contattarti su appuntamenti e comunicazioni di servizio, e per gli obblighi di legge.

PER QUANTO: finché sei cliente del centro e, per i documenti fiscali, per il tempo previsto dalla legge.

CHI LI VEDE: le persone che lavorano nel centro, ognuna limitatamente a quello che le serve. Non vendiamo i tuoi dati e non li cediamo a terzi per finalità commerciali.

I TUOI DIRITTI: puoi chiedere di vedere i tuoi dati, correggerli, farli cancellare o revocare i consensi facoltativi in qualsiasi momento, chiedendolo in centro.`,
  },
  {
    tipo: 'dati',
    titolo: 'Trattamento dei dati per il servizio',
    sommario: 'Il minimo per prenotare e svolgere i trattamenti.',
    firmaRichiesta: false,
    necessario: true,
    testo: `Acconsenti al trattamento dei tuoi dati personali per la gestione degli appuntamenti, della tua scheda e dei trattamenti che ricevi.

Comprende le informazioni che ci dai durante la consulenza e le sedute: preferenze, sensibilità dichiarate, osservazioni delle operatrici.

Senza questo consenso non è possibile prenotare né svolgere i trattamenti, perché sono le informazioni con cui il servizio viene erogato.`,
  },
  {
    tipo: 'trattamento',
    titolo: 'Consenso informato al trattamento estetico',
    sommario: 'Cosa comporta il trattamento e cosa devi dirci prima.',
    firmaRichiesta: true,
    necessario: true,
    testo: `Dichiari di essere stata informata sul trattamento estetico che riceverai, sul suo svolgimento e sulle indicazioni da seguire prima e dopo.

Dichiari di aver comunicato al centro, per quanto a tua conoscenza: patologie in corso, terapie e farmaci assunti, allergie, sensibilità note, gravidanza in corso o presunta, e ogni altra condizione che possa sconsigliare il trattamento.

Ti impegni a comunicare tempestivamente eventuali cambiamenti e a seguire le indicazioni post-trattamento che ti vengono date.

Il trattamento estetico non ha finalità mediche e non sostituisce una valutazione medica. In caso di dubbio, il centro può rimandare la seduta e invitarti a sentire il tuo medico.`,
  },
  {
    tipo: 'foto',
    titolo: 'Fotografie del percorso',
    sommario: 'Foto prima/dopo, conservate nella tua scheda. Facoltativo.',
    firmaRichiesta: false,
    necessario: false,
    testo: `Acconsenti a farti fotografare le zone trattate, prima, durante e al termine del percorso, per documentare l'andamento.

Le fotografie restano nella tua scheda, in archivio privato, e sono visibili solo alle persone del centro che seguono il tuo percorso.

Non vengono pubblicate, non vengono usate per pubblicità e non vengono mostrate ad altre clienti: per quello servirebbe un consenso separato, che oggi non ti stiamo chiedendo.

Puoi revocare questo consenso quando vuoi: da quel momento non ne verranno scattate altre e potrai chiedere la cancellazione di quelle esistenti.`,
  },
  {
    tipo: 'foto-condivisione',
    titolo: 'Ricevere le tue fotografie',
    sommario: 'Ricevere sul telefono le foto del tuo percorso. Facoltativo.',
    firmaRichiesta: false,
    necessario: false,
    testo: `Acconsenti a ricevere le fotografie del tuo percorso sul tuo telefono, tramite l'app o i canali che hai indicato.

Vale solo per le tue fotografie e solo verso di te. Una volta ricevute sul tuo dispositivo, la loro conservazione dipende da te.

Puoi revocare questo consenso quando vuoi.`,
  },
  {
    tipo: 'marketing',
    titolo: 'Comunicazioni promozionali',
    sommario: 'Offerte e novità. Facoltativo, e non serve per essere servita.',
    firmaRichiesta: false,
    necessario: false,
    testo: `Acconsenti a ricevere comunicazioni promozionali del centro — offerte, novità, iniziative — sui contatti che ci hai lasciato.

Questo consenso è del tutto facoltativo: non riceverlo non cambia nulla su appuntamenti, trattamenti e prezzi.

Puoi revocarlo quando vuoi, chiedendolo in centro o rispondendo a una qualsiasi comunicazione.`,
  },
];
