'use client';

/**
 * "Esporta i dati": il tasto che rende i dati del centro davvero tuoi.
 *
 * Chi compra un gestionale ha una paura ragionevole — restare chiuso dentro.
 * Qui si scarica tutto in un foglio Excel: nessun formato strano, nessun
 * blocco, si apre anche fra dieci anni con qualsiasi programma.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';

const FOGLI = [
  ['Clienti', 'anagrafica completa, consensi, visite e speso'],
  ['Appuntamenti', 'nel periodo scelto, con operatrice, stato e prezzo'],
  ['Incassi', 'con metodo di pagamento e numero dello scontrino fiscale'],
  ['Magazzino', 'giacenze, prezzi e valore di quello che hai in casa'],
  ['Pacchetti', 'sedute usate, rimaste e quanto resta da pagare'],
  ['Buoni regalo', 'importo, residuo e scadenza'],
];

function primoGennaio(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function oggi(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function EsportaPage() {
  const [tutto, setTutto] = useState(true);
  const [da, setDa] = useState(primoGennaio());
  const [a, setA] = useState(oggi());

  const link = tutto ? '/api/esporta' : `/api/esporta?da=${da}&a=${a}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-accent" /> Esporta i dati
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Tutto il centro in un foglio Excel, da tenere dove vuoi tu
        </p>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-5">
        <div className="flex gap-2.5 p-3 rounded-xl bg-success/5 border border-success/20">
          <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Il file è un normale Excel, un foglio per argomento. Non serve questo gestionale per riaprirlo:
            vale come copia di sicurezza tua, come elenco da dare al commercialista e come bagaglio se un
            giorno decidessi di cambiare programma.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Cosa esportare</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTutto(true)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tutto ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
              }`}>
              Tutto, dall&apos;inizio
            </button>
            <button onClick={() => setTutto(false)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                !tutto ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
              }`}>
              Solo un periodo
            </button>
          </div>
          {!tutto && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <input type="date" value={da} onChange={e => setDa(e.target.value)}
                className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
              <span className="text-text-muted">→</span>
              <input type="date" value={a} onChange={e => setA(e.target.value)}
                className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
              <span className="text-[11px] text-text-muted">
                Il periodo vale su appuntamenti e incassi. Clienti, magazzino, pacchetti e buoni escono sempre
                per intero: sono lo stato di adesso.
              </span>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Cosa c&apos;è dentro</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {FOGLI.map(([nome, cosa]) => (
              <div key={nome} className="px-3 py-2 rounded-xl bg-bg-tertiary/40 border border-border/60">
                <p className="text-sm font-semibold text-text-primary">{nome}</p>
                <p className="text-[11px] text-text-muted leading-tight">{cosa}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Un link, non una fetch: il file lo scarica il browser, senza tenere
            in memoria della pagina qualche mega di dati. */}
        <a href={link} download
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" /> Scarica il foglio Excel
        </a>
        <p className="text-[11px] text-text-muted">
          Con qualche migliaio di appuntamenti ci mette una decina di secondi. Dentro ci sono dati delle
          clienti: tienilo dove terresti l&apos;agenda cartacea, non su una chiavetta che gira.
        </p>
      </div>
    </motion.div>
  );
}
