'use client';

/**
 * La foto del documento, con il controllo che si legga.
 *
 * Il numero del documento sul consenso prima si copiava a mano dal tesserino
 * mentre la cliente aspettava: numeri sbagliati, cognomi storpiati, e a volte
 * niente perche' non c'era tempo. Qui la foto la fa lei, e i dati li legge il
 * gestionale.
 *
 * La parte che conta e' il controllo SUBITO: se la foto e' mossa o c'e' un
 * riflesso sul numero, lo si dice adesso che la persona ha il documento in
 * mano. Scoperto tre giorni dopo, non si rifa' piu'.
 *
 * Quello che viene letto si mostra sempre in campi modificabili: il modello
 * sbaglia una cifra ogni tanto, e un numero sbagliato su un consenso firmato
 * e' peggio di nessun numero.
 */

import React, { useRef, useState } from 'react';
import { leggiDocumentoDalModulo } from '@/app/actions/consensoLaser';

export interface DocumentoCompilato {
  foto: string;
  anteprima: string;
  tipo: string;
  numero: string;
  nome: string;
  cognome: string;
  dataNascita: string;
  scadenza: string;
}

const TIPI: { id: string; nome: string }[] = [
  { id: 'carta_identita', nome: "Carta d'identità" },
  { id: 'patente', nome: 'Patente' },
  { id: 'passaporto', nome: 'Passaporto' },
  { id: 'altro', nome: 'Altro' },
];

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

