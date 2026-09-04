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
 * Tre pezzi per ogni colpo:
 *  - uno schiocco secco di rumore, dieci millesimi di secondo: e' l'attacco,
 *    la parte che fa "toc" invece di "tuu";
 *  - una nota che precipita da 200 a 70 hertz in un decimo di secondo: e' il
 *    legno che vibra dopo il colpo;
 *  - un filtro che taglia gli acuti, perche' un colpo su una superficie non
 *    ha acuti.
 *
 * Due colpi ravvicinati, come si bussa davvero.
 */
function colpo(c: AudioContext, quando: number, volume: number) {
  const t = c.currentTime + quando;

  // Lo schiocco: rumore bianco che dura un soffio.
  const campioni = Math.floor(c.sampleRate * 0.02);
  const buffer = c.createBuffer(1, campioni, c.sampleRate);
  const dati = buffer.getChannelData(0);
  for (let i = 0; i < campioni; i++) {
    // Si spegne subito: e' l'unghia sul vetro, non una folata.
    dati[i] = (Math.random() * 2 - 1) * (1 - i / campioni) ** 3;
  }
  const rumore = c.createBufferSource();
  rumore.buffer = buffer;
  const gRumore = c.createGain();
  gRumore.gain.value = volume * 0.5;
  const passaBasso = c.createBiquadFilter();
  passaBasso.type = 'lowpass';
  passaBasso.frequency.value = 1800;
  rumore.connect(gRumore); gRumore.connect(passaBasso); passaBasso.connect(c.destination);
  rumore.start(t);

  // Il corpo: una nota che casca.
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.11);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.18);
}

/**
 * Suona il trillo su QUESTO schermo.
 *
 * Il volume e' alto: non deve sentirlo chi preme il tasto — quello ce l'ha
 * sotto il naso — ma chi sta in cabina dall'altra parte del centro, con le
 * casse del computer del banco che suonano nella sala.
 *
 * Ritorna false se il browser non ha lasciato fare rumore, cosi' si puo' dire
 * invece di far credere che sia partito.
 */
export function suonaTrillo(): boolean {
  const c = creaContesto();
  if (!c) return false;
  if (c.state === 'suspended') c.resume().catch(() => {});
  try {
    colpo(c, 0, 0.55);
    colpo(c, 0.17, 0.55);
  } catch {
    return false;
  }
  try {
    navigator.vibrate?.([90, 70, 90]);
  } catch { /* niente vibrazione su questo dispositivo */ }
  return c.state === 'running';
}
