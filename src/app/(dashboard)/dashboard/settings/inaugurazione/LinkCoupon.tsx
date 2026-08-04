'use client';

/**
 * Il link del modulo coupon, pronto da incollare in un messaggio.
 *
 * L'inaugurazione è finita ma il modulo sul sito è rimasto in piedi: è ancora
 * il modo più rapido per raccogliere un contatto con il trattamento omaggio già
 * scelto. Il link porta `src=post-inaugurazione` così i contatti nuovi non si
 * confondono con quelli dell'apertura.
 */

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Gift } from 'lucide-react';

export default function LinkCoupon({ url }: { url: string }) {
  const [copiato, setCopiato] = useState(false);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-2xl bg-bg-secondary border border-border/50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-accent" />
        <p className="text-sm font-semibold text-text-primary">Link del trattamento in omaggio</p>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Il modulo sul sito è ancora attivo: chi lo compila sceglie il trattamento e riceve il coupon
        via email. Mandalo su WhatsApp a chi chiede informazioni.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] text-text-secondary bg-bg-tertiary rounded-lg px-2.5 py-2 truncate">{url}</code>
        <button onClick={copia}
          className="p-2 rounded-lg bg-accent text-white hover:opacity-90 flex-shrink-0" title="Copia il link">
          {copiato ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a href={url} target="_blank" rel="noreferrer"
          className="p-2 rounded-lg bg-bg-tertiary text-text-muted hover:bg-bg-hover flex-shrink-0" title="Apri il modulo">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-[10px] text-text-muted/70">
        Il <code>src=post-inaugurazione</code> in fondo serve a riconoscere questi contatti: arrivano da un
        nostro messaggio, non dall&apos;apertura del centro.
      </p>
    </div>
  );
}