async function rimpicciolisci(file: File, latoMax = 1700, qualita = 0.82): Promise<string> {
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

export default function FotoDocumento({ gettone, giaAgliAtti, onChange }: {
  gettone: string;
  /** Il documento che il centro ha gia': allora non si chiede niente. */
  giaAgliAtti?: { tipo: string; numero: string; quando: string } | null;
  onChange: (d: DocumentoCompilato | null) => void;
}) {
  const [foto, setFoto] = useState<string | null>(null);
  const [leggendo, setLeggendo] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [campi, setCampi] = useState<DocumentoCompilato | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const scegli = async (file?: File | null) => {
    if (!file) return;
    setProblema(null);
    setLeggendo(true);
    setCampi(null);
    onChange(null);
    try {
      const dataUrl = await rimpicciolisci(file);
      // La miniatura serve all'elenco: cento documenti a schermo con le foto
      // intere sarebbero decine di megabyte per guardare una griglia.
      const mini = await rimpicciolisci(file, 320, 0.7).catch(() => '');
      setFoto(dataUrl);
      const r = await leggiDocumentoDalModulo(gettone, dataUrl);
      if (!r.leggibile) {
        /*
          Non si legge: si tiene comunque la foto e si aprono i campi vuoti.

          Prima da qui non si usciva: la foto veniva buttata e restava solo
          «Rifai la foto». Se il lettore era giu' — ed e' successo, per un
          conto rimasto senza credito — la cliente rifotografava all'infinito
          la stessa carta d'identita' perfettamente leggibile. Vincenzo Ferro
          ci ha provato, poi ha scritto in chat «non capisco perche' non mi fa
          inserire il documento» e ha mandato la foto li'.

          Il numero del documento e' una riga di testo: se la macchina non
          riesce a leggerlo, lo si scrive. Non e' un buon motivo per fermare
          una persona davanti a un modulo.
        */
        setProblema(r.problema || 'Non riesco a leggerla: puoi rifare la foto, oppure scrivere tu i dati qui sotto.');
        setCampi({
          foto: dataUrl, anteprima: mini, tipo: 'carta_identita',
          numero: '', nome: '', cognome: '', dataNascita: '', scadenza: '',
        });
        return;
      }
      const d: DocumentoCompilato = {
        foto: dataUrl,
        anteprima: mini,
        tipo: r.tipo || 'carta_identita',
        numero: r.numero || '',
        nome: r.nome || '',
        cognome: r.cognome || '',
        dataNascita: r.dataNascita || '',
        scadenza: r.scadenza || '',
      };
      setCampi(d);
      onChange(d.numero ? d : null);
    } catch (e) {
      /*
        Nemmeno cosi'. Ma fermarsi qui vorrebbe dire lasciare una persona
        davanti a un modulo che non si chiude: i campi si aprono lo stesso e
        si scrivono a mano, che e' come si faceva con la fotocopiatrice.

        Il motivo tecnico si scrive piccolo sotto: senza, l'unica cosa che si
        poteva fare era indovinare — ed e' quello che e' successo, per giorni.
      */
      /*
        Il messaggio che arriva da un errore del server e' scritto per chi
        programma — «An error occurred in the Server Components render...» — e
        davanti a una cliente non vuol dire niente. Si tiene solo quello che
        aiuta davvero: che si puo' riprovare e che i dati si possono scrivere.
      */
      const grezzo = motivoFoto() || (e as Error)?.message || '';
      const daServer = /server components|digest|fetch failed|body exceeded/i.test(grezzo);
      const motivo = daServer ? 'la foto non è arrivata al server' : grezzo.slice(0, 90);
      setProblema(`Non sono riuscito a leggerla${motivo ? ` (${motivo})` : ''}. Puoi rifare la foto, oppure scrivere i dati qui sotto.`);
      setCampi({
        foto: '', anteprima: '', tipo: 'carta_identita',
        numero: '', nome: '', cognome: '', dataNascita: '', scadenza: '',
      });
    } finally {
      setLeggendo(false);
    }
  };

  const cambia = (chiave: keyof DocumentoCompilato, valore: string) => {
    setCampi(c => {
      if (!c) return c;
      const nuovoStato = { ...c, [chiave]: valore };
      onChange(nuovoStato.numero ? nuovoStato : null);
      return nuovoStato;
    });
  };

  // Il documento c'e' gia': non si richiede, si chiede solo se e' cambiato.
  if (giaAgliAtti && !nuovo) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <h2 className="font-bold text-gray-900">Il tuo documento</h2>
        <p className="mt-1 text-[15px] text-gray-700">
          Ce l&apos;abbiamo già: {TIPI.find(t => t.id === giaAgliAtti.tipo)?.nome || 'Documento'} n. {giaAgliAtti.numero},
          registrato il {new Date(giaAgliAtti.quando).toLocaleDateString('it-IT')}.
        </p>
        <button type="button" onClick={() => setNuovo(true)}
          className="mt-3 text-[15px] font-semibold text-amber-700 underline">
          È cambiato, ne faccio una foto nuova
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <h2 className="font-bold text-gray-900">Il tuo documento</h2>
      <p className="mt-1 text-[15px] text-gray-600">
        Ci serve il numero per il consenso. Fai una foto della carta d&apos;identità o della patente: i dati li leggiamo noi.
      </p>

      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => scegli(e.target.files?.[0])} />

      {!foto && !leggendo && (
        <button type="button" onClick={() => input.current?.click()}
          className="mt-4 w-full py-4 rounded-2xl bg-gray-900 text-white text-[17px] font-bold active:scale-[0.99] transition-transform">
          📷 Fotografa il documento
        </button>
      )}

      {leggendo && (
        <div className="mt-4 py-6 text-center">
          <div className="mx-auto w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
          <p className="mt-3 text-[15px] text-gray-600">Sto leggendo il documento…</p>
        </div>
      )}

      {problema && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-[15px] font-semibold text-amber-900">{problema}</p>
          <button type="button" onClick={() => input.current?.click()}
            className="mt-3 w-full py-3 rounded-xl bg-gray-900 text-white text-[16px] font-bold">
            Rifai la foto
          </button>
        </div>
      )}

      {campi && (
        <div className="mt-4 space-y-4">
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="Il tuo documento" className="w-full rounded-xl border border-gray-200" />
          )}
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-gray-500">
              {foto ? 'Controlla che sia tutto giusto' : 'Scrivi i dati del documento'}
            </p>
            <button type="button" onClick={() => input.current?.click()}
              className="text-[14px] font-semibold text-amber-700 underline">Rifai la foto</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="text-[13px] font-semibold text-gray-700">Tipo di documento</span>
              <select value={campi.tipo} onChange={e => cambia('tipo', e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px] bg-white">
                {TIPI.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="text-[13px] font-semibold text-gray-700">Numero del documento</span>
              <input type="text" value={campi.numero} onChange={e => cambia('numero', e.target.value)}
                placeholder="es. CA12345AB"
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px] font-semibold" />
              {!campi.numero && <span className="text-[13px] text-amber-700">Non sono riuscito a leggerlo: scrivilo tu.</span>}
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-gray-700">Nome</span>
              <input type="text" value={campi.nome} onChange={e => cambia('nome', e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-gray-700">Cognome</span>
              <input type="text" value={campi.cognome} onChange={e => cambia('cognome', e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-gray-700">Data di nascita</span>
              <input type="date" value={campi.dataNascita} onChange={e => cambia('dataNascita', e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-gray-700">Scadenza</span>
              <input type="date" value={campi.scadenza} onChange={e => cambia('scadenza', e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
