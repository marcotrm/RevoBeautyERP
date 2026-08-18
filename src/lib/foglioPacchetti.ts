/**
 * Il foglio A4 dei pacchetti, quello che si stampa e si dà in mano alla cliente.
 *
 * Non è una schermata: è carta. Quindi niente colori dell'interfaccia (il viola
 * acceso sullo schermo, stampato, diventa fango), niente sfondi pieni che si
 * mangiano il toner, e testi che si leggono anche dalla stampante dell'ufficio.
 *
 * L'unico elemento decorativo è preso dalla cosa vera: le sedute disegnate come
 * una fila di pallini, gli stessi che nel gestionale si riempiono quando la
 * cliente viene. È la tessera che ha in mano, non un ornamento inventato.
 *
 * Torna una pagina HTML completa e autonoma (nessun CSS del gestionale, nessun
 * font da scaricare): si apre in una finestra nuova e si stampa.
 */

export interface PacchettoDaStampare {
  nome: string;
  prezzo: number;
  sedute: number;
  descrizione?: string;
  /** Prezzo della singola seduta a listino, quando lo sappiamo: serve il risparmio. */
  prezzoSingolo?: number;
}

export interface DatiCentro {
  nome: string;
  indirizzo?: string;
  telefono?: string;
  sito?: string;
}

