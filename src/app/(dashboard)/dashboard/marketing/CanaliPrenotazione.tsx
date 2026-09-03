'use client';

/**
 * Da dove arrivano le prenotazioni, e i link da mettere in giro.
 *
 * La pagina di prenotazione esiste da un pezzo, ma se nessuno sa che c'e' non
 * la usa nessuno: e' come avere un secondo telefono che non ha mai squillato
 * perche' il numero non l'abbiamo dato a nessuno.
 *
 * Qui ci sono i tre posti in cui va messa — la bio di Instagram, la scheda
 * Google, il QR al banco — con il link gia' pronto da copiare.
 */

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, MapPin, QrCode, ShoppingBag } from 'lucide-react';

function Riga({ titolo, sotto, link, icona: Icona, dove }: {
  titolo: string; sotto: string; link: string; icona: React.ElementType; dove: string;
}) {
  const [copiato, setCopiato] = useState(false);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch { /* il browser non ha dato il permesso: resta il link a schermo */ }
  };
  return (
    <div className="p-4 rounded-xl border border-border bg-bg-tertiary/40 space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
          <Icona className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{titolo}</p>
          <p className="text-[11px] text-text-muted leading-relaxed">{sotto}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary truncate">
          {link}
        </code>
        <button onClick={copia}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover flex-shrink-0">
          {copiato ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          {copiato ? 'Copiato' : 'Copia'}
        </button>
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="p-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover flex-shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-[10px] text-text-muted">{dove}</p>
    </div>
  );
}

export default function CanaliPrenotazione() {
  const origine = typeof window !== 'undefined' ? window.location.origin : 'https://erp.revobeauty.it';

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary">Da dove ti prenotano</h3>
        <p className="text-xs text-text-muted">
          La pagina di prenotazione c’è già. Quello che serve è che la gente sappia che esiste: questi sono i tre posti
          dove va messa.
        </p>
      </div>

      <Riga
        icona={Link2}
        titolo="Il link per la bio di Instagram"
        sotto="Una pagina sola con prenota, listino, WhatsApp, mappa e recensioni. Su Instagram si può mettere un link solo: questo è quello giusto."
        link={`${origine}/link`}
        dove="Instagram → Modifica profilo → Sito web"
      />

      <Riga
        icona={MapPin}
        titolo="Il link per la scheda Google"
        sotto="Chi cerca «centro estetico Maddaloni» ti trova su Google e vede il numero. Con questo link vede il tasto per prenotare, e prenota alle undici di sera."
        link={`${origine}/prenota`}
        dove="Profilo dell’attività su Google → Modifica → Link per appuntamenti"
      />

      <Riga
        icona={ShoppingBag}
        titolo="Il link dello shop"
        sotto="Ordina online, ritira e paga in centro. Chi finisce la crema di sera se la mette da parte dal divano, invece di comprarla al supermercato."
        link={`${origine}/shop`}
        dove="Nelle storie quando arriva un prodotto nuovo, e nella pagina Instagram"
      />

      <div className="p-4 rounded-xl border border-border bg-bg-tertiary/40">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Il QR da stampare</p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Sul biglietto da visita, allo specchio della cabina, in vetrina. Chi lo inquadra si prenota da solo mentre
              tu hai chiuso.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            ['Prenotazione · PNG', '/api/prenota/qr'],
            ['Prenotazione · SVG da stampare', '/api/prenota/qr?f=svg'],
            ['Pagina Instagram · PNG', '/api/prenota/qr?to=link'],
          ].map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">
              {label}
            </a>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Una precisazione onesta: «Prenota con Google», quello con il tasto dentro Google, è un accordo fra Google e le
        grandi piattaforme e non si può attivare da qui. Quello che abbiamo fatto è dire a Google chi siamo, dove siamo,
        quando siamo aperti e che da quella pagina si prenota — così il link giusto lo può mostrare lo stesso.
      </p>
    </div>
  );
}
