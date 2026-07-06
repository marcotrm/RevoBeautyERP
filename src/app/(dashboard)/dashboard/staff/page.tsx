'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Plus, Euro, X, CheckCircle, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useTimeClockStore } from '@/stores/useTimeClockStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { getInitials } from '@/lib/helpers';
import { Operator, TreatmentCategory } from '@/types';

const SPECIALIZATIONS: { value: TreatmentCategory; label: string }[] = [
  { value: 'facial', label: 'Viso' }, { value: 'body', label: 'Corpo' },
  { value: 'laser', label: 'Laser' }, { value: 'massage', label: 'Massaggi' },
  { value: 'nails', label: 'Unghie' }, { value: 'waxing', label: 'Depilazione' },
  { value: 'consultation', label: 'Consulenze' }, { value: 'makeup', label: 'Trucco' },
];
const COLORS = ['#A855F7','#EC4899','#F59E0B','#22C55E','#3B82F6','#EF4444','#14B8A6','#6366F1','#F97316','#8B5CF6'];
const specLabel = (s: string) => SPECIALIZATIONS.find(sp => sp.value === s)?.label || s;

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

interface ShiftEntry {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

type WeekShifts = Record<string, Record<number, ShiftEntry>>; // operatorId -> dayIndex -> shift

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtDateShort(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtWeekLabel(monday: Date) {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 5);
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return `${monday.getDate()} - ${sun.getDate()} ${months[sun.getMonth()]} ${sun.getFullYear()}`;
}

function buildDefaultShifts(operators: Operator[]): WeekShifts {
  const shifts: WeekShifts = {};
  operators.forEach(op => {
    shifts[op.id] = {};
    for (let d = 0; d < 6; d++) {
      if (op.schedule) {
        const dayKey = (d + 1) as 1|2|3|4|5|6;
        const s = op.schedule[dayKey];
        if (s) { shifts[op.id][d] = { isWorking: s.isWorking, startTime: s.startTime || '09:00', endTime: s.endTime || '18:00' }; continue; }
      }
      // defaults: Sat off, rest working
      shifts[op.id][d] = d === 5 ? { isWorking: false, startTime: '', endTime: '' } : { isWorking: true, startTime: '09:00', endTime: '18:00' };
    }
  });
  return shifts;
}


/* ========== helpers ========== */
function calcMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
function shiftTotalMinutes(s: ShiftEntry): number {
  if (!s.isWorking) return 0;
  let total = calcMinutes(s.startTime, s.endTime);
  if (s.breakStart && s.breakEnd) total -= calcMinutes(s.breakStart, s.breakEnd);
  return Math.max(0, total);
}

/* ========== SHIFT EDIT MODAL ========== */
function ShiftEditModal({ operator, day, dayDate, shift, onClose, onSave }: {
  operator: Operator; day: string; dayDate: string; shift: ShiftEntry;
  onClose: () => void; onSave: (s: ShiftEntry) => void;
}) {
  const [isWorking, setIsWorking] = useState(shift.isWorking);
  const [startTime, setStartTime] = useState(shift.startTime || '09:00');
  const [endTime, setEndTime] = useState(shift.endTime || '18:00');
  const [hasBreak, setHasBreak] = useState(!!(shift.breakStart && shift.breakEnd));
  const [breakStart, setBreakStart] = useState(shift.breakStart || '13:00');
  const [breakEnd, setBreakEnd] = useState(shift.breakEnd || '14:00');

  const totalMin = isWorking ? calcMinutes(startTime, endTime) - (hasBreak ? calcMinutes(breakStart, breakEnd) : 0) : 0;
  const hours = Math.max(0, totalMin) / 60;

  const handleSave = () => {
    if (!isWorking) { onSave({ isWorking: false, startTime: '', endTime: '' }); }
    else {
      onSave({
        isWorking: true, startTime, endTime,
        ...(hasBreak ? { breakStart, breakEnd } : {}),
      });
    }
    onClose();
  };

  const applyPreset = (s: string, e: string, bs?: string, be?: string) => {
    setStartTime(s); setEndTime(e);
    if (bs && be) { setHasBreak(true); setBreakStart(bs); setBreakEnd(be); }
    else { setHasBreak(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: operator.color }}>
                {getInitials(operator.firstName, operator.lastName)}
              </div>
              <div>
                <h3 className="text-base font-display font-semibold text-text-primary">{operator.firstName}</h3>
                <p className="text-xs text-text-muted">{day} {dayDate}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            {/* Working toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary">
              <span className="text-sm font-medium text-text-primary">In servizio</span>
              <button onClick={() => setIsWorking(!isWorking)}
                className={`relative w-12 h-6 rounded-full transition-colors ${isWorking ? 'bg-success' : 'bg-bg-hover'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isWorking ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {isWorking ? (
              <>
                {/* Main shift times */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Inizio turno</label>
                    <select value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Fine turno</label>
                    <select value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Break toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-warning/5 border border-warning/15">
                  <div className="flex items-center gap-2">
                    <span className="text-base">☕</span>
                    <span className="text-sm font-medium text-text-primary">Pausa</span>
                  </div>
                  <button onClick={() => setHasBreak(!hasBreak)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${hasBreak ? 'bg-warning' : 'bg-bg-hover'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasBreak ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {/* Break times */}
                {hasBreak && (
                  <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-warning/30">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Inizio pausa</label>
                      <select value={breakStart} onChange={e => setBreakStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50 transition-all appearance-none">
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Fine pausa</label>
                      <select value={breakEnd} onChange={e => setBreakEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50 transition-all appearance-none">
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {hours > 0 && (
                  <div className="text-center p-3 rounded-xl bg-accent/5 border border-accent/20">
                    <p className="text-sm text-accent font-semibold">{hours.toFixed(1)} ore lavorative</p>
                    {hasBreak ? (
                      <p className="text-xs text-text-muted mt-0.5">
                        {startTime}→{breakStart} + {breakEnd}→{endTime}
                        <span className="text-warning ml-1">☕ {(calcMinutes(breakStart, breakEnd) / 60).toFixed(1)}h pausa</span>
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">{startTime} → {endTime}</p>
                    )}
                  </div>
                )}

                {/* Quick presets */}
                <div>
                  <p className="text-xs text-text-muted mb-2">Turni rapidi</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { s: '09:00', e: '18:00', label: 'Intero 9-18' },
                      { s: '09:00', e: '14:00', label: 'Mattina 9-14' },
                      { s: '14:00', e: '20:00', label: 'Pomeriggio 14-20' },
                      { s: '09:00', e: '19:00', bs: '13:00', be: '15:00', label: 'Spezzato 9-13 / 15-19' },
                    ].map(p => (
                      <button key={p.label} onClick={() => applyPreset(p.s, p.e, p.bs, p.be)}
                        className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                          startTime === p.s && endTime === p.e && (p.bs ? hasBreak && breakStart === p.bs : !hasBreak)
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-bg-tertiary border-border text-text-secondary hover:border-border-light'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">😴</div>
                <p className="text-sm font-medium text-text-primary">Giorno di riposo</p>
                <p className="text-xs text-text-muted mt-1">Nessun turno pianificato</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all">
              <CheckCircle className="w-4 h-4" /> Salva
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== ADD STAFF MODAL ========== */
function AddStaffModal({ onClose, onSave }: { onClose: () => void; onSave: (s: Operator) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('10');
  const [specs, setSpecs] = useState<TreatmentCategory[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const toggleSpec = (s: TreatmentCategory) => setSpecs(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const canSave = firstName.trim() && lastName.trim();
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `op-${Date.now()}`, firstName: firstName.trim(), lastName: lastName.trim(),
      email, phone, specializations: specs, commission: Number(commission),
      color, avatar: '', isActive: true, locationIds: ['loc1'], hireDate: new Date().toISOString().slice(0, 10),
      schedule: { 1: { isWorking: true, startTime: '09:00', endTime: '18:00' }, 2: { isWorking: true, startTime: '09:00', endTime: '18:00' }, 3: { isWorking: true, startTime: '09:00', endTime: '18:00' }, 4: { isWorking: true, startTime: '09:00', endTime: '18:00' }, 5: { isWorking: true, startTime: '09:00', endTime: '18:00' }, 6: { isWorking: false, startTime: '', endTime: '' } },
    });
    onClose();
  };
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-display font-semibold text-text-primary">Aggiungi Membro Staff</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Cognome *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Cognome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.it" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Commissione %</label>
              <input type="number" min="0" max="100" value={commission} onChange={e => setCommission(e.target.value)} className="w-32 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Colore</label>
              <div className="flex gap-2">{COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-bg-secondary ring-accent scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />)}</div></div>
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Specializzazioni</label>
              <div className="flex flex-wrap gap-2">{SPECIALIZATIONS.map(s => <button key={s.value} onClick={() => toggleSpec(s.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${specs.includes(s.value) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>{s.label}</button>)}</div></div>
            {canSave && <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: color }}>{getInitials(firstName, lastName)}</div>
              <div><p className="text-sm font-medium text-text-primary">{firstName} {lastName}</p><p className="text-xs text-text-muted">{commission}% commissione • {specs.length} specializzazioni</p></div>
            </div>}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}><CheckCircle className="w-4 h-4" /> Aggiungi</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== WEEKLY SHIFT PLANNER ========== */
function WeeklyShiftPlanner({ operators }: { operators: Operator[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<WeekShifts>(() => buildDefaultShifts(operators));
  const [editModal, setEditModal] = useState<{ operatorId: string; dayIndex: number } | null>(null);
  const updateOperator = useOperatorStore(s => s.updateOperator);

  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);

  const weekDates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const getShift = useCallback((opId: string, day: number): ShiftEntry => {
    return shifts[opId]?.[day] || { isWorking: true, startTime: '09:00', endTime: '18:00' };
  }, [shifts]);

  const updateShift = useCallback((opId: string, day: number, entry: ShiftEntry) => {
    setShifts(prev => {
      const nextOpShifts = { ...(prev[opId] || {}), [day]: entry };
      // Persiste nella scheda operatrice (giorni 1=Lun .. 6=Sab) così l'agenda lo rispetta
      const schedule: Record<number, { isWorking: boolean; startTime: string; endTime: string }> = {};
      for (let d = 0; d < 6; d++) {
        const s = nextOpShifts[d] || { isWorking: true, startTime: '09:00', endTime: '18:00' };
        schedule[d + 1] = { isWorking: s.isWorking, startTime: s.startTime, endTime: s.endTime };
      }
      updateOperator(opId, { schedule });
      return { ...prev, [opId]: nextOpShifts };
    });
  }, [updateOperator]);

  // Ensure new operators have shifts
  React.useEffect(() => {
    setShifts(prev => {
      const updated = { ...prev };
      operators.forEach(op => {
        if (!updated[op.id]) {
          updated[op.id] = {};
          for (let d = 0; d < 6; d++) {
            updated[op.id][d] = d === 5
              ? { isWorking: false, startTime: '', endTime: '' }
              : { isWorking: true, startTime: '09:00', endTime: '18:00' };
          }
        }
      });
      return updated;
    });
  }, [operators]);

  const editingOp = editModal ? operators.find(o => o.id === editModal.operatorId) : null;

  // Stats
  const totalHoursWeek = operators.reduce((total, op) => {
    let hours = 0;
    for (let d = 0; d < 6; d++) {
      hours += shiftTotalMinutes(getShift(op.id, d)) / 60;
    }
    return total + hours;
  }, 0);

  const workingToday = (() => {
    const todayDow = new Date().getDay();
    const dayIdx = todayDow === 0 ? -1 : todayDow - 1; // Mon=0..Sat=5, Sun=-1
    if (dayIdx < 0 || dayIdx > 5) return 0;
    return operators.filter(op => getShift(op.id, dayIdx).isWorking).length;
  })();

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <h3 className="text-base font-display font-semibold text-text-primary">Pianificazione Turni</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted mr-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> In servizio: {workingToday}</span>
            <span className="text-text-muted">•</span>
            <span>Ore settimana: {totalHoursWeek.toFixed(0)}h</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset(p => p - 1)} className="p-1.5 rounded-lg hover:bg-bg-hover border border-border text-text-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setWeekOffset(0)} className="px-2.5 py-1.5 rounded-lg hover:bg-bg-hover border border-border text-xs font-medium text-text-primary transition-colors">Oggi</button>
            <button onClick={() => setWeekOffset(p => p + 1)} className="p-1.5 rounded-lg hover:bg-bg-hover border border-border text-text-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <span className="text-sm font-medium text-text-primary">{fmtWeekLabel(monday)}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 w-44">
                <span className="text-xs font-semibold text-text-muted uppercase">Operatrice</span>
              </th>
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <th key={i} className={`text-center px-2 py-3 ${isToday ? 'bg-accent/5' : ''}`}>
                    <span className={`text-xs font-semibold uppercase ${isToday ? 'text-accent' : 'text-text-muted'}`}>{DAYS_SHORT[i]}</span>
                    <br />
                    <span className={`text-[11px] ${isToday ? 'text-accent font-bold' : 'text-text-muted'}`}>{fmtDateShort(d)}</span>
                  </th>
                );
              })}
              <th className="text-center px-3 py-3 w-16">
                <span className="text-xs font-semibold text-text-muted uppercase">Ore</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {operators.map(op => {
              let weekHours = 0;
              for (let d = 0; d < 6; d++) {
                weekHours += shiftTotalMinutes(getShift(op.id, d)) / 60;
              }
              return (
                <tr key={op.id} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: op.color }}>
                        {getInitials(op.firstName, op.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{op.firstName}</p>
                        <p className="text-[10px] text-text-muted truncate">{op.lastName}</p>
                      </div>
                    </div>
                  </td>
                  {weekDates.map((d, dayIdx) => {
                    const shift = getShift(op.id, dayIdx);
                    const isToday = d.toDateString() === new Date().toDateString();
                    return (
                      <td key={dayIdx} className={`px-1.5 py-2 text-center ${isToday ? 'bg-accent/5' : ''}`}>
                        <button
                          onClick={() => setEditModal({ operatorId: op.id, dayIndex: dayIdx })}
                          className={`w-full p-2 rounded-xl transition-all hover:scale-105 ${
                            shift.isWorking
                              ? 'bg-success/10 hover:bg-success/15 border border-success/20'
                              : 'bg-bg-tertiary hover:bg-bg-hover border border-border/30'
                          }`}
                        >
                          {shift.isWorking ? (
                            <>
                              {shift.breakStart && shift.breakEnd ? (
                                <>
                                  <p className="text-[10px] font-semibold text-success leading-tight">{shift.startTime}-{shift.breakStart}</p>
                                  <p className="text-[9px] text-warning leading-tight">☕</p>
                                  <p className="text-[10px] font-semibold text-success leading-tight">{shift.breakEnd}-{shift.endTime}</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-[11px] font-semibold text-success">{shift.startTime}</p>
                                  <p className="text-[10px] text-text-muted">{shift.endTime}</p>
                                </>
                              )}
                            </>
                          ) : (
                            <p className="text-[10px] text-text-muted font-medium py-0.5">Riposo</p>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-text-primary">{weekHours.toFixed(0)}h</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editModal && editingOp && (
          <ShiftEditModal
            operator={editingOp}
            day={DAYS[editModal.dayIndex]}
            dayDate={fmtDateShort(weekDates[editModal.dayIndex])}
            shift={getShift(editModal.operatorId, editModal.dayIndex)}
            onClose={() => setEditModal(null)}
            onSave={(entry) => updateShift(editModal.operatorId, editModal.dayIndex, entry)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ========== MAIN PAGE ========== */
export default function StaffPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { operators: staffList, addOperator, deleteOperator } = useOperatorStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'shifts'>('overview');
  const { punches } = useTimeClockStore();

  // Commissioni derivate dalle operatrici reali. Il fatturato per operatrice non è
  // ancora tracciato dalle vendite, quindi resta a 0 finché non ci sono dati reali.
  const commissions = staffList.map((op) => ({
    name: `${op.firstName} ${op.lastName}`.trim(),
    revenue: 0,
    commission: 0,
    rate: op.commission,
    color: op.color,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-xl font-display font-bold text-text-primary">Gestione Staff</h2><p className="text-sm text-text-secondary">Operatrici, turni, commissioni e performance</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {([['overview','Panoramica'],['shifts','Turni']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setActiveTab(val)} className={`px-4 py-2 text-xs font-medium transition-colors ${activeTab === val ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'}`}>{label}</button>
            ))}
          </div>
          <Link href="/dashboard/staff/kiosk" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-all"><Clock className="w-4 h-4" /> Apri Kiosk</Link>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105"><Plus className="w-4 h-4" /> Aggiungi Staff</button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Staff cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {staffList.map(op => (
              <div key={op.id} className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-border-light transition-all cursor-pointer group text-center relative">
                <button onClick={() => {
                  if (window.confirm('Sei sicuro di voler eliminare questo collaboratore?')) {
                    deleteOperator(op.id);
                  }
                }} className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold mx-auto mb-3" style={{ backgroundColor: op.color }}>{getInitials(op.firstName, op.lastName)}</div>
                <h4 className="text-sm font-semibold text-text-primary">{op.firstName} {op.lastName}</h4>
                <div className="flex flex-wrap gap-1 justify-center mt-2">{op.specializations.slice(0, 2).map(s => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">{specLabel(s)}</span>)}</div>
                <p className="text-xs text-text-muted mt-2">Commissione: {op.commission}%</p>
              </div>
            ))}
          </div>

          {/* Commissions */}
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2"><Euro className="w-4 h-4 text-accent" /><h3 className="text-base font-display font-semibold text-text-primary">Commissioni del Mese</h3></div>
            <div className="divide-y divide-border/30">{commissions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-text-muted">Nessuna operatrice registrata</div>
            ) : commissions.map((s, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-hover transition-colors"><div className="w-2 h-8 rounded-full" style={{ backgroundColor: s.color }} /><div className="flex-1"><p className="text-sm font-medium text-text-primary">{s.name}</p><p className="text-xs text-text-muted">Fatturato: € {s.revenue.toLocaleString('it-IT')}</p></div><div className="text-right"><p className="text-sm font-semibold text-accent">€ {s.commission.toLocaleString('it-IT')}</p><p className="text-[11px] text-text-muted">{s.rate}% commissione</p></div></div>
            ))}</div>
            <div className="px-5 py-3 bg-bg-tertiary/30 border-t border-border flex items-center justify-between"><span className="text-sm font-medium text-text-secondary">Totale Commissioni</span><span className="text-sm font-bold text-accent">€ {commissions.reduce((s, c) => s + c.commission, 0).toLocaleString('it-IT')}</span></div>
          </div>

          {/* Recent Punches */}
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden mt-6">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <h3 className="text-base font-display font-semibold text-text-primary">Ultime Timbrature</h3>
            </div>
            <div className="divide-y divide-border/30">
              {punches.slice(0, 5).map((p) => {
                let badge = '';
                let color = '';
                if (p.type === 'in') { badge = 'Entrata'; color = 'text-success bg-success/10'; }
                if (p.type === 'out') { badge = 'Uscita'; color = 'text-error bg-error/10'; }
                if (p.type === 'break_start') { badge = 'Inizio Pausa'; color = 'text-warning bg-warning/10'; }
                if (p.type === 'break_end') { badge = 'Fine Pausa'; color = 'text-blue-500 bg-blue-500/10'; }
                const date = new Date(p.timestamp);
                
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-bg-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                        {p.staffName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{p.staffName}</p>
                        <p className="text-xs text-text-muted">{date.toLocaleDateString('it-IT')} alle {date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${color}`}>{badge}</span>
                  </div>
                );
              })}
              {punches.length === 0 && (
                <div className="px-5 py-6 text-center text-text-muted text-sm">Nessuna timbratura registrata oggi.</div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'shifts' && (
        <WeeklyShiftPlanner operators={staffList} />
      )}

      <AnimatePresence>
        {showAddModal && (
          <AddStaffModal 
            onClose={() => setShowAddModal(false)} 
            onSave={(op) => { addOperator(op); setShowAddModal(false); }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
