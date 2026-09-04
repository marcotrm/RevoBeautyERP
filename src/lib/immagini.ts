/**
 * Aprire una foto scattata col telefono, e farla stare in un messaggio.
 *
 * Sembra banale e non lo e': dall'iPhone arrivano HEIC che Chrome non apre,
 * foto da dodici megapixel che su iOS fanno uscire un canvas nero, e quattro
 * megabyte che il server rifiuta. Ognuno di questi tre casi ha fatto sembrare
 * rotto il modulo del consenso, uno dopo l'altro.
 *
 * Sta qui perche' non e' un problema del consenso: e' il problema di
 * chiunque, in questo gestionale, chieda una foto a qualcuno.
 */

/**
 * La foto si rimpicciolisce prima di partire.
 *
 * Dal telefono arrivano foto da otto megapixel: sono quattro megabyte che
 * viaggiano su una tacca di rete, e per leggere un numero stampato bastano
 * millesettecento pixel di lato.
 *
 * Ci sono tre strade per aprire l'immagine, e si provano in fila. Non e'
 * pignoleria: la prima versione ne aveva una sola — FileReader, poi <img> — e
 * bastava una foto HEIC dell'iPhone per farla fallire con «non sono riuscito
 * ad aprire la foto». Dopo quel messaggio non c'era piu' niente da fare.
 */

/** Il motivo tecnico dell'ultimo tentativo fallito: serve a capire, non a chi firma. */
let ultimoMotivo = '';

export function motivoFoto(): string { return ultimoMotivo; }

/** Strada 1: quella buona. Decodifica anche l'HEIC dove il sistema lo sa fare. */
async function daBitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap assente');
  return createImageBitmap(file);
}

/** Strada 2: l'indirizzo temporaneo del file, senza passare da base64. */
function daObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('il browser non apre questo formato')); };
    img.src = url;
  });
}

/** Strada 3: la vecchia, base64. Costosa in memoria ma funziona dove le altre no. */
function daBase64(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const lettore = new FileReader();
    lettore.onerror = () => no(new Error('il file non si legge'));
    lettore.onload = () => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => no(new Error('immagine non valida'));
      img.src = String(lettore.result);
    };
    lettore.readAsDataURL(file);
  });
}

/** Il file cosi' com'e', quando ridimensionarlo non riesce: meglio pesante che niente. */
function comEStata(file: File): Promise<string> {
  return new Promise((ok, no) => {
    const l = new FileReader();
    l.onerror = () => no(new Error('il file non si legge'));
    l.onload = () => ok(String(l.result));
    l.readAsDataURL(file);
  });
}

/**
 * Quanto puo' pesare la foto che parte, in caratteri base64.
 *
 * Il limite vero sta sul server ed e' piu' alto, ma un megabyte e' anche il
 * punto oltre il quale, su una tacca di rete in cabina, l'attesa comincia a
 * sembrare un blocco. Meglio una foto un po' piu' morbida che arriva.
 */
const PESO_MASSIMO = 900_000;

export async function rimpicciolisci(file: File, latoMax = 1700, qualita = 0.82): Promise<string> {
  const guai: string[] = [];
  let sorgente: (CanvasImageSource & { width: number; height: number }) | HTMLImageElement | null = null;

  for (const [nome, prova] of [
    ['bitmap', daBitmap], ['objectUrl', daObjectUrl], ['base64', daBase64],
  ] as const) {
    try {
      sorgente = await prova(file);
      break;
    } catch (e) {
      guai.push(`${nome}: ${(e as Error).message}`);
    }
  }

  if (!sorgente) {
    ultimoMotivo = guai.join(' · ');
    // Nessuna delle tre l'ha aperta, ma il file c'e': lo si manda com'e'.
    // Il lettore ci prova lo stesso, e se non ce la fa i campi si scrivono.
    return comEStata(file);
  }

  try {
    const w = sorgente.width;
    const h = sorgente.height;
    /*
      Il tetto sui pixel non e' scaramanzia: su iOS un canvas oltre i sedici
      megapixel esce nero o non esce affatto, e il risultato e' una foto vuota
      mandata al lettore — che poi «non si legge», e non si capisce perche'.
    */
    const scala = Math.min(1, latoMax / Math.max(w, h), Math.sqrt(16_000_000 / (w * h)));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scala));
    c.height = Math.max(1, Math.round(h * scala));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas non disponibile');
    ctx.drawImage(sorgente as CanvasImageSource, 0, 0, c.width, c.height);
    let fuori = c.toDataURL('image/jpeg', qualita);
    // Un canvas fallito su iOS non lancia: restituisce una stringa cortissima.
    if (!fuori || fuori.length < 2000) throw new Error('il ridimensionamento e\' uscito vuoto');

    /*
      Se e' ancora troppo pesante si stringe ancora, fino a tre volte.

      Una carta d'identita' fotografata da vicino, piena di guilloche e
      microscritte, a 1700 pixel puo' pesare piu' di un megabyte anche in
      JPEG: comprimere una volta sola non basta, e il numero resta leggibile
      lo stesso — e' stampato grande.
    */
    for (let giro = 0; giro < 3 && fuori.length > PESO_MASSIMO; giro++) {
      const q = Math.max(0.45, qualita - 0.15 * (giro + 1));
      const piccolo = document.createElement('canvas');
      piccolo.width = Math.max(1, Math.round(c.width * 0.8));
      piccolo.height = Math.max(1, Math.round(c.height * 0.8));
      const c2 = piccolo.getContext('2d');
      if (!c2) break;
      c2.drawImage(c, 0, 0, piccolo.width, piccolo.height);
      const stretta = piccolo.toDataURL('image/jpeg', q);
      if (!stretta || stretta.length < 2000) break;
      fuori = stretta;
      c.width = piccolo.width; c.height = piccolo.height;
      c.getContext('2d')?.drawImage(piccolo, 0, 0);
    }

    ultimoMotivo = '';
    return fuori;
  } catch (e) {
    ultimoMotivo = `ridimensionamento: ${(e as Error).message}`;
    return comEStata(file);
  } finally {
    (sorgente as ImageBitmap)?.close?.();
  }
}

