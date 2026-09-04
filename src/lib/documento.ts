/**
 * Leggere un documento da una foto.
 *
 * Sul consenso serve il numero del documento, e finora lo si copiava a mano
 * dal tesserino mentre la cliente aspettava: numeri sbagliati, cognomi
 * storpiati, e a volte niente perche' non c'era tempo.
 *
 * Qui la foto la fa la cliente e i dati li legge il modello. Due cose sono
 * importanti quanto la lettura:
 *
 *  - PRIMA di tutto si guarda se la foto e' leggibile, e se non lo e' si dice
 *    PERCHE' in modo che si possa rifare subito ("e' mossa", "c'e' un riflesso
 *    sul numero"). Una foto storta scoperta tre giorni dopo non si rifa' piu':
 *    la cliente non e' piu' li'.
 *  - Quello che viene letto si mostra sempre alla persona, in campi
 *    modificabili. Il modello sbaglia una cifra ogni tanto, e un numero di
 *    documento sbagliato su un consenso firmato e' peggio di nessun numero.
 *
 * La foto viene mandata al modello per essere letta e non viene tenuta da
 * nessuna parte se non nel database del centro.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { modelloPer } from '@/lib/orchestrazione';
import { chiaveMancante, chiedi, type Fornitore } from '@/lib/fornitori';

export type TipoDocumento = 'carta_identita' | 'patente' | 'passaporto' | 'altro';

export interface LetturaDocumento {
  /** Falso quando la foto non basta: allora `problema` dice cosa rifare. */
  leggibile: boolean;
  /** Cosa non va, scritto per la cliente e non per il tecnico. */
  problema?: string;
  tipo?: TipoDocumento;
  numero?: string;
  nome?: string;
  cognome?: string;
  /** YYYY-MM-DD. */
  dataNascita?: string;
  scadenza?: string;
  /**
   * M o F, quando il documento lo dice.
   *
   * Sulla carta d'identita' c'e' scritto sotto «SESSO». Serve a non chiedere
   * a un uomo se e' in stato di gravidanza — capita, ed e' il genere di
   * domanda che fa capire alla persona che nessuno sta leggendo davvero
   * quello che ha appena scritto.
   */
  sesso?: 'M' | 'F';
  /*
    La residenza, quando il documento ce l'ha davanti.

    Serve al check-in, che senza indirizzo e citta' si ferma: se e' stampata
    sul documento non ha senso richiederla a voce con la cliente davanti.
    Sulla carta d'identita' elettronica sta sul retro, quindi spesso non c'e'
    — e allora restano due caselle da riempire sul telefono, che e' comunque
    meglio che dettarle al banco.
  */
  indirizzo?: string;
  comune?: string;
  /** Quanto il modello si fida di quello che ha letto, da 0 a 1. */
  sicurezza?: number;
}

const ISTRUZIONI = `Sei l'occhio di un gestionale di un centro estetico italiano. Ti arriva la foto di un documento d'identità che una cliente ha appena scattato col telefono, e devi dire due cose: se la foto è buona, e cosa c'è scritto.

Rispondi SOLO con un oggetto JSON, senza testo attorno e senza blocchi di codice:
{
  "leggibile": true|false,
  "problema": "solo se leggibile è false: cosa deve rifare, in italiano, dando del tu, massimo 15 parole",
  "tipo": "carta_identita"|"patente"|"passaporto"|"altro",
  "numero": "il numero del documento, esattamente com'è scritto",
  "nome": "solo il nome di battesimo",
  "cognome": "solo il cognome",
  "dataNascita": "AAAA-MM-GG",
  "scadenza": "AAAA-MM-GG oppure vuoto",
  "sesso": "M"|"F"|"" (sulla carta d'identità è scritto sotto SESSO; sulla patente non c'è, allora lascia vuoto),
  "indirizzo": "via e numero civico della RESIDENZA, se è scritta nella foto; altrimenti vuoto",
  "comune": "il comune di residenza, se è scritto nella foto; altrimenti vuoto",
  "sicurezza": 0.0-1.0
}

Metti "leggibile": false quando:
- la foto è mossa, sfocata o troppo scura per leggere il numero;
- un riflesso o un'ombra coprono i dati;
- il documento è tagliato e manca una parte con i dati;
- non è un documento d'identità (è un'altra cosa, o è illeggibile del tutto).

Il "problema" lo legge la cliente sul telefono, quindi deve dirle cosa fare:
"La foto è mossa: appoggia il documento e tieni fermo il telefono."
"C'è un riflesso sul numero: spostati dalla luce e riprova."
"Manca un pezzo del documento: inquadralo tutto."

Dove sta il numero, per i tre documenti che girano davvero:
- CARTA D'IDENTITÀ elettronica: il numero è in alto a destra, due lettere e cinque cifre e due lettere (CA00000AA). Su quella vecchia di carta è un numero lungo preceduto da "AS" o simili.
- PATENTE di guida: il numero è al campo 5, sotto la data di nascita — una lettera, otto cifre e una lettera (U1B234567X). NON confonderlo col codice fiscale, che è più lungo e sta altrove.
- PASSAPORTO: due lettere e sette cifre (YA1234567), in alto a destra.

Sulla patente il campo 3 è la data di nascita e il campo 4b la scadenza. Sulla carta d'identità la scadenza coincide spesso col compleanno.

La RESIDENZA: sulla carta d'identità cartacea sta davanti, sotto "RESIDENZA"; su quella elettronica sta sul retro, quindi nella foto del fronte non c'è. Sulla patente c'è sotto il campo 8. Se non la vedi, lascia i due campi vuoti: NON dedurla dal comune di nascita, che è un'altra cosa e mandarci la posta sbagliata è peggio che non averla.

Se la foto è buona ma un singolo campo non si legge, lascialo vuoto e tieni "leggibile": true: meglio tre dati giusti che quattro di cui uno inventato. Non inventare MAI un numero: se non lo vedi, campo vuoto e sicurezza bassa.`;

