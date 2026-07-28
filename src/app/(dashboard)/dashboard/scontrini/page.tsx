'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Search, RefreshCw, Printer, Ban, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { getScontrini, annullaScontrino, riemettiScontrino, ScontrinoRecord, ScontrinoFilter } from '@/app/actions/scontrini';
import { printThermalReceipt } from '@/lib/printReceipt';
import { formatCurrency } from '@/lib/helpers';

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const FILTERS: { id: ScontrinoFilter; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'fiscal', label: 'Fiscali' },
  { id: 'missing', label: 'Non emessi' },
  { id: 'refund', label: 'Resi' },
];

// Etichetta di stato dello scontrino fiscale, allineata ai valori scritti da actions/pos.ts.
function StatusBadge({ s }: { s: ScontrinoRecord }) {
  if (s.total < 0) return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/15 text-warning">Reso</span>;
  if (s.c95Status === 'voided') return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-text-muted/15 text-text-muted">Annullato</span>;
  if (s.c95Emitted) return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-success/15 text-success">Fiscale · C95 AdE</span>;
  if (s.c95Status === 'uncertain') return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-warning/15 text-warning">Esito incerto</span>;
  if (s.c95Status) return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-error/15 text-error">Non emesso</span>;
  return <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-bg-tertiary text-text-muted">Senza scontrino</span>;
}

export default function ScontriniPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ScontrinoFilter>('all');
  const [rows, setRows] = useState<ScontrinoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getScontrini({ from, to, query, filter }));
    } catch {
      setMessage({ kind: 'err', text: 'Caricamento archivio fallito' });
    }
    setLoading(false);
  }, [from, to, query, filter]);

  useEffect(() => { load(); }, [load]);

  const doAnnulla = async (s: ScontrinoRecord) => {
    if (!window.confirm(`Annullare lo scontrino fiscale ${s.c95Progressivo || s.c95IdScontrino} di ${formatCurrency(s.total)}?\n\nL'annullo viene trasmesso all'Agenzia delle Entrate e non è reversibile.`)) return;
    setBusyId(s.id);
    const res = await annullaScontrino(s.id);
    setBusyId(null);
    setMessage(res.ok ? { kind: 'ok', text: 'Scontrino annullato su AdE' } : { kind: 'err', text: res.error || 'Annullo fallito' });
    if (res.ok) load();
  };

  const doRiemetti = async (s: ScontrinoRecord) => {
    if (!window.confirm(`Riemettere lo scontrino fiscale di ${formatCurrency(s.total)}?\n\nVerifica prima su C95 che il documento non esista già, per non emetterlo due volte.`)) return;
    setBusyId(s.id);
    const res = await riemettiScontrino(s.id);
    setBusyId(null);
    setMessage(res.ok ? { kind: 'ok', text: 'Scontrino emesso' } : { kind: 'err', text: res.error || 'Emissione fallita' });
    if (res.ok) load();
  };

  const ristampa = (s: ScontrinoRecord) => {
    const [y, m, d] = s.date.split('-');
    printThermalReceipt({
      lines: s.items.split(', ').filter(Boolean).map((name) => ({ name })),
      total: s.total,
      method: s.method,
      client: s.client,
      operator: s.operator,
      progressivo: s.c95Progressivo,
      idtrx: s.c95Idtrx,
      dateLabel: `${d}/${m}/${y} ${s.time}`,
    });
  };

  const emessi = rows.filter(r => r.c95Emitted).length;
  const mancanti = rows.filter(r => r.total > 0 && !r.c95Emitted && r.c95Status !== 'voided').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
            <Receipt className="w-6 h-6 text-accent" /> Scontrini Fiscali
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">Archivio dei documenti commerciali C95 — annullo, riemissione e ristampa</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
        </button>
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary" />
        <span className="text-text-muted">→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary" />
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca per numero documento, transazione o cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder:text-text-muted" />
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filter === f.id ? 'bg-accent/15 text-accent' : 'bg-bg-secondary border border-border text-text-secondary hover:bg-bg-hover'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-sm border ${message.kind === 'ok' ? 'bg-success/10 border-success/20 text-success' : 'bg-error/10 border-error/20 text-error'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="px-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-xs text-text-secondary">
        Nel periodo: <strong className="text-text-primary">{rows.length}</strong> movimenti ·{' '}
        <strong className="text-success">{emessi}</strong> con scontrino fiscale ·{' '}
        {mancanti > 0
          ? <strong className="text-error">{mancanti} senza scontrino fiscale</strong>
          : <span className="text-success">nessuna vendita senza scontrino</span>}
      </div>

      {/* Elenco */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="divide-y divide-border/30">
          {rows.map(s => {
            const [y, m, d] = s.date.split('-');
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors flex-wrap">
                <div className="w-28 flex-shrink-0">
                  <StatusBadge s={s} />
                  <p className="text-[11px] text-text-muted mt-1">{d}/{m}/{y} {s.time}</p>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium text-text-primary">{s.client || 'Cliente Occasionale'}</p>
                  <p className="text-xs text-text-secondary truncate">{s.items}</p>
                  {s.c95Progressivo && (
                    <p className="text-[11px] text-text-muted font-mono mt-0.5">
                      {s.c95Progressivo}{s.c95Idtrx ? ` · idtrx ${s.c95Idtrx}` : ''}
                    </p>
                  )}
                  {!s.c95Emitted && s.c95Error && (
                    <p className="text-[11px] text-error mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {s.c95Error}
                    </p>
                  )}
                </div>
                <div className="text-right w-28">
                  <p className={`text-sm font-semibold ${s.total < 0 ? 'text-error' : 'text-text-primary'}`}>{formatCurrency(s.total)}</p>
                  <p className="text-[11px] text-text-muted">{s.method}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => ristampa(s)} title="Ristampa il tagliando cartaceo"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-primary hover:bg-bg-hover">
                    <Printer className="w-3.5 h-3.5" /> Ristampa
                  </button>
                  {s.c95Emitted && s.c95Status !== 'voided' && (
                    <button onClick={() => doAnnulla(s)} disabled={busyId === s.id} title="Annulla il documento su Agenzia delle Entrate"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-error/30 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50">
                      {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Annulla
                    </button>
                  )}
                  {s.total > 0 && !s.c95Emitted && s.c95Status !== 'voided' && (
                    <button onClick={() => doRiemetti(s)} disabled={busyId === s.id} title="Emetti ora lo scontrino fiscale mancante"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50">
                      {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Emetti
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && !loading && (
            <div className="text-center py-12"><p className="text-text-muted">Nessuno scontrino nel periodo selezionato</p></div>
          )}
          {loading && rows.length === 0 && (
            <div className="text-center py-12 text-text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Caricamento...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