interface Opzioni {
  pacchetti: PacchettoDaStampare[];
  centro: DatiCentro;
  /** Il nome della cliente, se il foglio è per una persona precisa. */
  cliente?: string;
  /** Giorni di validità del preventivo. */
  validoGiorni?: number;
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function euro(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function dataLunga(d: Date): string {
  return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}

/** Niente HTML dentro il foglio: i nomi dei pacchetti li scrivono le persone. */
function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

/** I pallini delle sedute. Oltre le dodici diventerebbero una collana: si scrive il numero. */
function pallini(sedute: number): string {
  if (sedute > 12) return `<span class="tante">${sedute} sedute</span>`;
  return `<span class="pallini">${Array.from({ length: sedute }, () => '<i></i>').join('')}</span>`;
}

function scheda(p: PacchettoDaStampare, grande: boolean): string {
  const perSeduta = p.sedute > 0 ? p.prezzo / p.sedute : 0;
  const pieno = p.prezzoSingolo ? p.prezzoSingolo * p.sedute : 0;
  const risparmio = pieno > p.prezzo ? pieno - p.prezzo : 0;

  return `
    <article class="scheda ${grande ? 'grande' : ''}">
      <div class="testa">
        <h2>${esc(p.nome)}</h2>
        <p class="prezzo">${euro(p.prezzo)}</p>
      </div>
      <div class="filo-oro"></div>
      <div class="corpo">
        <div class="sedute">
          ${pallini(p.sedute)}
          <p class="quante">${p.sedute} ${p.sedute === 1 ? 'seduta' : 'sedute'} · ${euro(perSeduta)} a seduta</p>
        </div>
        ${p.descrizione ? `<p class="descrizione">${esc(p.descrizione)}</p>` : ''}
      </div>
      ${risparmio > 0 ? `
        <p class="risparmio">
          <span>Singole ${euro(pieno)}</span>
          <strong>Risparmi ${euro(risparmio)}</strong>
        </p>` : ''}
    </article>`;
}

export function foglioPacchetti({ pacchetti, centro, cliente, validoGiorni = 30 }: Opzioni): string {
  const oggi = new Date();
  const scadenza = new Date(oggi);
  scadenza.setDate(scadenza.getDate() + validoGiorni);

  const quanti = pacchetti.length;
  // Uno solo si prende tutta la larghezza e respira; da due in poi due colonne.
  const griglia = quanti === 1 ? 'uno' : quanti === 2 ? 'due' : 'tanti';
  const schede = pacchetti.map(p => scheda(p, quanti === 1)).join('');

  const contatti = [centro.indirizzo, centro.telefono, centro.sito]
    .filter((c): c is string => Boolean(c && c.trim()))
    .map(esc);

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Pacchetti — ${esc(centro.nome)}</title>
<style>
  /*
    Colori da inchiostro: prugna scura al posto del viola dello schermo, oro
    spento per i fili, carta appena calda. Sulla stampante di casa restano
    leggibili anche in bianco e nero.
  */
  :root {
    --carta: #FCFAF7;
    --inchiostro: #221A2B;
    --prugna: #5B2A67;
    --oro: #A8823C;
    --nebbia: #6E6577;
    --filo: #E3DCE6;
  }

  @page { size: A4 portrait; margin: 14mm 13mm; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #EFEBE6;
    color: var(--inchiostro);
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* La barra sopra è solo per lo schermo: sulla carta non esiste. */
  .barra {
    position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px;
    background: #FFFFFF; border-bottom: 1px solid #DDD6D0;
    font-size: 13px;
  }
  .barra span { color: #6E6577; margin-right: auto; }
  .barra button {
    font: inherit; font-weight: 600; cursor: pointer;
    padding: 8px 16px; border-radius: 10px; border: 1px solid transparent;
  }
  .stampa { background: var(--prugna); color: #fff; }
  .chiudi { background: #fff; color: #6E6577; border-color: #DDD6D0; }

  .foglio {
    width: 210mm; min-height: 297mm;
    margin: 18px auto; padding: 14mm 13mm;
    background: var(--carta);
    box-shadow: 0 8px 30px rgba(34, 26, 43, .18);
    display: flex; flex-direction: column;
  }

  /* Intestazione: nome del centro in maiuscoletto spaziato, contatti a destra. */
  .intestazione {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 7mm; border-bottom: 1.2pt solid var(--prugna);
  }
  .centro {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 19pt; letter-spacing: .12em; text-transform: uppercase;
    color: var(--prugna); margin: 0;
  }
  .contatti { text-align: right; font-size: 8.5pt; color: var(--nebbia); }
  .contatti p { margin: 0; }

  .titolo { margin: 9mm 0 7mm; }
  .titolo h1 {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 26pt; font-weight: 400; margin: 0; line-height: 1.15;
    text-wrap: balance;
  }
  .titolo .per { color: var(--prugna); font-style: italic; }
  .titolo p { margin: 3mm 0 0; color: var(--nebbia); font-size: 9.5pt; max-width: 120mm; }

  /*
    Le schede si allargano fino a riempire il foglio: quattro riquadri
    schiacciati in alto con mezza pagina bianca sotto sembrano un lavoro
    lasciato a metà, e questo foglio la cliente se lo porta a casa.
  */
  .schede { display: grid; gap: 6mm; flex: 1; }
  .schede.uno { grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
  .schede.due { grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
  .schede.tanti { grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); }

  .scheda {
    border: 0.8pt solid var(--filo); border-radius: 2mm;
    padding: 6mm 6mm 5mm; background: #fff;
    display: flex; flex-direction: column;
    break-inside: avoid;
  }
  .testa { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm; }
  .testa h2 {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 13pt; font-weight: 400; margin: 0; line-height: 1.25;
  }
  .scheda.grande .testa h2 { font-size: 17pt; }
  .prezzo {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 17pt; margin: 0; white-space: nowrap; color: var(--prugna);
    font-variant-numeric: tabular-nums;
  }
  .scheda.grande .prezzo { font-size: 24pt; }

  .filo-oro { height: 0.8pt; background: var(--oro); opacity: .55; margin: 3.5mm 0 4mm; }

  /* Il contenuto sta al centro della scheda: appoggiato in alto, dentro un
     riquadro che si allarga, sembrerebbe caduto lì. */
  .corpo { display: flex; flex-direction: column; justify-content: center; gap: 3mm; flex: 1; }

  /* Le sedute come la tessera che la cliente ha in mano. */
  .pallini { display: flex; flex-wrap: wrap; gap: 1.8mm; }
  .pallini i {
    width: 3.2mm; height: 3.2mm; border-radius: 50%;
    border: 0.7pt solid var(--prugna); display: block;
  }
  .tante { font-size: 9pt; color: var(--prugna); letter-spacing: .04em; }
  .quante { margin: 2mm 0 0; font-size: 9pt; color: var(--nebbia); }
  .descrizione { margin: 0; font-size: 9.5pt; color: var(--inchiostro); opacity: .85; }

  .risparmio {
    margin: 4mm 0 0; padding-top: 3mm; border-top: 0.5pt dotted var(--filo);
    display: flex; align-items: baseline; justify-content: space-between; gap: 4mm;
    font-size: 9pt;
  }
  .risparmio span { color: var(--nebbia); text-decoration: line-through; }
  .risparmio strong { color: var(--oro); font-size: 10.5pt; letter-spacing: .02em; }

  /* Tre righe che rispondono alle domande che fanno sempre al banco. */
  .nota {
    margin-top: 7mm; padding-top: 4mm; border-top: 0.8pt solid var(--oro);
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm;
    font-size: 8.5pt; color: var(--nebbia);
  }
  .nota h3 {
    font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
    font-size: 9.5pt; font-weight: 400; margin: 0 0 1mm; color: var(--inchiostro);
  }
  .nota p { margin: 0; }

  .piede {
    margin-top: 6mm; padding-top: 5mm;
    border-top: 0.5pt solid var(--filo);
    display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm;
    font-size: 8.5pt; color: var(--nebbia);
  }
  .piede p { margin: 0; }
  .piede .validita { color: var(--inchiostro); }

  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .foglio { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; background: #fff; }
  }
</style>
</head>
<body>
  <div class="barra">
    <span>Anteprima del foglio da dare alla cliente</span>
    <button class="chiudi" onclick="window.close()">Chiudi</button>
    <button class="stampa" onclick="window.print()">Stampa</button>
  </div>

  <div class="foglio">
    <header class="intestazione">
      <p class="centro">${esc(centro.nome)}</p>
      <div class="contatti">
        ${contatti.map(c => `<p>${c}</p>`).join('')}
      </div>
    </header>

    <div class="titolo">
      <h1>${cliente ? `Pensato per <span class="per">${esc(cliente)}</span>` : 'I nostri pacchetti'}</h1>
      <p>${quanti === 1
        ? 'Il percorso che abbiamo scelto insieme, con il prezzo bloccato e le sedute già contate.'
        : 'Le proposte di cui abbiamo parlato. Le sedute si prenotano quando vuoi: il prezzo è già quello del pacchetto.'}</p>
    </div>

    <section class="schede ${griglia}">${schede}</section>

    <section class="nota">
      <div>
        <h3>Il prezzo è bloccato</h3>
        <p>Quello che paghi oggi vale per tutte le sedute del pacchetto, anche se il listino cambia.</p>
      </div>
      <div>
        <h3>Le sedute quando vuoi</h3>
        <p>Si prenotano una alla volta, secondo i tuoi tempi: non c'è un calendario da rispettare.</p>
      </div>
      <div>
        <h3>Il conto lo teniamo noi</h3>
        <p>A ogni visita ti diciamo quante sedute restano: non devi ricordartelo tu.</p>
      </div>
    </section>

    <footer class="piede">
      <p class="validita">Proposta del ${dataLunga(oggi)}, valida fino al ${dataLunga(scadenza)}.</p>
      <p>${esc(centro.nome)}${centro.telefono ? ` · ${esc(centro.telefono)}` : ''}</p>
    </footer>
  </div>

  <script>
    // Si apre già sulla stampa: il tasto in alto serve per la seconda copia.
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 350); });
  </script>
</body>
</html>`;
}
