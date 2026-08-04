'use client';

/**
 * Un link pubblico da incollare altrove, con tasto Copia.
 *
 * Serve dove un indirizzo va trascritto a mano da qualche altra parte (un
 * messaggio WhatsApp, il bottone di un template su 360dialog): scriverlo a
 * memoria è il modo più rapido per mandare i clienti nel posto sbagliato.
 */

import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export default function LinkCopiabile({
  titolo, descrizione, url, nota, icon: Icon,
}: {
  titolo: string;
  descrizione?: string;
  url: string;
  nota?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
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
        <Icon className="w-4 h-4 text-accent" />
        <p className="text-sm font-semibold text-text-primary">{titolo}</p>
      </div>
      {descrizione && <p className="text-xs text-text-muted leading-relaxed">{descrizione}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] text-text-secondary bg-bg-tertiary rounded-lg px-2.5 py-2 truncate">{url}</code>
        <button onClick={copia}
          className="p-2 rounded-lg bg-accent text-white hover:opacity-90 flex-shrink-0" title="Copia il link">
          {copiato ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a href={url} target="_blank" rel="noreferrer"
          className="p-2 rounded-lg bg-bg-tertiary text-text-muted hover:bg-bg-hover flex-shrink-0" title="Apri">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      {nota && <p className="text-[10px] text-text-muted/70 leading-relaxed">{nota}</p>}
    </div>
  );
}