/** Il tipo MIME e i byte, da una data URL. */
function pezziDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || '').trim());
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Chi guarda la foto, in ordine, finche' uno risponde.
 *
 * Prima si chiamava un fornitore solo — Anthropic, diretto — e il giorno in
 * cui il credito di quel conto e' finito la lettura ha smesso di funzionare
 * IN SILENZIO: la cliente si e' trovata i campi vuoti da riempire a mano e
 * nessuno sapeva perche'. E' esattamente lo stesso incidente che aveva gia'
 * fatto tacere la segretaria mesi fa, e la lezione era gia' scritta nel
 * codice: non dipendere da un fornitore solo.
 *
 * Quindi qui si prova la lista, uno dopo l'altro. Basta che uno funzioni.
 */
const OCCHI: { fornitore: Fornitore; modello: () => string; extra: Record<string, unknown> }[] = [
  {
    // Google legge bene i documenti e ha un tetto gratuito generoso: e' il
    // primo perche' e' quello che non finisce a meta' mese.
    fornitore: 'gemini',
    modello: () => process.env.GEMINI_MODELLO_OCCHIO || 'gemini-3.6-flash',
    /*
      Solo temperatura zero.

      Si era provato a spegnergli il ragionamento (`reasoning_effort`) perche'
      qui non c'e' niente su cui ragionare — si guarda un tesserino e si
      trascrive: Google rifiuta il parametro con un 400 secco. Resta il tetto
      largo sui token, che e' la difesa vera contro il JSON tagliato a meta'.
    */
    extra: { temperature: 0 },
  },
  { fornitore: 'anthropic', modello: () => modelloPer('testa', 'anthropic'), extra: { temperature: 0 } },
  {
    // Il centralino per ultimo: sulle immagini ripiega su fornitori che a
    // volte non hanno un backend pronto, e risponde 502 dove gli altri leggono.
    fornitore: 'omniroute',
    modello: () => process.env.OMNIROUTE_MODELLO_OCCHIO || 'auto/best-vision',
    extra: { temperature: 0 },
  },
];

export async function leggiDocumento(dataUrl: string): Promise<LetturaDocumento> {
  const disponibili = OCCHI.filter(o => !chiaveMancante(o.fornitore));
  if (disponibili.length === 0) {
    return {
      leggibile: true,
      problema: 'La lettura automatica non è configurata: scrivi i dati a mano.',
      sicurezza: 0,
    };
  }

  const pezzi = pezziDataUrl(dataUrl);
  if (!pezzi || !MIME_OK.has(pezzi.mime)) {
    return { leggibile: false, problema: 'Questa immagine non si riesce ad aprire: riprova a scattarla.' };
  }
  // ~4 MB di base64 sono circa 3 MB di foto: oltre, il telefono ha mandato
  // l'originale senza comprimerlo e la chiamata diventa lenta e cara.
  if (pezzi.base64.length > 6_000_000) {
    return { leggibile: false, problema: 'La foto è troppo pesante: riprova, la rimpiccioliamo noi.' };
  }

  const guai: string[] = [];
  for (const occhio of disponibili) {
    try {
      /*
        Mezzo minuto e non di piu'.

        Dall'altra parte c'e' una persona che ha appena scattato la foto e
        guarda lo schermo: se un fornitore si impianta, e' molto meglio
        passare al prossimo che tenerla ferma tre minuti su una rotellina.
      */
      return await Promise.race([
        unaLettura(occhio, pezzi),
        new Promise<never>((_, no) => setTimeout(() => no(new Error('non ha risposto in tempo')), 45_000)),
      ]);
    } catch (e) {
      const motivo = String((e as { message?: string })?.message || e);
      guai.push(`${occhio.fornitore}: ${motivo.slice(0, 120)}`);
      console.warn(`[documento] ${occhio.fornitore} non ce l'ha fatta: ${motivo.slice(0, 200)}`);
    }
  }

  /*
    Nessuno ha letto. Non si blocca la firma: il documento resta allegato e i
    campi si scrivono a mano, il consenso vale lo stesso ed e' quello che deve
    arrivare in fondo.

    Ma lo si DICE — a chi sta firmando e al centro. Prima si tornava indietro
    muti, coi campi vuoti: chi firmava pensava che il gestionale funzionasse
    cosi', e il centro non sapeva che la lettura era rotta. E' rimasta rotta
    per giorni.
  */
  console.error('[documento] nessun fornitore ha letto:', guai.join(' | '));
  avvisaChePerdeUnPezzo(guai.join(' | ')).catch(() => {});
  return {
    leggibile: true,
    problema: 'Non sono riuscito a leggere il documento da solo: controlla i dati qui sotto e scrivili a mano.',
    sicurezza: 0,
  };
}

