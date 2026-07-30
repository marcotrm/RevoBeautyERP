'use client';

/**
 * Riepilogo incassi per periodo.
 *
 * Le schede in alto dicono solo com'è andata oggi: qui si sceglie giorno,
 * settimana, mese o un intervallo qualsiasi e si vede, per ogni data, quanto è
 * entrato in contanti e quanto sul POS. Serve per le chiusure e per rispondere
 * a "quanto abbiamo fatto la settimana scorsa?" senza aprire i report.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, ChevronLeft, ChevronRight, Loader2, Wallet, Smartphone } from 'lucide-react';
import { getIncomeSummary, type IncomeSummary as Summary } from '@/app/actions/pos';
import { formatCurrency } from '@/lib/helpers';
import { todayRome } from '@/lib/date';

type Mode = 'day' | 'week' | 'month' | 'range';

const MODES: { key: Mode; label: string }[] = [
  { key: 'day', label: 'Giorno' },
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'range', label: 'Intervallo' },
];

const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function parse(d: string): Date {
  const [y, m, g] = d.split('-').map(Number);
  return new Date(y, m - 1, g);
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Inizio e fine del periodo che contiene `giorno`, secondo la modalità scelta. */
function periodo(mode: Mode, giorno: string): { from: string; to: string } {
  const d = parse(giorno);
  if (mode === 'week') {
    const lun = addDays(d, -((d.getDay() + 6) % 7)); // la settimana parte da lunedì
    return { from: fmt(lun), to: fmt(addDays(lun, 6)) };
  }
  if (mode === 'month') {
    return {
      from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  return { from: giorno, to: giorno };
}

function etichettaPeriodo(from: string, to: string): string {
  const a = parse(from), b = parse(to);
  const g = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  return from === to ? g(a) : `${g(a)} → ${g(b)}`;
}

export default function IncomeSummary() {
  const [mode, setMode] = useState<Mode>('day');
  const [from, setFrom] = useState(() => todayRome());
  const [to, setTo] = useState(() => todayRome());
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const applica = useCallback((m: Mode, giorno: string) => {
    setMode(m);
    const p = periodo(m, giorno);
    setFrom(p.from);
    setTo(p.to);
  }, []);

  // Sposta il periodo avanti/indietro tenendo la stessa lunghezza
  const scorri = (verso: number) => {
    const a = parse(from), b = parse(to);
    if (mode === 'month') {
      const nuovo = new Date(a.getFullYear(), a.getMonth() + verso, 1);
      const p = periodo('month', fmt(nuovo));
      setFrom(p.from); setTo(p.to);
      return;
    }
    const giorni = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    setFrom(fmt(addDays(a, verso * giorni)));
    setTo(fmt(addDays(b, verso * giorni)));
  };

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    getIncomeSummary(from, to)
      .then(r => { if (vivo) setData(r); })
      .catch(() => { if (vivo) setData(null); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [from, to]);

  const giorniPeriodo = useMemo(
    () => Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000) + 1,
    [from, to]
  );

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-display font-semibold text-text-primary">Riepilogo Incassi</h3>
          <p className="text-xs text-text-muted capitalize">{etichettaPeriodo(from, to)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {MODES.map(m => (
              <button key={m.key} onClick={() => applica(m.key, m.key === 'range' ? from : todayRome())}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === m.key ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => scorri(-1)} title="Periodo precedente"
              className="p-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => scorri(1)} title="Periodo successivo"
              className="p-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Date libere: in "Intervallo" si scelgono a mano, nelle altre modalità
          restano modificabili e il periodo si adatta da solo */}
      <div className="px-5 py-3 border-b border-border/60 flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Dal
          <input type="date" value={from} max={to}
            onChange={e => { if (!e.target.value) return; setMode('range'); setFrom(e.target.value); }}
            className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Al
          <input type="date" value={to} min={from}
            onChange={e => { if (!e.target.value) return; setMode('range'); setTo(e.target.value); }}
            className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
        </label>
        <button onClick={() => applica('day', todayRome())}
          className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
          Oggi
        </button>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
      </div>

      {/* Totali del periodo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/60">
        <div className="bg-bg-secondary p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Banknote className="w-3.5 h-3.5 text-success" /> Contanti</p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{formatCurrency(data?.contanti ?? 0)}</p>
        </div>
        <div className="bg-bg-secondary p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-secondary"><CreditCard className="w-3.5 h-3.5 text-accent" /> POS / Carta</p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{formatCurrency(data?.carta ?? 0)}</p>
        </div>
        <div className="bg-bg-secondary p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-secondary" title="Satispay, bonifici, buoni regalo">
            <Smartphone className="w-3.5 h-3.5 text-warning" /> Altro
          </p>
          <p className="text-xl font-display font-bold text-text-primary mt-1">{formatCurrency(data?.altro ?? 0)}</p>
        </div>
        <div className="bg-bg-secondary p-4">
          <p className="flex items-center gap-1.5 text-xs text-text-secondary"><Wallet className="w-3.5 h-3.5 text-text-muted" /> Totale</p>
          <p className="text-xl font-display font-bold text-accent mt-1">{formatCurrency(data?.totale ?? 0)}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {data?.vendite ?? 0} vendite · {giorniPeriodo} {giorniPeriodo === 1 ? 'giorno' : 'giorni'}
          </p>
        </div>
      </div>

      {/* Dettaglio per data */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border/60">
              <th className="px-5 py-2 font-semibold">Data</th>
              <th className="px-3 py-2 font-semibold text-right">Contanti</th>
              <th className="px-3 py-2 font-semibold text-right">POS / Carta</th>
              <th className="px-3 py-2 font-semibold text-right">Altro</th>
              <th className="px-5 py-2 font-semibold text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {(data?.days ?? []).map(d => {
              const g = parse(d.date);
              return (
                <tr key={d.date} className="border-b border-border/30 hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-2.5">
                    <span className="text-text-primary">{GIORNI[g.getDay()]} {g.getDate()}/{g.getMonth() + 1}</span>
                    <span className="text-[10px] text-text-muted ml-2">{d.vendite} vend.</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">{formatCurrency(d.contanti)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">{formatCurrency(d.carta)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-text-muted">{formatCurrency(d.altro)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-text-primary">{formatCurrency(d.totale)}</td>
                </tr>
              );
            })}
            {!loading && (data?.days.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-text-muted text-sm">Nessun incasso in questo periodo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
