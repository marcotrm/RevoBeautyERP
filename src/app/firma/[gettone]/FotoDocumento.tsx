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
 * millesettecento pixel di lato. Con la compressione la lettura parte in un
 * secondo invece che in venti.
 */
function rimpicciolisci(file: File, latoMax = 1700, qualita = 0.82): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error('lettura fallita'));
    lettore.onload = () => {
      const img = new Image();
      img.onerror = () => rifiuta(new Error('immagine non valida'));
      img.onload = () => {
        const scala = Math.min(1, latoMax / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scala);
        c.height = Math.round(img.height * scala);
        const ctx = c.getContext('2d');
        if (!ctx) { rifiuta(new Error('canvas non disponibile')); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        risolvi(c.toDataURL('image/jpeg', qualita));
      };
      img.src = String(lettore.result);
    };
    lettore.readAsDataURL(file);
  });
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
      setFoto(dataUrl);
      const r = await leggiDocumentoDalModulo(gettone, dataUrl);
      if (!r.leggibile) {
        setProblema(r.problema || 'La foto non si legge bene: riprova.');
        setFoto(null);
        return;
      }
      const d: DocumentoCompilato = {
        foto: dataUrl,
        tipo: r.tipo || 'carta_identita',
        numero: r.numero || '',
        nome: r.nome || '',
        cognome: r.cognome || '',
        dataNascita: r.dataNascita || '',
        scadenza: r.scadenza || '',
      };
      setCampi(d);
      onChange(d.numero ? d : null);
    } catch {
      setProblema('Non sono riuscito ad aprire la foto: riprova.');
      setFoto(null);
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

      {foto && campi && (
        <div className="mt-4 space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="Il tuo documento" className="w-full rounded-xl border border-gray-200" />
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-gray-500">Controlla che sia tutto giusto</p>
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
