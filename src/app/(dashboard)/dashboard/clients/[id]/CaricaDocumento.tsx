'use client';

/**
 * Il documento caricato dal banco, dall'operatrice.
 *
 * La cliente lo fotografa da sola quando firma il consenso, ma non tutte
 * passano da li': chi ha firmato prima che questa cosa esistesse, chi ha
 * cambiato la carta d'identita', chi il consenso l'ha fatto su carta anni fa.
 * Per tutte quelle il documento lo carica chi sta al banco, con la stessa
 * lettura automatica e lo stesso controllo che si legga.
 */

import React, { useRef, useState } from 'react';
import { Camera, Check, IdCard, Loader2, X } from 'lucide-react';
import { leggiFotoDocumento, salvaDocumento } from '@/app/actions/documenti';

const TIPI = [
  { id: 'carta_identita', nome: "Carta d'identità" },
  { id: 'patente', nome: 'Patente' },
  { id: 'passaporto', nome: 'Passaporto' },
  { id: 'altro', nome: 'Altro' },
];

/** Stessa compressione del modulo pubblico: per leggere un numero bastano 1700px. */
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

export default function CaricaDocumento({ clientId, onFatto }: {
  clientId: string; onFatto?: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [leggendo, setLeggendo] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [campi, setCampi] = useState({ tipo: 'carta_identita', numero: '', nome: '', cognome: '', dataNascita: '', scadenza: '' });
  const input = useRef<HTMLInputElement>(null);

  const scegli = async (file?: File | null) => {
    if (!file) return;
    setProblema(null); setLeggendo(true);
    try {
      const dataUrl = await rimpicciolisci(file);
      setFoto(dataUrl);
      const r = await leggiFotoDocumento(dataUrl);
      if (!r.leggibile) {
        setProblema(r.problema || 'La foto non si legge bene: rifalla.');
        setFoto(null);
        return;
      }
      setCampi({
        tipo: r.tipo || 'carta_identita',
        numero: r.numero || '',
        nome: r.nome || '',
        cognome: r.cognome || '',
        dataNascita: r.dataNascita || '',
        scadenza: r.scadenza || '',
      });
    } catch {
      setProblema('Non sono riuscito ad aprire la foto: riprova.');
      setFoto(null);
    } finally { setLeggendo(false); }
  };

  const salva = async () => {
    if (!foto || !campi.numero.trim()) return;
    setSalvando(true);
    try {
      await salvaDocumento({ clientId, ...campi, foto, origine: 'operatrice' });
      setAperto(false); setFoto(null);
      setCampi({ tipo: 'carta_identita', numero: '', nome: '', cognome: '', dataNascita: '', scadenza: '' });
      onFatto?.();
    } finally { setSalvando(false); }
  };

  if (!aperto) {
    return (
      <button onClick={() => setAperto(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
        <IdCard className="w-4 h-4" /> Carica documento
      </button>
    );
  }

  const campo = (chiave: keyof typeof campi, etichetta: string, tipo = 'text') => (
    <label className="block">
      <span className="text-[11px] font-medium text-text-secondary">{etichetta}</span>
      <input type={tipo} value={campi[chiave]} onChange={e => setCampi(c => ({ ...c, [chiave]: e.target.value }))}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/60" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !salvando && setAperto(false)}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-secondary border border-border rounded-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-display font-semibold text-text-primary">Documento della cliente</h3>
          <button onClick={() => setAperto(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => scegli(e.target.files?.[0])} />

          {!foto && !leggendo && (
            <button onClick={() => input.current?.click()}
              className="w-full py-8 rounded-xl border-2 border-dashed border-border hover:border-accent/50 text-sm text-text-secondary flex flex-col items-center gap-2">
              <Camera className="w-6 h-6 text-text-muted" />
              Fotografa o scegli il documento
            </button>
          )}

          {leggendo && (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="mt-2 text-sm text-text-muted">Sto leggendo il documento…</p>
            </div>
          )}

          {problema && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
              <p className="text-sm text-text-primary">{problema}</p>
              <button onClick={() => input.current?.click()} className="mt-2 text-xs font-semibold text-accent hover:underline">
                Rifai la foto
              </button>
            </div>
          )}

          {foto && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="documento" className="w-full rounded-xl border border-border bg-white" />
              <button onClick={() => input.current?.click()} className="text-xs font-semibold text-accent hover:underline">
                Rifai la foto
              </button>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block">
                  <span className="text-[11px] font-medium text-text-secondary">Tipo</span>
                  <select value={campi.tipo} onChange={e => setCampi(c => ({ ...c, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary">
                    {TIPI.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </label>
                <div className="col-span-2">{campo('numero', 'Numero del documento')}</div>
                {campo('nome', 'Nome')}
                {campo('cognome', 'Cognome')}
                {campo('dataNascita', 'Data di nascita', 'date')}
                {campo('scadenza', 'Scadenza', 'date')}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={() => setAperto(false)} disabled={salvando}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover">Annulla</button>
          <button onClick={salva} disabled={salvando || !foto || !campi.numero.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-40">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salva
          </button>
        </div>
      </div>
    </div>
  );
}
