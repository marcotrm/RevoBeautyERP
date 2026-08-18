'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, Moon, Lock, CalendarDays } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAppointments } from '@/app/actions/agenda';
import { getBlocks } from '@/app/actions/blocks';
import { getOperators } from '@/app/actions/operators';
import type { Appointment, AgendaBlock, Operator } from '@/types';
import { getInitials } from '@/lib/helpers';

const DAYS_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toMin(t: string) { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confermato', cls: 'bg-blue-500/15 text-blue-400' },
  in_cabin: { label: 'In cabina', cls: 'bg-pink-500/15 text-pink-400' },
  in_progress: { label: 'In corso', cls: 'bg-pink-500/15 text-pink-400' },
  completed: { label: 'Completato', cls: 'bg-green-500/15 text-green-400' },
  no_show: { label: 'No-show', cls: 'bg-red-500/15 text-red-400' },
  cancelled: { label: 'Annullato', cls: 'bg-neutral-500/15 text-neutral-400' },
};

export default function AgendaMobilePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [date, setDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [opFilter, setOpFilter] = useState<string>('all');

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
    setIsHydrated(useAuthStore.persist.hasHydrated());
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.push('/login');
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    Promise.all([getAppointments(), getBlocks(), getOperators()])
      .then(([a, b, o]) => { setAppointments(a); setBlocks(b); setOperators(o); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dateStr = fmtDate(date);
  const opColor = useMemo(() => { const m: Record<string, string> = {}; operators.forEach(o => { m[o.id] = o.color; }); return m; }, [operators]);

  const dayApts = useMemo(() =>
    appointments
      .filter(a => a.date === dateStr && (opFilter === 'all' || a.operatorId === opFilter))
      .sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
    [appointments, dateStr, opFilter]);

  const dayBlocks = useMemo(() =>
    blocks.filter(b => b.date === dateStr && (opFilter === 'all' || b.operatorId === opFilter)),
    [blocks, dateStr, opFilter]);

  // Fondi appuntamenti + blocchi in un'unica timeline ordinata
  const timeline = useMemo(() => {
    const items = [
      ...dayApts.map(a => ({ kind: 'apt' as const, start: toMin(a.startTime), apt: a })),
      ...dayBlocks.map(b => ({ kind: 'block' as const, start: toMin(b.startTime), block: b })),
    ];
    return items.sort((x, y) => x.start - y.start);
  }, [dayApts, dayBlocks]);

  const revenue = dayApts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').reduce((s, a) => s + a.price, 0);
  const shift = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d); };
  const opName = (id: string) => { const o = operators.find(x => x.id === id); return o ? `${o.firstName} ${o.lastName}` : ''; };

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-display font-bold">Agenda</h1>
            <span className="ml-auto text-xs text-text-muted">Incasso stimato: <strong className="text-accent">€ {revenue.toLocaleString('it-IT')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="p-2 rounded-xl bg-bg-tertiary border border-border"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setDate(new Date())} className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-xs font-medium">Oggi</button>
            <button onClick={() => shift(1)} className="p-2 rounded-xl bg-bg-tertiary border border-border"><ChevronRight className="w-4 h-4" /></button>
            <div className="flex-1 text-right">
              <p className="text-sm font-semibold capitalize">{DAYS_IT[date.getDay()]} {date.getDate()} {MONTHS_IT[date.getMonth()]}</p>
              <p className="text-[11px] text-text-muted">{dayApts.length} appuntamenti</p>
            </div>
          </div>
        </div>
        {/* Filtro operatrice */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          <button onClick={() => setOpFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${opFilter === 'all' ? 'bg-accent text-white border-accent' : 'bg-bg-tertiary text-text-secondary border-border'}`}>Tutte</button>
          {operators.map(o => (
            <button key={o.id} onClick={() => setOpFilter(o.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${opFilter === o.id ? 'text-white border-transparent' : 'bg-bg-tertiary text-text-secondary border-border'}`}
              style={opFilter === o.id ? { backgroundColor: o.color } : undefined}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }} /> {o.firstName}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4 space-y-2.5 max-w-lg mx-auto">
        {loading ? (
          <p className="text-center text-text-muted py-16 text-sm">Caricamento...</p>
        ) : timeline.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary font-medium">Nessun appuntamento</p>
            <p className="text-xs text-text-muted mt-1">Questo giorno è libero</p>
          </div>
        ) : timeline.map((it, i) => it.kind === 'block' ? (
          <div key={`b${i}`} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-400/25"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.12) 0, rgba(100,116,139,0.12) 8px, transparent 8px, transparent 16px)' }}>
            <div className="text-center min-w-[52px]">
              <p className="text-sm font-bold text-slate-400">{it.block.startTime}</p>
              <p className="text-[10px] text-slate-500">{it.block.endTime}</p>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Lock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-300">{it.block.reason || 'Bloccato'}</p>
                <p className="text-[11px] text-text-muted">{opName(it.block.operatorId)}</p>
              </div>
            </div>
          </div>
        ) : (() => {
          const a = it.apt;
          const c = opColor[a.operatorId] || a.color;
          const st = STATUS_LABEL[a.status] || STATUS_LABEL.confirmed;
          return (
            <div key={a.id} className="flex gap-3 p-3 rounded-2xl bg-bg-secondary border border-border" style={{ borderLeft: `4px solid ${c}` }}>
              <div className="text-center min-w-[52px]">
                <p className="text-sm font-bold">{a.startTime}</p>
                <p className="text-[10px] text-text-muted">{a.endTime}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{a.clientName}</p>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-xs text-text-secondary truncate mt-0.5">{a.treatmentName}</p>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: c }}>{getInitials(opName(a.operatorId).split(' ')[0] || '', opName(a.operatorId).split(' ')[1] || '')}</span>
                    {opName(a.operatorId)}
                  </span>
                  {a.price > 0 && <span className="text-xs font-semibold">{a.price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>}
                </div>
              </div>
            </div>
          );
        })())}

        {/* Operatrici a riposo oggi */}
        {!loading && opFilter === 'all' && (() => {
          const dow = date.getDay() === 0 ? 7 : date.getDay(); // 1-7
          const resting = operators.filter(o => {
            const s = (o.schedule as unknown as Record<string, { isWorking?: boolean }> | null)?.[String(dow)];
            return s ? s.isWorking === false : dow === 7; // domenica tutti a riposo
          });
          if (resting.length === 0) return null;
          return (
            <div className="mt-4 flex items-center gap-2 flex-wrap px-1">
              <Moon className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-text-muted">A riposo:</span>
              {resting.map(o => <span key={o.id} className="text-xs font-medium text-amber-500">{o.firstName}</span>)}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
