'use client';

/**
 * Il suono del trillo, scelto dal centro.
 *
 * Quello che il gestionale fa da solo e' una ricostruzione: il trillo vero di
 * MSN e' un file di Microsoft, e non si mette il file di qualcun altro dentro
 * il prodotto di qualcun altro ancora. Ma se quel file ce l'hai tu — sul
 * vecchio computer, o comprato, o registrato — qui lo carichi e da quel
 * momento il tasto suona il tuo.
 *
 * Vale per qualunque suono: un campanello, una voce registrata, tre note di
 * pianoforte. L'unica regola e' che sia corto.
 */

import React, { useEffect, useRef, useState } from 'react';
import { BellRing, Loader2, Play, Trash2, Upload } from 'lucide-react';
import { leggiSuonoTrillo, salvaSuonoTrillo, togliSuonoTrillo } from '@/app/actions/suoni';
import { fileTrillo, usaSuonoSuo } from '@/lib/suono';

export function SuonoTrillo() {
  const [suo, setSuo] = useState<{ dataUrl: string; nome: string } | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  const scegli = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    leggiSuonoTrillo()
      .then(s => { if (vivo) { setSuo(s); setCaricato(true); } })
      .catch(() => { if (vivo) setCaricato(true); });
    return () => { vivo = false; };
  }, []);

  const prova = (dataUrl: string) => {
    const a = new Audio(dataUrl);
    a.volume = 1;
    a.play().catch(() => setErrore('Il browser non ha fatto uscire l’audio: controlla il volume.'));
  };

  const carica = async (file: File) => {
    setErrore('');
    if (file.size > 300_000) {
      setErrore('Il file è troppo pesante: serve un suono corto, sotto i 300 KB.');
      return;
    }
    setOccupato(true);
    try {
      const dataUrl = await new Promise<string>((ok, no) => {
        const l = new FileReader();
        l.onload = () => ok(String(l.result));
        l.onerror = () => no(new Error('lettura fallita'));
        l.readAsDataURL(file);
      });
      const r = await salvaSuonoTrillo(dataUrl, file.name);
      if (!r.ok) { setErrore(r.error || 'Non si è potuto salvare.'); return; }
      setSuo({ dataUrl, nome: file.name });
      usaSuonoSuo(dataUrl);
      prova(dataUrl);
    } catch {
      setErrore('Non sono riuscito a leggere il file.');
    } finally {
      setOccupato(false);
    }
  };

  const togli = async () => {
    setOccupato(true);
    try {
      await togliSuonoTrillo();
      setSuo(null);
      usaSuonoSuo(null);
    } finally { setOccupato(false); }
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-accent" />
        <div>
          <h3 className="text-lg font-display font-semibold text-text-primary">Il suono del trillo</h3>
          <p className="text-xs text-text-muted">
            Quello che senti premendo la campanella in alto, accanto alla chat.
          </p>
        </div>
      </div>

      {!caricato ? (
        <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Carico…</p>
      ) : (
        <>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-bg-tertiary/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">
                {suo ? suo.nome : 'Quello costruito dal gestionale'}
              </p>
              <p className="text-[11px] text-text-muted">
                {suo ? 'Il tuo file' : 'Una ricostruzione del trillo: un tono grave che vibra e si spegne'}
              </p>
            </div>
            <button onClick={() => prova(suo?.dataUrl || fileTrillo())}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex-shrink-0">
              <Play className="w-3.5 h-3.5" /> Senti
            </button>
            {suo && (
              <button onClick={togli} disabled={occupato}
                className="p-2 rounded-lg border border-border text-text-muted hover:text-error hover:border-error/40 flex-shrink-0 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <input ref={scegli} type="file" accept="audio/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) carica(f); e.target.value = ''; }} />
          <button onClick={() => scegli.current?.click()} disabled={occupato}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-50">
            {occupato ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Carica il tuo suono
          </button>

          {errore && <p className="text-[11px] text-error">{errore}</p>}

          <p className="text-[11px] text-text-muted leading-relaxed">
            Il trillo originale di MSN è un file di Microsoft e non posso metterlo io dentro il gestionale. Se ce l’hai
            tu — sul vecchio computer, o scaricato da dove preferisci — caricalo qui e il tasto suonerà esattamente
            quello. Vale per qualunque suono, basta che sia corto: mp3, wav o ogg sotto i 300 KB.
          </p>
        </>
      )}
    </div>
  );
}
