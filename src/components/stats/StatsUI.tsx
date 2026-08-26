'use client';

/**
 * Mattoncini condivisi delle Statistiche.
 *
 * Prima era tutto in una pagina sola: sessanta schede una dietro l'altra, senza
 * un ordine leggibile. Ora la sezione è divisa per argomento e ogni pagina usa
 * questi pezzi — schede KPI, riquadri, grafici e classifiche — così le pagine
 * restano corte e si assomigliano tutte.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Euro, Users, Calendar, Package, Boxes, UserCog, Gift, Info, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { Kpi } from '@/app/actions/businessStats';

export const TABS = [
  { href: '/dashboard/statistiche', label: 'Panoramica', icon: LayoutDashboard },
  { href: '/dashboard/statistiche/incassi', label: 'Incassi', icon: Euro },
  { href: '/dashboard/statistiche/clienti', label: 'Clienti', icon: Users },
  { href: '/dashboard/statistiche/agenda', label: 'Agenda', icon: Calendar },
  { href: '/dashboard/statistiche/servizi', label: 'Servizi e staff', icon: UserCog },
  { href: '/dashboard/statistiche/pacchetti', label: 'Pacchetti', icon: Package },
  { href: '/dashboard/statistiche/magazzino', label: 'Magazzino', icon: Boxes },
  { href: '/dashboard/statistiche/marketing', label: 'Marketing', icon: Gift },
];

export function StatsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto hide-scrollbar p-1 rounded-2xl bg-bg-secondary border border-border">
      {TABS.map(t => {
        const attiva = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              attiva ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'
            }`}>
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Intestazione uguale su tutte le pagine della sezione. */
export function StatsHeader({ titolo, sottotitolo }: { titolo: string; sottotitolo: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">{titolo}</h2>
        <p className="text-sm text-text-secondary">{sottotitolo}</p>
      </div>
      <StatsTabs />
    </div>
  );
}

const TONE: Record<string, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-error',
  neutral: 'text-text-primary',
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative bg-bg-secondary border border-border rounded-2xl p-4 hover:border-accent/40 transition-all"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{kpi.label}</p>
        <button type="button" onClick={() => setOpen(o => !o)} aria-label="Cosa significa"
          className="text-text-muted hover:text-accent transition-colors flex-shrink-0">
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className={`text-2xl font-display font-bold mt-1.5 ${TONE[kpi.tone || 'neutral']}`}>{kpi.value}</p>
      {kpi.sub && <p className="text-xs text-text-muted mt-0.5">{kpi.sub}</p>}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 p-3 rounded-xl bg-bg-primary border border-border shadow-2xl">
          <p className="text-xs text-text-secondary leading-relaxed">{kpi.hint}</p>
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {kpis.map(k => <KpiCard key={k.key} kpi={k} />)}
    </div>
  );
}

