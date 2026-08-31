import { corri, tabella, CONCORRENTI } from '@/lib/bancoProva';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/*
  Sette casi per tre modelli, con più turni ciascuno: sono minuti, non secondi.
  Il tetto di Vercel/Next di default taglierebbe a metà.
*/
export const maxDuration = 3000;

/**
 * Fa correre i modelli sullo stesso lavoro e stampa i numeri.
 *
 * Non è protetta da un segreto, e non serve: non accetta domande da fuori. I
 * casi sono scritti nel codice, gli strumenti che scrivono sono finti, e c'è
 * un quarto d'ora di attesa fra una corsa e l'altra. Chi la trovasse non
 * potrebbe né farsi rispondere quello che vuole né spendere in modo serio —
 * al massimo rifà la stessa fotografia.
 *
 * Il referto esce due volte: in JSON a chi ha aperto l'indirizzo, e nei log
 * come tabella, perché è lì che si va a rileggere il confronto dopo.
 */
let ultimaCorsa = 0;
const ATTESA_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const adesso = Date.now();
  const manca = ATTESA_MS - (adesso - ultimaCorsa);
  if (manca > 0) {
    return Response.json(
      { errore: `Già corso da poco. Riprova fra ${Math.ceil(manca / 60000)} minuti.` },
      { status: 429 }
    );
  }
  ultimaCorsa = adesso;

  /*
    `?solo=gemini,zai` serve finché il credito Anthropic è a zero: senza, il
    metro di paragone fallisce e porta con sé sette errori che non dicono
    niente su nessuno.
  */
  const cerca = new URL(request.url).searchParams;
  const solo = cerca.get('solo');
  let scelti = solo
    ? CONCORRENTI.filter(c => solo.split(',').map(s => s.trim()).includes(c.fornitore))
    : CONCORRENTI;

  /*
    `?modello=` cambia il modello del concorrente scelto senza passare da una
    variabile d'ambiente. Non è pigrizia: ogni variabile fa ripartire il
    servizio, e per trovare quale Flash gratuito regge davvero bisogna provarne
    tre o quattro. Rimettere in piedi la produzione quattro volte per cambiare
    una stringa è un prezzo che non ha senso pagare.
  */
  const modello = cerca.get('modello');
  if (modello && scelti.length === 1) {
    scelti = [{ ...scelti[0], model: modello }];
  }

  /*
    `?pausa=` in secondi fra un caso e l'altro. Il tetto e' basso perche' la
    richiesta deve comunque tornare: sette casi con due minuti di pausa sono
    gia' un quarto d'ora di attesa.
  */
  const pausa = Math.min(Number(cerca.get('pausa') || 0) || 0, 90);

  try {
    const referti = await corri(scelti, pausa);
    console.log(tabella(referti));

    /*
      Una corsa in cui NESSUNO ha risposto non è una misura: è il fornitore
      che era chiuso. Non deve consumare il quarto d'ora, altrimenti per
      riprovare un nome di modello si aspetta un quarto d'ora per niente.
    */
    const misurato = referti.some(r => r.casi.some(c => !c.errore));
    if (!misurato) ultimaCorsa = 0;

    return Response.json({ referti });
  } catch (e) {
    ultimaCorsa = 0; // Un guasto non deve bloccare il prossimo tentativo.
    const messaggio = e instanceof Error ? e.message : String(e);
    console.error(`banco di prova, guasto: ${messaggio}`);
    return Response.json({ errore: messaggio }, { status: 500 });
  }
}
