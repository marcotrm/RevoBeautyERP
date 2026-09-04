/**
 * Il permesso di fare rumore.
 *
 * I browser non lasciano suonare una pagina finche' qualcuno non l'ha toccata:
 * e' una regola giusta — nessuno vuole siti che partono a tutto volume — ma
 * qui fa un danno preciso. Il tablet in cabina sta acceso sul gestionale da
 * stamattina e nessuno lo tocca da ore: quando arriva un trillo, il browser
 * crea il generatore di suono in stato "sospeso" e non esce niente. Nessun
 * errore, nessun avviso: silenzio.
 *
 * Qui si tiene UN generatore solo, e lo si sveglia al primo tocco qualunque
 * sulla pagina — un click, una schermata cambiata, un tasto. Da quel momento
 * quello schermo puo' suonare quando serve, anche se sono passate ore.
 */

let ctx: AudioContext | null = null;
let sbloccato = false;

function creaContesto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctx = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Da chiamare una volta all'avvio di ogni schermo: si mette in ascolto del
 * primo tocco e ne approfitta per svegliare l'audio.
 */
export function preparaAudio(): () => void {
  if (typeof window === 'undefined' || sbloccato) return () => {};

  const sveglia = () => {
    const c = creaContesto();
    if (!c) return;
    c.resume().then(() => { sbloccato = true; }).catch(() => {});
    if (c.state === 'running') sbloccato = true;
  };

  const eventi: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
  eventi.forEach(e => window.addEventListener(e, sveglia, { passive: true }));
  return () => eventi.forEach(e => window.removeEventListener(e, sveglia));
}

/** Vero se questo schermo puo' davvero suonare: serve a dirlo, invece di fingere. */
export function audioPronto(): boolean {
  return sbloccato && ctx?.state === 'running';
}

export interface Nota {
  /** Da quanti secondi dall'inizio. */
  quando: number;
  /** Hertz: 988 e' un si, 784 un sol. */
  frequenza: number;
  durata?: number;
}

/**
 * Suona una sequenza di note. Ritorna false se il browser non ha lasciato
 * fare rumore, cosi' chi chiama puo' ripiegare su qualcos'altro (la vibrazione,
 * o solo la scritta a schermo).
 */
export function suona(note: Nota[], volume = 0.25): boolean {
  const c = creaContesto();
  if (!c) return false;

  // Se e' sospeso si prova a svegliarlo lo stesso: quando il suono nasce da un
  // click dell'utente questo basta, ed e' il caso della prova del trillo.
  if (c.state === 'suspended') c.resume().catch(() => {});

  try {
    const inizio = c.currentTime;
    for (const n of note) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.frequenza, inizio + n.quando);
      const durata = n.durata ?? 0.13;
      gain.gain.setValueAtTime(0.0001, inizio + n.quando);
      gain.gain.exponentialRampToValueAtTime(volume, inizio + n.quando + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, inizio + n.quando + durata);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(inizio + n.quando);
      osc.stop(inizio + n.quando + durata + 0.02);
    }
    return c.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Il trillo, come quello di MSN.
 *
 * Non e' il file di Microsoft — quello e' loro e non si copia. E' rifatto con
 * gli stessi ingredienti di cui e' fatto: non una nota, ma un COLPO. Chi se lo
 * ricorda non ricorda una melodia, ricorda qualcuno che bussa sul vetro.
 *
 * Il suono si costruisce campione per campione e diventa un file WAV vero,
 * suonato da un <audio> come una canzone qualunque. Prima lo generava il
 * sintetizzatore del browser al momento del click e non usciva niente: quella
 * strada ha troppi modi di fallire in silenzio — il contesto sospeso, la
 * scheda in secondo piano, il telefono in modalita' risparmio. Un file e un
 * tasto play li conoscono tutti i browser da vent'anni.
 */

/**
 * Il "boing" del trillo: una finestra scossa, non due colpi puliti.
 *
 * La prima versione erano due botte secche e suonava come bussare a una
 * porta. Il trillo di MSN non e' quello: e' una cosa che VIBRA — un tono
 * basso che trema in fretta e si spegne, come il vetro di una finestra
 * scrollata.
 *
 * Quel tremolio e' tutto: si ottiene modulando l'ampiezza a trenta volte al
 * secondo e facendo ondeggiare la frequenza. Senza, resta un tonfo.
 */