/** Riquadro con titolo e spiegazione: ogni grafico sta dentro uno di questi. */
export function Card({ titolo, spiega, children, className = '' }: {
  titolo: string; spiega?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-bg-secondary border border-border rounded-2xl p-5 ${className}`}>
      <h3 className="text-base font-display font-semibold text-text-primary">{titolo}</h3>
      {spiega && <p className="text-xs text-text-secondary mt-0.5 mb-4 leading-relaxed">{spiega}</p>}
      {!spiega && <div className="mb-4" />}
      {children}
    </div>
  );
}

export function Caricamento({ testo = 'Calcolo dei dati…' }: { testo?: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-text-muted">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {testo}
    </div>
  );
}

export function Vuoto({ testo }: { testo: string }) {
  return <p className="py-10 text-center text-sm text-text-muted">{testo}</p>;
}

export const eur = (n: number) =>
  `${(Math.round(n * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

// ============================================================
// GRAFICI
// Palette e assi identici ovunque: cambiare stile qui li cambia tutti.
// ============================================================

export const COLORI = ['#a855f7', '#22c55e', '#f59e0b', '#38bdf8', '#f43f5e', '#14b8a6', '#eab308', '#8b5cf6'];

const ASSE = { stroke: 'var(--color-text-muted)', fontSize: 11 };

function TooltipBox({ active, payload, label, formato }: {
  active?: boolean;
  payload?: { color?: string; name?: string; value?: number }[];
  label?: string;
  formato: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-primary border border-border rounded-xl px-3 py-2 shadow-2xl">
      {label && <p className="text-xs font-semibold text-text-primary mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[11px] text-text-secondary">{p.name}:</span>
          <span className="text-[11px] font-bold text-text-primary">{formato(Number(p.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

type Serie = { key: string; nome: string; colore?: string };

/** Andamento nel tempo: una o più serie sullo stesso asse. */
export function GraficoAndamento({ dati, x, serie, formato = eur, tipo = 'area', altezza = 260 }: {
  dati: readonly object[];
  x: string;
  serie: Serie[];
  formato?: (n: number) => string;
  tipo?: 'area' | 'line' | 'bar';
  altezza?: number;
}) {
  if (!dati.length) return <Vuoto testo="Non ci sono ancora abbastanza dati." />;
  const comuni = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
      <XAxis dataKey={x} tick={ASSE} axisLine={false} tickLine={false} />
      <YAxis tick={ASSE} axisLine={false} tickLine={false} width={52}
        tickFormatter={(v: number) => (formato === eur ? `${Math.round(v / 1000) >= 1 ? `${Math.round(v / 100) / 10}k` : v}` : String(v))} />
      <Tooltip content={<TooltipBox formato={formato} />} cursor={{ fill: 'var(--color-bg-hover)', opacity: 0.4 }} />
      {serie.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );
  return (
    <ResponsiveContainer width="100%" height={altezza}>
      {tipo === 'bar' ? (
        <BarChart data={dati} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          {comuni}
          {serie.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.nome} fill={s.colore || COLORI[i % COLORI.length]} radius={[6, 6, 0, 0]} />
          ))}
        </BarChart>
      ) : tipo === 'line' ? (
        <LineChart data={dati} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          {comuni}
          {serie.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.nome}
              stroke={s.colore || COLORI[i % COLORI.length]} strokeWidth={2.5} dot={false} />
          ))}
        </LineChart>
      ) : (
        <AreaChart data={dati} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            {serie.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.colore || COLORI[i % COLORI.length]} stopOpacity={0.35} />
                <stop offset="95%" stopColor={s.colore || COLORI[i % COLORI.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {comuni}
          {serie.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.nome}
              stroke={s.colore || COLORI[i % COLORI.length]} strokeWidth={2.5} fill={`url(#g-${s.key})`} />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}

/** Torta con legenda: per le composizioni (metodi di pagamento, categorie…). */
export function GraficoTorta({ dati, formato = eur, altezza = 260 }: {
  dati: { nome: string; valore: number }[];
  formato?: (n: number) => string;
  altezza?: number;
}) {
  const utili = dati.filter(d => d.valore > 0);
  if (!utili.length) return <Vuoto testo="Non ci sono ancora abbastanza dati." />;
  return (
    <ResponsiveContainer width="100%" height={altezza}>
      <PieChart>
        <Pie data={utili} dataKey="valore" nameKey="nome" innerRadius="52%" outerRadius="82%" paddingAngle={2}>
          {utili.map((_, i) => <Cell key={i} fill={COLORI[i % COLORI.length]} stroke="none" />)}
        </Pie>
        <Tooltip content={<TooltipBox formato={formato} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Imbuto: le tappe numerate di un percorso (contatto → cliente pagante).
 * Prende i KPI la cui etichetta inizia con "1·", "2·"… e li mette in fila,
 * con la barra proporzionata al primo gradino: così si vede a occhio dove si
 * perde più gente.
 */
export function Imbuto({ kpis }: { kpis: Kpi[] }) {
  const tappe = kpis
    .filter(k => /^\d+·/.test(k.label))
    .map(k => ({ label: k.label.replace(/^\d+·\s*/, ''), valore: Number(String(k.value).replace(/\D/g, '')) || 0, sub: k.sub }));
  if (tappe.length < 2) return null;
  const partenza = Math.max(tappe[0].valore, 1);
  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-3">
      <h3 className="text-base font-display font-semibold text-text-primary">Il percorso, gradino per gradino</h3>
      <p className="text-xs text-text-secondary -mt-1">
        Quanti restano a ogni passaggio. Il gradino dove crolla la barra è quello su cui conviene lavorare.
      </p>
      {tappe.map((t, i) => {
        const perc = (t.valore / partenza) * 100;
        const persi = i > 0 ? tappe[i - 1].valore - t.valore : 0;
        return (
          <div key={t.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-text-primary">{t.label}</span>
              <span className="text-sm font-semibold text-text-primary">
                {t.valore}
                <span className="text-[11px] font-normal text-text-muted ml-1.5">{Math.round(perc)}%</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-bg-tertiary mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(perc, 1)}%`, backgroundColor: COLORI[i % COLORI.length] }} />
            </div>
            {i > 0 && persi > 0 && (
              <p className="text-[11px] text-text-muted mt-0.5">−{persi} rispetto al passo prima</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Classifica a barre orizzontali: si legge meglio di un grafico quando i nomi sono lunghi. */
export function Classifica({ righe, formato = eur, etichettaExtra, onScegli }: {
  righe: { nome: string; valore: number; extra?: number }[];
  formato?: (n: number) => string;
  etichettaExtra?: (extra: number) => string;
  /** Se c'è, ogni riga diventa premibile: serve ad aprire il dettaglio. */
  onScegli?: (nome: string) => void;
}) {
  if (!righe.length) return <Vuoto testo="Nessun dato nel periodo." />;
  const max = Math.max(...righe.map(r => r.valore), 1);
  return (
    <div className="space-y-2">
      {righe.map((r, i) => (
        <div key={r.nome + i}
          onClick={onScegli ? () => onScegli(r.nome) : undefined}
          title={onScegli ? `Vedi quando è stato fatto: date, clienti e operatrici` : undefined}
          className={`flex items-center gap-3 ${onScegli ? 'cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-bg-hover transition-colors' : ''}`}>
          <span className="text-[11px] text-text-muted w-5 text-right flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-text-primary truncate">{r.nome}</span>
              <span className="text-sm font-semibold text-text-primary flex-shrink-0">
                {formato(r.valore)}
                {r.extra !== undefined && etichettaExtra && (
                  <span className="text-[11px] font-normal text-text-muted ml-1.5">{etichettaExtra(r.extra)}</span>
                )}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-tertiary mt-1 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.valore / max) * 100}%`, backgroundColor: COLORI[i % COLORI.length] }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
