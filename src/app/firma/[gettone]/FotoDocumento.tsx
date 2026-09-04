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
import { motivoFoto, rimpicciolisci } from '@/lib/immagini';
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
  /** 'M' o 'F' quando il documento lo dice: sulla carta d'identita' c'e' scritto. */
  sesso?: 'M' | 'F';
  /*
    Dove abita.

    Non serve al consenso: serve al check-in, che senza indirizzo e citta' si
    ferma. Chiederli qui vuol dire chiederli una volta sola, alla persona che
    li sa, mentre e' seduta col telefono in mano — invece che dettarli al
    banco con la cabina che aspetta. Se il documento li mostra arrivano gia'
    scritti e lei deve solo controllare.
  */
  indirizzo?: string;
  citta?: string;
}

const TIPI: { id: string; nome: string }[] = [
  { id: 'carta_identita', nome: "Carta d'identità" },
  { id: 'patente', nome: 'Patente' },
  { id: 'passaporto', nome: 'Passaporto' },
  { id: 'altro', nome: 'Altro' },
];

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
          indirizzo: '', citta: '',
        });
        return;
      }
      const d: DocumentoCompilato = {
        foto: dataUrl,
        anteprima: mini,
        sesso: r.sesso,
        tipo: r.tipo || 'carta_identita',
        numero: r.numero || '',
        nome: r.nome || '',
        cognome: r.cognome || '',
        dataNascita: r.dataNascita || '',
        scadenza: r.scadenza || '',
        indirizzo: r.indirizzo || '',
        citta: r.comune || '',
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
        indirizzo: '', citta: '',
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
            <label className="block min-w-0">
              <span className="text-[13px] font-semibold text-gray-700">Nome</span>
              <input type="text" value={campi.nome} onChange={e => cambia('nome', e.target.value)}
                className="mt-1 w-full min-w-0 px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            <label className="block min-w-0">
              <span className="text-[13px] font-semibold text-gray-700">Cognome</span>
              <input type="text" value={campi.cognome} onChange={e => cambia('cognome', e.target.value)}
                className="mt-1 w-full min-w-0 px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            {/*
              I due campi data, uno per riga sul telefono.

              Un `input[type=date]` su iPhone scrive la data per esteso — «12
              giu 1991» — accanto all'icona del calendario, e quella larghezza
              se la prende comunque: con `min-w-0` la casella si stringe ma il
              testo dentro no, e continua a sbordare sopra alla casella
              accanto. Affiancarli in 375 pixel e' una battaglia persa: sul
              telefono stanno uno sotto l'altro, da tablet in su tornano in
              fila. Sono anche piu' facili da centrare col dito.
            */}
            <label className="block min-w-0 col-span-2 sm:col-span-1">
              <span className="text-[13px] font-semibold text-gray-700">Data di nascita</span>
              <input type="date" value={campi.dataNascita} onChange={e => cambia('dataNascita', e.target.value)}
                className="mt-1 w-full min-w-0 px-2.5 py-3 rounded-xl border border-gray-300 text-[15px]" />
            </label>
            <label className="block min-w-0 col-span-2 sm:col-span-1">
              <span className="text-[13px] font-semibold text-gray-700">Scadenza</span>
              <input type="date" value={campi.scadenza} onChange={e => cambia('scadenza', e.target.value)}
                className="mt-1 w-full min-w-0 px-2.5 py-3 rounded-xl border border-gray-300 text-[15px]" />
            </label>

            {/*
              L'indirizzo, chiesto qui una volta sola.

              Sul documento c'e' scritto, ma quasi sempre sul retro, e la foto
              e' del fronte: allora si scrive. Sono trenta secondi al telefono
              invece di due minuti dettati al banco con la cabina che aspetta —
              e senza questi due campi il check-in si ferma, quindi qualcuno
              deve comunque chiederglieli, prima o poi.
            */}
            <label className="col-span-2 block">
              <span className="text-[13px] font-semibold text-gray-700">Indirizzo</span>
              <input type="text" value={campi.indirizzo || ''} onChange={e => cambia('indirizzo', e.target.value)}
                placeholder="es. via Roma 12"
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
            </label>
            <label className="col-span-2 block">
              <span className="text-[13px] font-semibold text-gray-700">Città</span>
              <input type="text" value={campi.citta || ''} onChange={e => cambia('citta', e.target.value)}
                placeholder="es. Crispano"
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-300 text-[16px]" />
              <span className="text-[13px] text-gray-500">Servono per la tua scheda: così al banco non te li chiediamo più.</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