function boingNei(campioni: Float32Array, sr: number, inizio: number, volume: number) {
  const durata = Math.floor(sr * 0.5);
  for (let i = 0; i < durata; i++) {
    const t = i / sr;
    const dove = inizio + i;
    if (dove >= campioni.length) break;

    // Il tono scende piano da 165 a un centinaio di hertz: e' grave, si sente
    // attraverso una porta chiusa.
    const base = 165 * Math.exp(-t * 1.5);
    // E ondeggia: e' la parte che fa "oing" invece di "ooo".
    const f = base * (1 + 0.07 * Math.sin(2 * Math.PI * 16 * t));
    const corpo = Math.sin(2 * Math.PI * f * t);

    // Il tremolio: trenta volte al secondo. E' il vetro che sbatte.
    const tremore = 0.5 + 0.5 * Math.sin(2 * Math.PI * 30 * t);

    // Lo schiocco d'attacco, quindici millesimi: senza, il suono "entra" in
    // scena invece di cominciare.
    const schiocco = t < 0.015 ? (Math.random() * 2 - 1) * Math.pow(1 - t / 0.015, 2) * 0.6 : 0;

    const spegnimento = Math.exp(-t * 5.5);
    campioni[dove] += (corpo * (0.35 + 0.65 * tremore) * spegnimento + schiocco) * volume;
  }
}

/** I byte di un WAV mono a 16 bit, come li vuole un <audio>. */
function wav(campioni: Float32Array, sr: number): string {
  const buf = new ArrayBuffer(44 + campioni.length * 2);
  const v = new DataView(buf);
  const scrivi = (pos: number, testo: string) => {
    for (let i = 0; i < testo.length; i++) v.setUint8(pos + i, testo.charCodeAt(i));
  };
  scrivi(0, 'RIFF');
  v.setUint32(4, 36 + campioni.length * 2, true);
  scrivi(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);   // PCM
  v.setUint16(22, 1, true);   // mono
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  scrivi(36, 'data');
  v.setUint32(40, campioni.length * 2, true);
  for (let i = 0; i < campioni.length; i++) {
    const c = Math.max(-1, Math.min(1, campioni[i]));
    v.setInt16(44 + i * 2, c < 0 ? c * 0x8000 : c * 0x7fff, true);
  }
  let binario = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binario)}`;
}

let sorgente: string | null = null;

/** Il file del trillo, costruito una volta sola e poi riusato. */
export function fileTrillo(): string {
  if (sorgente) return sorgente;
  const sr = 22050;
  const campioni = new Float32Array(Math.floor(sr * 0.72));
  // Due scrollate: una sola sembra un errore di sistema, due sono un
  // richiamo — ed e' cosi' che si ricorda.
  boingNei(campioni, sr, 0, 0.8);
  boingNei(campioni, sr, Math.floor(sr * 0.22), 0.7);
  sorgente = wav(campioni, sr);
  return sorgente;
}

let elemento: HTMLAudioElement | null = null;
let suonoSuo: string | null = null;

/**
 * Il centro ha caricato un suo suono: da adesso il trillo e' quello.
 *
 * Quello costruito qui dentro resta come riserva — se il file non si apre,
 * meglio un trillo diverso che nessun trillo.
 */
export function usaSuonoSuo(dataUrl: string | null) {
  suonoSuo = dataUrl;
  elemento = null;
}

/**
 * Suona il trillo su QUESTO computer.
 *
 * Ritorna una promessa: `true` se il browser ha davvero fatto partire il
 * suono, `false` se l'ha bloccato. Cosi' il tasto puo' dirlo invece di far
 * credere che sia partito — che e' il modo in cui questa cosa e' rimasta
 * rotta per tre giri.
 */
export async function suonaTrillo(): Promise<boolean> {
  try {
    if (!elemento) {
      elemento = new Audio(suonoSuo || fileTrillo());
      elemento.preload = 'auto';
    }
    elemento.volume = 1;
    elemento.currentTime = 0;
    await elemento.play();
    try { navigator.vibrate?.([90, 70, 90]); } catch { /* niente vibrazione qui */ }
    return true;
  } catch {
    // Il tasto play e' stato rifiutato: si prova col sintetizzatore, che in
    // qualche browser vecchio e' l'unica strada rimasta.
    const c = creaContesto();
    if (!c) return false;
    if (c.state === 'suspended') await c.resume().catch(() => {});
    const ok = suona([
      { quando: 0, frequenza: 200, durata: 0.16 },
      { quando: 0.17, frequenza: 200, durata: 0.16 },
    ], 0.5);
    return ok;
  }
}
