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
import { createPortal } from 'react-dom';
import { Banknote, CreditCard, ChevronLeft, ChevronRight, Loader2, Wallet, Smartphone, X, Gift } from 'lucide-react';
import { getIncomeSummary, getTransactionsByDate, type IncomeSummary as Summary, type TransactionRecord } from '@/app/actions/pos';
import { formatCurrency } from '@/lib/helpers';
import { todayRome } from '@/lib/date';
import { quoteMetodo } from '@/lib/pagamenti';

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

/** `onPeriodChange` avvisa la pagina cassa del periodo scelto: l'elenco delle
 *  transazioni qui sotto deve seguire lo stesso intervallo, non solo oggi. */
export default function IncomeSummary({ onPeriodChange }: { onPeriodChange?: (from: string, to: string) => void } = {}) {
  const [mode, setMode] = useState<Mode>('day');
  const [from, setFrom] = useState(() => todayRome());
  const [to, setTo] = useState(() => todayRome());
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  // Dettaglio di una giornata: si apre cliccando la riga della data
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayTxs, setDayTxs] = useState<TransactionRecord[] | null>(null);

  const apriGiorno = useCallback((giorno: string) => {
    setOpenDay(giorno);
    setDayTxs(null);
    getTransactionsByDate(giorno).then(setDayTxs).catch(() => setDayTxs([]));
  }, []);

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
    onPeriodChange?.(from, to);
    // onPeriodChange arriva dal padre e non deve rilanciare la fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

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
                <tr key={d.date} onClick={() => apriGiorno(d.date)} title="Apri il dettaglio della giornata"
                  className="border-b border-border/30 hover:bg-bg-hover transition-colors cursor-pointer">
                  <td className="px-5 py-2.5">
                    <span className="text-text-primary underline decoration-dotted decoration-text-muted/40 underline-offset-4">{GIORNI[g.getDay()]} {g.getDate()}/{g.getMonth() + 1}</span>
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

      {openDay && (
        <DayDetail date={openDay} txs={dayTxs} onClose={() => { setOpenDay(null); setDayTxs(null); }} />
      )}
    </div>
  );
}

/* ========== DETTAGLIO DI UNA GIORNATA ========== */

/** A quale colonna appartiene la vendita: serve anche nel dettaglio, non solo nei totali. */
function metodoLabel(method: string): { testo: string; classe: string } {
  const m = String(method || '');
  if (/regalo/i.test(m)) return { testo: 'Regalo', classe: 'text-accent' };
  if (/misto/i.test(m)) return { testo: m, classe: 'text-warning' };
  if (/contant|cash/i.test(m)) return { testo: 'Contanti', classe: 'text-success' };
  if (/carta|pos|bancomat/i.test(m)) return { testo: 'POS / Carta', classe: 'text-accent' };
  return { testo: m || '—', classe: 'text-text-muted' };
}

function DayDetail({ date, txs, onClose }: { date: string; txs: TransactionRecord[] | null; onClose: () => void }) {
  const g = parse(date);
  const titolo = g.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Totali ricalcolati sulle righe mostrate, così quello che si legge torna con l'elenco
  const tot = (txs ?? []).reduce((acc, t) => {
    // Il misto si divide fra le due colonne: la lettura sta in un posto solo,
    // cosi' cassa, scontrini e report non raccontano numeri diversi.
    const q = quoteMetodo(String(t.method || ''), t.total);
    acc.contanti += q.contanti;
    acc.carta += q.carta;
    acc.altro += q.altro;
    acc.totale += t.total;
    return acc;
  }, { contanti: 0, carta: 0, altro: 0, totale: 0 });

  // Fuori dalla pagina (portale su body): le animazioni della schermata cassa
  // creano un contesto che sballerebbe il posizionamento fisso del popup.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-display font-semibold text-text-primary capitalize">{titolo}</h3>
            <p className="text-xs text-text-muted">
              {txs === null ? 'carico…' : `${txs.filter(t => t.total > 0).length} vendite`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 flex-shrink-0">
          <div className="bg-bg-secondary px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Contanti</p>
            <p className="text-sm font-bold text-text-primary">{formatCurrency(tot.contanti)}</p>
          </div>
          <div className="bg-bg-secondary px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">POS / Carta</p>
            <p className="text-sm font-bold text-text-primary">{formatCurrency(tot.carta)}</p>
          </div>
          <div className="bg-bg-secondary px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Altro</p>
            <p className="text-sm font-bold text-text-primary">{formatCurrency(tot.altro)}</p>
          </div>
          <div className="bg-bg-secondary px-4 py-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Totale</p>
            <p className="text-sm font-bold text-accent">{formatCurrency(tot.totale)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {txs === null && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> carico il dettaglio…</p>
          )}
          {txs?.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">Nessuna vendita in questa giornata</p>
          )}
          {txs?.map(t => {
            const m = metodoLabel(t.method);
            const regalo = /regalo/i.test(t.method || '');
            const reso = t.total < 0;
            return (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-hover transition-colors">
                <span className="text-[11px] tabular-nums text-text-muted w-11 flex-shrink-0">{t.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{t.client || 'Cliente occasionale'}</p>
                  <p className="text-xs text-text-secondary truncate">{t.items}</p>
                  {t.operator && <p className="text-[10px] text-text-muted truncate">{t.operator}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${reso ? 'text-error' : regalo ? 'text-accent' : 'text-text-primary'}`}>
                    {regalo ? <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Regalo</span> : formatCurrency(t.total)}
                  </p>
                  <p className={`text-[10px] ${m.classe}`}>{regalo ? 'nessun incasso' : m.testo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