/** Una lettura sola, con un fornitore solo. Se non ce la fa, lancia. */
async function unaLettura(
  occhio: { fornitore: Fornitore; modello: () => string; extra: Record<string, unknown> },
  pezzi: { mime: string; base64: string },
): Promise<LetturaDocumento> {
  {
    const r = await chiedi(occhio.fornitore, {
      model: occhio.modello(),
      /*
        Largo, molto piu' del necessario.

        La risposta utile sono venti parole, ma i modelli nuovi ragionano prima
        di rispondere e quel ragionamento consuma il tetto: con 900 il JSON
        arrivava tagliato a meta' ("numero": "NA5) e si leggeva come un errore
        di lettura, mentre la patente era stata letta benissimo. Costa qualche
        centesimo di millesimo in piu' e toglie di mezzo un intero tipo di
        guasto.
      */
      maxTokens: 3000,
      system: 'Leggi documenti d\'identità e rispondi solo con JSON.',
      // Nessuno strumento: qui si guarda una foto e si risponde, punto.
      tools: [],
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: pezzi.mime as Anthropic.Base64ImageSource['media_type'],
              data: pezzi.base64,
            },
          },
          { type: 'text', text: ISTRUZIONI },
        ],
      }],
      extra: occhio.extra,
    });

    /*
      Il JSON si ritaglia, non si sbuccia.

      Un modello lo incornicia coi backtick, un altro ci mette davanti "json",
      un terzo scrive una riga di commento prima. Togliere i backtick non
      bastava: si prende quello che sta fra la prima graffa e l'ultima, che e'
      l'unica cosa vera di tutte le risposte.
    */
    const grezzo = r.testo.trim();
    const apre = grezzo.indexOf('{');
    const chiude = grezzo.lastIndexOf('}');
    if (apre < 0 || chiude <= apre) {
      throw new Error(`risposta senza JSON: ${grezzo.slice(0, 120)}`);
    }
    const json = grezzo.slice(apre, chiude + 1);
    const d = JSON.parse(json) as Record<string, unknown>;

    const stringa = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const data = (v: unknown) => {
      const s = stringa(v);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
    };

    if (d.leggibile === false) {
      return {
        leggibile: false,
        problema: stringa(d.problema) || 'La foto non si legge bene: riprova.',
      };
    }

    const tipi: TipoDocumento[] = ['carta_identita', 'patente', 'passaporto', 'altro'];
    const tipo = tipi.includes(stringa(d.tipo) as TipoDocumento) ? (stringa(d.tipo) as TipoDocumento) : 'altro';

    return {
      leggibile: true,
      tipo,
      numero: stringa(d.numero),
      nome: stringa(d.nome),
      cognome: stringa(d.cognome),
      dataNascita: data(d.dataNascita),
      scadenza: data(d.scadenza),
      sesso: stringa(d.sesso).toUpperCase() === 'M' ? 'M'
        : stringa(d.sesso).toUpperCase() === 'F' ? 'F' : undefined,
      indirizzo: stringa(d.indirizzo),
      comune: stringa(d.comune),
      sicurezza: typeof d.sicurezza === 'number' ? Math.max(0, Math.min(1, d.sicurezza)) : undefined,
    };
  }
}

/** Come si chiama un documento, quando lo si scrive in chiaro. */
export function nomeTipo(tipo?: string): string {
  switch (tipo) {
    case 'carta_identita': return "Carta d'identità";
    case 'patente': return 'Patente';
    case 'passaporto': return 'Passaporto';
    default: return 'Documento';
  }
}

/**
 * Avvisa il centro che la lettura automatica non funziona.
 *
 * Una volta ogni sei ore e non a ogni foto: se la chiave e' scaduta le foto
 * sono dieci al giorno, e dieci messaggi uguali si smette di leggerli.
 */
let ultimoAvviso = 0;
async function avvisaChePerdeUnPezzo(motivo: string): Promise<void> {
  const adesso = Date.now();
  if (adesso - ultimoAvviso < 6 * 3600_000) return;
  ultimoAvviso = adesso;
  const { sendTelegram } = await import('@/lib/telegram');
  const spiegazione = /credit balance|quota|billing/i.test(motivo)
    ? 'Il credito del fornitore è finito: le clienti stanno riscrivendo i dati a mano.'
    : /api key|authentication|401|403/i.test(motivo)
      ? 'La chiave del fornitore non è più valida.'
      : motivo.slice(0, 160);
  await sendTelegram(
    `\u26A0\uFE0F <b>Il documento non si legge da solo</b>\n${spiegazione}\n`
    + 'I consensi si firmano lo stesso, ma i dati del documento vanno scritti a mano.',
  );
}
