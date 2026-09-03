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

import Anthropic from '@anthropic-ai/sdk';
import { modelloDiTesta } from '@/lib/orchestrazione';

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

Se la foto è buona ma un singolo campo non si legge, lascialo vuoto e tieni "leggibile": true: meglio tre dati giusti che quattro di cui uno inventato. Non inventare MAI un numero: se non lo vedi, campo vuoto e sicurezza bassa.`;

/** Il tipo MIME e i byte, da una data URL. */
function pezziDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || '').trim());
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function leggiDocumento(dataUrl: string): Promise<LetturaDocumento> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Senza chiave non si finge di aver letto: si dice che va scritto a mano.
    return { leggibile: true, problema: undefined, sicurezza: 0 };
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

  try {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: modelloDiTesta(),
      max_tokens: 400,
      temperature: 0,
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
    });

    const testo = r.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim();
    const json = testo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
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
      sicurezza: typeof d.sicurezza === 'number' ? Math.max(0, Math.min(1, d.sicurezza)) : undefined,
    };
  } catch {
    /*
      Se la lettura non riesce non si blocca la firma: il documento resta
      allegato e i campi si scrivono a mano. Il consenso vale lo stesso, ed e'
      quello che deve arrivare in fondo.
    */
    return { leggibile: true, sicurezza: 0 };
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
