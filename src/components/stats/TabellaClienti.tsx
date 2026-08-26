'use client';

/**
 * Classifica clienti del periodo, riordinabile.
 *
 * "Migliore cliente" non vuol dire una cosa sola: c'è chi spende tanto in poche
 * volte, chi viene sempre spendendo poco e chi prenota molto ma disdice. Il
 * criterio si cambia da qui, e ogni riga porta con sé tutti i numeri per
 * decidere — senza aprire la scheda una per una.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import DettaglioCliente from './DettaglioCliente';
import { Search, ArrowUpDown, Download, ExternalLink } from 'lucide-react';
import type { ClientRow } from '@/app/actions/clientStats';
import { Vuoto, eur } from './StatsUI';

type Chiave = 'spesa' | 'visite' | 'prenotati' | 'scontrinoMedio' | 'disdette' | 'ogniQuantiGiorni' | 'giorniDaUltima';

const CRITERI: { key: Chiave; label: string; spiega: string }[] = [
  { key: 'spesa', label: 'Chi spende di più', spiega: 'Somma incassata in cassa nel periodo.' },
  { key: 'visite', label: 'Chi torna di più', spiega: 'Giornate con almeno un trattamento completato.' },
  { key: 'prenotati', label: 'Chi prenota di più', spiega: 'Appuntamenti presi, indipendentemente da come sono finiti.' },
  { key: 'scontrinoMedio', label: 'Scontrino più alto', spiega: 'Spesa media a passaggio in cassa: chi vale di più per singola visita.' },
  { key: 'disdette', label: 'Chi disdice di più', spiega: 'Disdette e mancate presentazioni: le poltrone rimaste vuote.' },
  { key: 'ogniQuantiGiorni', label: 'Chi viene più spesso', spiega: 'Cadenza media fra due visite: più è bassa, più è abituale.' },
  { key: 'giorniDaUltima', label: 'Chi manca da più tempo', spiega: 'Giorni dall’ultima visita: la lista delle telefonate da fare.' },
];

const CRESCENTE: Chiave[] = ['ogniQuantiGiorni']; // qui "meglio" vuol dire più piccolo

function scarica(righe: ClientRow[]) {
  const testa = ['Cliente', 'Telefono', 'Spesa', 'Scontrini', 'Scontrino medio', 'Prenotati', 'Visite', 'Disdette', 'Affidabilità %', 'Ogni quanti giorni', 'Ultima visita', 'Trattamento preferito'];
  const corpo = righe.map(r => [
    r.nome, r.telefono, r.spesa, r.scontrini, r.scontrinoMedio, r.prenotati, r.visite, r.disdette,
    r.affidabilita, r.ogniQuantiGiorni ?? '', r.ultimaVisita ?? '', r.trattamentoTop,
  ]);
  const csv = [testa, ...corpo].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'clienti.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function TabellaClienti({ righe, caricando }: { righe: ClientRow[]; caricando: boolean }) {
  const [criterio, setCriterio] = useState<Chiave>('spesa');
  /* La cliente su cui si è premuto: si apre l'estratto conto. */
  const [conto, setConto] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [quante, setQuante] = useState(15);

  const criterioAttivo = CRITERI.find(c => c.key === criterio)!;

  const ordinate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const filtrate = q ? righe.filter(r => r.nome.toLowerCase().includes(q)) : righe;
    const crescente = CRESCENTE.includes(criterio);
    return [...filtrate].sort((a, b) => {
      const va = a[criterio], vb = b[criterio];
      // Chi non ha il dato (es. una visita sola, quindi nessuna cadenza) va in fondo
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return crescente ? va - vb : vb - va;
    });
  }, [righe, criterio, cerca]);

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-display font-semibold text-text-primary">Classifica clienti</h3>
          <p className="text-xs text-text-secondary mt-0.5">{criterioAttivo.spiega}</p>
        </div>
        <button onClick={() => scarica(ordinate)} disabled={!ordinate.length}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-40">
          <Download className="w-3.5 h-3.5" /> Scarica CSV
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1">
          {CRITERI.map(c => (
            <button key={c.key} onClick={() => setCriterio(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                criterio === c.key ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
              }`}>
              {criterio === c.key && <ArrowUpDown className="w-3 h-3" />} {c.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca una cliente…"
            className="pl-8 pr-3 py-1.5 rounded-xl bg-bg-tertiary border border-border text-xs text-text-primary w-52 focus:outline-none focus:border-accent/50" />
        </div>
      </div>

      {caricando ? (
        <Vuoto testo="Calcolo la classifica…" />
      ) : !ordinate.length ? (
        <Vuoto testo="Nessuna cliente con attività in questo periodo." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border/60">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 px-3 font-semibold text-right">Spesa</th>
                  <th className="py-2 px-3 font-semibold text-right">Scontrino medio</th>
                  <th className="py-2 px-3 font-semibold text-right">Visite</th>
                  <th className="py-2 px-3 font-semibold text-right">Prenotati</th>
                  <th className="py-2 px-3 font-semibold text-right">Disdette</th>
                  <th className="py-2 px-3 font-semibold text-right">Ogni</th>
                  <th className="py-2 px-3 font-semibold text-right">Ultima</th>
                  <th className="py-2 pl-3 font-semibold">Preferito</th>
                </tr>
              </thead>
              <tbody>
                {ordinate.slice(0, quante).map((r, i) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-bg-hover transition-colors">
                    <td className="py-2.5 pr-3 text-text-muted tabular-nums">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      {/*
                        Premendo il nome si apre da dove viene la cifra; la
                        scheda intera resta a un tocco, con l'iconcina.

                        `type="button"` non è un vezzo: dentro a una pagina con
                        un form intorno, un bottone senza tipo fa "invia" e
                        ricarica tutto — il popup non si apre e sembra che il
                        clic non funzioni.
                      */}
                      <button type="button" onClick={() => setConto(r.id)}
                        className="text-text-primary font-medium hover:text-accent hover:underline transition-colors text-left cursor-pointer"
                        title="Vedi come è arrivata a questa cifra">
                        {r.nome}
                      </button>
                      <Link href={`/dashboard/clients/${r.id}`} title="Apri la scheda"
                        className="ml-1.5 text-text-muted hover:text-accent align-middle inline-block">
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      {r.nuova && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-success/10 text-success align-middle">nuova</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-text-primary">{eur(r.spesa)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{eur(r.scontrinoMedio)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-primary">{r.visite}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.prenotati}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums ${r.disdette > 0 ? 'text-warning' : 'text-text-muted'}`}>{r.disdette}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.ogniQuantiGiorni ? `${r.ogniQuantiGiorni} gg` : '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                      {r.giorniDaUltima === null ? '—' : r.giorniDaUltima === 0 ? 'oggi' : `${r.giorniDaUltima} gg fa`}
                    </td>
                    <td className="py-2.5 pl-3 text-text-secondary truncate max-w-[180px]">{r.trattamentoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ordinate.length > quante && (
            <button onClick={() => setQuante(q => q + 25)}
              className="w-full py-2 rounded-xl bg-bg-tertiary text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
              Mostra altre 25 · {ordinate.length - quante} rimanenti
            </button>
          )}
        </>
      )}
      {conto && <DettaglioCliente clientId={conto} onClose={() => setConto(null)} />}
    </div>
  );
}