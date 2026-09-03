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

/** Il trillo: due note che scendono, due volte. */
export const TRILLO: Nota[] = [
  { quando: 0, frequenza: 988 },
  { quando: 0.14, frequenza: 784 },
  { quando: 0.42, frequenza: 988 },
  { quando: 0.56, frequenza: 784 },
];
