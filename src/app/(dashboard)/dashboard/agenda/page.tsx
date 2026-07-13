'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { useClientStore } from '@/stores/useClientStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { usePackageStore } from '@/stores/usePackageStore';
import { useWaitlistStore, WaitlistEntry } from '@/stores/useWaitlistStore';
import { Appointment, AppointmentService, AgendaBlock, Operator, Treatment } from '@/types';
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus,
  Clock, CheckCircle, AlertCircle, Play, XCircle, Ban, ListTodo,
  Lock, X, Search, UserCircle, Minus, Package, Sparkles, AlertTriangle, Euro, UserPlus, Settings, Moon
} from 'lucide-react';
import {
  formatDateLong, timeToMinutes, getStatusLabel,
  getStatusColor, formatCurrency, getInitials, getCategoryLabel, guessGenderFromName,
} from '@/lib/helpers';
import WaitlistModal from '@/components/WaitlistModal';
import WaitlistPanel from '@/components/WaitlistPanel';
import AddClientModal from '@/components/AddClientModal';

const HOUR_HEIGHT = 88;
const START_HOUR = 8;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const statusIcons: Record<string, React.ReactNode> = {
  confirmed: <CheckCircle className="w-3 h-3" />,
  pending: <AlertCircle className="w-3 h-3" />,
  in_progress: <Play className="w-3 h-3" />,
  in_cabin: <Sparkles className="w-3 h-3" />,
  completed: <CheckCircle className="w-3 h-3" />,
  no_show: <XCircle className="w-3 h-3" />,
  cancelled: <Ban className="w-3 h-3" />,
  waitlist: <ListTodo className="w-3 h-3" />,
};

const WEEK_DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTH_NAMES_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ========== APPOINTMENT BLOCK (Day View) ========== */
// Verifica se un'operatrice lavora in una certa data, in base al turno settimanale
// (schedule keyed 1=Lun .. 6=Sab; domenica salone chiuso).
function operatorWorksOn(op: Operator, date: Date): boolean {
  const dow = date.getDay(); // 0=Domenica .. 6=Sabato
  if (dow === 0) return false;
  const day = op.schedule?.[dow];
  if (!day) return true; // nessun turno impostato: assume operativa
  return day.isWorking !== false;
}

function AppointmentBlock({ appointment, onClick, onWaitlistAdd, overlapStyle, color }: { appointment: Appointment; onClick: (a: Appointment) => void; onWaitlistAdd?: (a: Appointment) => void; overlapStyle?: React.CSSProperties; color?: string }) {
  const blockColor = color || appointment.color;
  const startMin = timeToMinutes(appointment.startTime) - START_HOUR * 60;
  const endMin = timeToMinutes(appointment.endTime) - START_HOUR * 60;
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 18);
  const isSmall = height < 44;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('appointmentId', appointment.id);
    e.dataTransfer.setData('duration', String(appointment.duration));
    e.dataTransfer.effectAllowed = 'move';
  };

  const isFrozen = appointment.isLocked || appointment.status === 'completed';

  return (
    <div
      draggable={!isFrozen}
      onDragStart={handleDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
      className={`appointment-block group ${isFrozen ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${appointment.status === 'in_cabin' ? 'animate-[pulse_1.5s_ease-in-out_infinite] ring-2 ring-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : ''}`}
      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: `${blockColor}22`, borderLeftColor: blockColor, ...overlapStyle }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <span style={{ color: getStatusColor(appointment.status) }}>{statusIcons[appointment.status]}</span>
          <span className={`font-semibold text-text-primary truncate ${isSmall ? 'text-[10px]' : 'text-xs'}`}>{appointment.clientName}</span>
        </div>
        <div className="flex items-center gap-1">
          {onWaitlistAdd && (
            <button 
              onClick={(e) => { e.stopPropagation(); onWaitlistAdd(appointment); }}
              className="p-1 rounded-md bg-white/20 text-text-primary hover:bg-warning hover:text-white opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              title="Metti in Lista d'Attesa"
            >
              <ListTodo className="w-3 h-3" />
            </button>
          )}
          {appointment.isLocked && <Lock className="w-3 h-3 text-text-muted flex-shrink-0" />}
          {!appointment.isLocked && !isSmall && (
            <svg className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" viewBox="0 0 6 10">
              <circle cx="1.5" cy="1.5" r="1" fill="currentColor"/><circle cx="4.5" cy="1.5" r="1" fill="currentColor"/>
              <circle cx="1.5" cy="5" r="1" fill="currentColor"/><circle cx="4.5" cy="5" r="1" fill="currentColor"/>
              <circle cx="1.5" cy="8.5" r="1" fill="currentColor"/><circle cx="4.5" cy="8.5" r="1" fill="currentColor"/>
            </svg>
          )}
        </div>
      </div>
      {!isSmall && (
        <>
          <p className="text-[11px] text-text-secondary leading-tight mt-0.5 line-clamp-2" title={appointment.treatmentName}>
            {appointment.treatmentName}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-auto text-[10px] text-text-muted">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {appointment.startTime} - {appointment.endTime}
            {appointment.price > 0 && <span className="ml-auto font-medium">{formatCurrency(appointment.price)}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function OperatorColumnHeader({ operator, off }: { operator: Operator; off?: boolean }) {
  return (
    <div
      className="sticky top-0 z-20 border-b-2 px-3 py-3 flex items-center gap-2.5"
      style={{
        backgroundColor: off ? undefined : `${operator.color}14`,
        borderBottomColor: off ? 'var(--border)' : operator.color,
      }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${off ? 'opacity-40 grayscale' : 'shadow-sm'}`} style={{ backgroundColor: operator.color }}>
        {getInitials(operator.firstName, operator.lastName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${off ? 'text-text-muted' : 'text-text-primary'}`}>{operator.firstName}</p>
        <p className="text-[11px] text-text-muted truncate">{operator.lastName}</p>
      </div>
      {off && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[10px] font-bold border border-amber-300/50 flex-shrink-0">
          <Moon className="w-3 h-3" /> RIPOSO
        </span>
      )}
    </div>
  );
}

function TimeGutter() {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  return (
    <div className="sticky left-0 z-10 bg-bg-primary border-r border-border w-16 flex-shrink-0">
      <div className="sticky top-0 z-20 bg-bg-secondary border-b border-border h-[56px] flex items-center justify-center">
        <Clock className="w-4 h-4 text-text-muted" />
      </div>
      {hours.map((hour) => (
        <div key={hour} className="relative border-b-2 border-border" style={{ height: `${HOUR_HEIGHT}px` }}>
          <span className="absolute -top-2.5 right-2 text-[11px] font-semibold text-text-secondary">{String(hour).padStart(2,'0')}:00</span>
        </div>
      ))}
    </div>
  );
}

function NowLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const offsetMin = minutes - START_HOUR * 60;
  if (offsetMin < 0 || offsetMin > TOTAL_HOURS * 60) return null;
  const top = (offsetMin / 60) * HOUR_HEIGHT + 56;
  return (
    <div className="now-line" style={{ top: `${top}px` }}>
      <div className="absolute left-0 -top-2.5 px-1.5 py-0.5 rounded bg-error text-white text-[10px] font-bold">
        {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}
      </div>
    </div>
  );
}

/* ========== DAY VIEW ========== */
function DayView({ appointments, blocks, operators, selectedDate, onAppointmentClick, onWaitlistAdd, onSlotClick, onSlotBlock, onRemoveBlock, onDropAppointment }: {
  appointments: Appointment[]; blocks: AgendaBlock[]; operators: Operator[]; selectedDate: Date;
  onAppointmentClick: (a: Appointment) => void;
  onWaitlistAdd?: (a: Appointment) => void;
  onSlotClick: (operatorId: string, hour: number) => void;
  onSlotBlock: (operatorId: string, hour: number) => void;
  onRemoveBlock: (block: AgendaBlock) => void;
  onDropAppointment: (aptId: string, operatorId: string, newStart: string, duration: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  const [dragOver, setDragOver] = useState<{ operatorId: string; time: string } | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Distingue click singolo (nuovo appuntamento) da doppio click (blocca fascia)
  const handleSlotClickDelayed = (operatorId: string, hour: number) => {
    if (clickTimer.current) return; // già in attesa: il secondo click del doppio è gestito da onDoubleClick
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onSlotClick(operatorId, hour);
    }, 230);
  };
  const handleSlotDoubleClick = (operatorId: string, hour: number) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    onSlotBlock(operatorId, hour);
  };

  const blocksByOperator = useMemo(() => {
    const map: Record<string, AgendaBlock[]> = {};
    operators.forEach(op => { map[op.id] = blocks.filter(b => b.operatorId === op.id); });
    return map;
  }, [blocks, operators]);

  const byOperator = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    operators.forEach(op => { map[op.id] = appointments.filter(a => a.operatorId === op.id); });
    return map;
  }, [appointments, operators]);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, []);

  const calcTimeFromY = (e: React.DragEvent, columnEl: HTMLElement): string => {
    const rect = columnEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Snap to 15-minute intervals
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const snapped = Math.round(totalMinutes / 15) * 15;
    const hour = START_HOUR + Math.floor(snapped / 60);
    const min = snapped % 60;
    return `${String(Math.max(START_HOUR, Math.min(END_HOUR - 1, hour))).padStart(2, '0')}:${String(Math.max(0, min)).padStart(2, '0')}`;
  };

  const handleDragOver = (e: React.DragEvent, operatorId: string, columnEl: HTMLElement) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const time = calcTimeFromY(e, columnEl);
    setDragOver({ operatorId, time });
  };

  const handleDrop = (e: React.DragEvent, operatorId: string, columnEl: HTMLElement) => {
    e.preventDefault();
    const appointmentId = e.dataTransfer.getData('appointmentId');
    const duration = Number(e.dataTransfer.getData('duration')) || 60;
    if (!appointmentId) return;
    const time = calcTimeFromY(e, columnEl);
    onDropAppointment(appointmentId, operatorId, time, duration);
    setDragOver(null);
  };

  // Ghost preview position
  const dragGhostTop = dragOver ? (() => {
    const [h, m] = dragOver.time.split(':').map(Number);
    return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
  })() : 0;

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto border border-border rounded-2xl bg-bg-secondary relative">
      <div className="flex min-w-0">
        <TimeGutter />
        {operators.map(operator => {
          const off = !operatorWorksOn(operator, selectedDate);
          return (
          <div key={operator.id} className="flex-1 min-w-[160px] border-r border-border/50 last:border-r-0 relative">
            <OperatorColumnHeader operator={operator} off={off} />
            <div className="relative"
              style={off ? {
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0, rgba(148,163,184,0.10) 10px, rgba(148,163,184,0.02) 10px, rgba(148,163,184,0.02) 20px)',
              } : { backgroundColor: `${operator.color}08` }}
              onDragOver={e => !off && handleDragOver(e, operator.id, e.currentTarget)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => !off && handleDrop(e, operator.id, e.currentTarget)}>
              {hours.map(hour => (
                <div key={hour}
                  onClick={off ? undefined : () => handleSlotClickDelayed(operator.id, hour)}
                  onDoubleClick={off ? undefined : () => handleSlotDoubleClick(operator.id, hour)}
                  className={`border-b-2 border-border relative transition-colors group/slot ${off ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent/[0.03]'}`}
                  style={{ height: `${HOUR_HEIGHT}px` }}>
                  <div className="absolute left-0 right-0 border-b border-dashed border-border/60" style={{ top: `${HOUR_HEIGHT / 2}px` }} />
                  {!off && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-[10px] font-medium">
                          <Plus className="w-3 h-3" /> {String(hour).padStart(2,'0')}:00 appuntamento
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-bg-tertiary text-text-muted text-[9px]">
                          <Lock className="w-2.5 h-2.5" /> doppio click = blocca
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {off && (
                <div className="absolute inset-0 flex items-start justify-center pt-12 pointer-events-none z-10">
                  <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-bg-secondary/95 border border-amber-300/40 shadow-md backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-amber-500" />
                    </div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Giorno di riposo</span>
                    <span className="text-[10px] text-text-muted">{operator.firstName} non è in servizio</span>
                  </div>
                </div>
              )}
              {/* Fasce bloccate */}
              {!off && (blocksByOperator[operator.id] || []).map(block => {
                const bStart = timeToMinutes(block.startTime) - START_HOUR * 60;
                const bEnd = timeToMinutes(block.endTime) - START_HOUR * 60;
                const top = (bStart / 60) * HOUR_HEIGHT;
                const h = Math.max(((bEnd - bStart) / 60) * HOUR_HEIGHT - 2, 24);
                return (
                  <div key={block.id}
                    onClick={(e) => { e.stopPropagation(); onRemoveBlock(block); }}
                    className="absolute left-1 right-1 rounded-lg z-20 cursor-pointer group/block overflow-hidden border border-slate-400/40 flex flex-col items-center justify-center text-center"
                    style={{
                      top: `${top}px`, height: `${h}px`,
                      backgroundColor: 'rgba(100,116,139,0.14)',
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.22) 0, rgba(100,116,139,0.22) 8px, transparent 8px, transparent 16px)',
                    }}
                    title="Clicca per sbloccare questa fascia">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <Lock className="w-3 h-3" />
                      <span className="text-[11px] font-bold">{block.reason || 'Bloccato'}</span>
                    </div>
                    <span className="text-[9px] text-slate-500">{block.startTime}–{block.endTime}</span>
                    <span className="hidden group-hover/block:flex items-center gap-0.5 text-[9px] text-error mt-0.5"><X className="w-2.5 h-2.5" /> sblocca</span>
                  </div>
                );
              })}

              {/* Drop ghost preview */}
              {dragOver && dragOver.operatorId === operator.id && (
                <div className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-accent/50 bg-accent/10 pointer-events-none z-30 flex items-center justify-center"
                  style={{ top: `${dragGhostTop}px`, height: `${HOUR_HEIGHT - 2}px` }}>
                  <span className="text-[10px] font-semibold text-accent">{dragOver.time}</span>
                </div>
              )}
              {(() => {
                const operatorApts = byOperator[operator.id] || [];
                // Sort by start time
                const sorted = [...operatorApts].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                
                // Group overlapping
                const overlappingGroups: Appointment[][] = [];
                sorted.forEach(apt => {
                  let placed = false;
                  for (const group of overlappingGroups) {
                    const overlaps = group.some(gApt => {
                      const aStart = timeToMinutes(apt.startTime);
                      const aEnd = timeToMinutes(apt.endTime);
                      const gStart = timeToMinutes(gApt.startTime);
                      const gEnd = timeToMinutes(gApt.endTime);
                      // check overlap
                      return Math.max(aStart, gStart) < Math.min(aEnd, gEnd);
                    });
                    if (overlaps) {
                      group.push(apt);
                      placed = true;
                      break;
                    }
                  }
                  if (!placed) overlappingGroups.push([apt]);
                });

                return overlappingGroups.flatMap(group => {
                  const cols = group.length;
                  return group.map((apt, index) => {
                    const widthPercent = 100 / cols;
                    const leftPercent = index * widthPercent;
                    const overlapStyle: React.CSSProperties = cols > 1 ? {
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                      right: 'auto'
                    } : {};

                    return (
                      <AppointmentBlock
                        key={apt.id}
                        appointment={apt}
                        onClick={onAppointmentClick}
                        onWaitlistAdd={onWaitlistAdd}
                        overlapStyle={overlapStyle}
                        color={operator.color}
                      />
                    );
                  });
                });
              })()}
            </div>
          </div>
          );
        })}
      </div>
      <NowLine />
    </div>
  );
}

/* ========== WEEK VIEW ========== */
function WeekView({ selectedDate, allAppointments, operatorColorById, onAppointmentClick, onDayClick }: {
  selectedDate: Date; allAppointments: Appointment[];
  operatorColorById?: Record<string, string>;
  onAppointmentClick: (a: Appointment) => void; onDayClick: (d: Date) => void;
}) {
  const weekDates = useMemo(() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
  }, [selectedDate]);

  const today = fmtDate(new Date());
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    weekDates.forEach(d => { map[fmtDate(d)] = allAppointments.filter(a => a.date === fmtDate(d)); });
    return map;
  }, [weekDates, allAppointments]);

  return (
    <div className="flex-1 overflow-auto border border-border rounded-2xl bg-bg-secondary">
      <div className="flex min-w-0">
        {/* Time gutter */}
        <div className="sticky left-0 z-10 bg-bg-primary border-r border-border w-14 flex-shrink-0">
          <div className="sticky top-0 z-20 bg-bg-secondary border-b border-border h-[52px]" />
          {hours.map(hour => (
            <div key={hour} className="relative border-b border-border/30" style={{ height: '48px' }}>
              <span className="absolute -top-2 right-1.5 text-[10px] font-medium text-text-muted">{String(hour).padStart(2,'0')}:00</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map((date, i) => {
          const ds = fmtDate(date);
          const isToday = ds === today;
          const dayApts = appointmentsByDay[ds] || [];
          return (
            <div key={i} className="flex-1 min-w-[100px] border-r border-border/50 last:border-r-0">
              {/* Day header */}
              <button
                onClick={() => onDayClick(date)}
                className={`sticky top-0 z-20 w-full border-b border-border px-2 py-2 text-center transition-colors ${isToday ? 'bg-accent/10' : 'bg-bg-secondary hover:bg-bg-hover'}`}
              >
                <p className="text-[11px] text-text-muted">{WEEK_DAYS_IT[i]}</p>
                <p className={`text-lg font-display font-bold ${isToday ? 'text-accent' : 'text-text-primary'}`}>{date.getDate()}</p>
                {dayApts.length > 0 && (
                  <p className="text-[10px] text-text-muted">{dayApts.length} app.</p>
                )}
              </button>

              {/* Time grid */}
              <div className="relative">
                {hours.map(hour => (
                  <div key={hour} className="border-b border-border/20" style={{ height: '48px' }} />
                ))}
                {/* Appointment chips */}
                {dayApts.map(apt => {
                  const startMin = timeToMinutes(apt.startTime) - START_HOUR * 60;
                  const endMin = timeToMinutes(apt.endTime) - START_HOUR * 60;
                  const top = (startMin / 60) * 48;
                  const height = Math.max(((endMin - startMin) / 60) * 48 - 1, 18);
                  const c = operatorColorById?.[apt.operatorId] || apt.color;
                  return (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className="absolute left-1 right-1 rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden hover:brightness-110 transition-all border-l-2"
                      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: `${c}20`, borderLeftColor: c }}
                    >
                      <p className="text-[10px] font-semibold text-text-primary truncate">{apt.clientName}</p>
                      {height > 24 && <p className="text-[9px] text-text-muted truncate">{apt.startTime}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========== MONTH VIEW ========== */
function MonthView({ selectedDate, allAppointments, operatorColorById, onAppointmentClick, onDayClick }: {
  selectedDate: Date; allAppointments: Appointment[];
  operatorColorById?: Record<string, string>;
  onAppointmentClick: (a: Appointment) => void; onDayClick: (d: Date) => void;
}) {
  const { year, month, weeks } = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ date: new Date(y, m - 1, daysInPrevMonth - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(y, m, d), isCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: new Date(y, m + 1, cells.length - daysInMonth - startOffset + 1), isCurrentMonth: false });
    }

    const w: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return { year: y, month: m, weeks: w };
  }, [selectedDate]);

  const today = fmtDate(new Date());

  const aptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    allAppointments.forEach(a => { if (!map[a.date]) map[a.date] = []; map[a.date].push(a); });
    return map;
  }, [allAppointments]);

  return (
    <div className="flex-1 border border-border rounded-2xl bg-bg-secondary overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS_IT.map(d => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-text-muted uppercase">{d}</div>
        ))}
      </div>
      {/* Weeks */}
      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/30 last:border-b-0">
            {week.map((cell, ci) => {
              const ds = fmtDate(cell.date);
              const isToday = ds === today;
              const dayApts = aptsByDate[ds] || [];
              return (
                <button
                  key={ci}
                  onClick={() => onDayClick(cell.date)}
                  className={`min-h-[90px] p-1.5 border-r border-border/20 last:border-r-0 text-left transition-colors hover:bg-bg-hover ${
                    !cell.isCurrentMonth ? 'opacity-30' : ''
                  } ${isToday ? 'bg-accent/5' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    isToday ? 'bg-accent text-white' : 'text-text-primary'
                  }`}>
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayApts.slice(0, 3).map(apt => {
                      const c = operatorColorById?.[apt.operatorId] || apt.color;
                      return (
                      <div
                        key={apt.id}
                        onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate cursor-pointer hover:brightness-125 border-l-2"
                        style={{ backgroundColor: `${c}20`, color: c, borderLeftColor: c }}
                      >
                        <span className="font-medium">{apt.startTime}</span>
                        <span className="truncate text-text-secondary">{apt.clientName}</span>
                      </div>
                      );
                    })}
                    {dayApts.length > 3 && (
                      <p className="text-[10px] text-text-muted px-1">+{dayApts.length - 3} altri</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== MINI DATE PICKER (salto rapido a un giorno/mese) ========== */
function MiniDatePicker({ selectedDate, onPick, onClose }: {
  selectedDate: Date; onPick: (d: Date) => void; onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const selStr = fmtDate(selectedDate);

  const cells = useMemo(() => {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Lun=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(y, m, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewMonth]);

  const changeMonth = (delta: number) => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className="absolute top-full left-0 mt-2 z-[56] w-72 bg-bg-secondary border border-border rounded-2xl shadow-2xl p-3"
        onClick={e => e.stopPropagation()}>
        {/* Header mese con navigazione */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-text-primary capitalize">{MONTH_NAMES_IT[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {/* Salto rapido ai mesi */}
        <div className="grid grid-cols-6 gap-1 mb-2 pb-2 border-b border-border/50">
          {MONTH_NAMES_IT.map((mn, i) => (
            <button key={i} onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), i, 1))}
              className={`text-[10px] py-1 rounded-md transition-colors ${i === viewMonth.getMonth() ? 'bg-accent text-white font-bold' : 'text-text-secondary hover:bg-bg-hover'}`}>
              {mn.slice(0, 3)}
            </button>
          ))}
        </div>
        {/* Giorni settimana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS_IT.map(d => <div key={d} className="text-center text-[10px] font-semibold text-text-muted">{d.charAt(0)}</div>)}
        </div>
        {/* Griglia giorni */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const isToday = d.getTime() === today.getTime();
            const isSel = fmtDate(d) === selStr;
            return (
              <button key={i} onClick={() => { onPick(d); onClose(); }}
                className={`h-8 rounded-lg text-xs font-medium transition-all ${
                  isSel ? 'bg-accent text-white font-bold' : isToday ? 'bg-accent/10 text-accent ring-1 ring-accent/30' : 'text-text-primary hover:bg-bg-hover'
                }`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <button onClick={() => { onPick(new Date()); onClose(); }}
          className="w-full mt-2 py-1.5 rounded-lg bg-bg-tertiary text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
          Vai a Oggi
        </button>
      </div>
    </>
  );
}

/* ========== APPOINTMENT MODAL ========== */
function AppointmentModal({ onOpenWaitlist }: { onOpenWaitlist: (prefill: Partial<WaitlistEntry>) => void }) {
  const addClient = useClientStore(s => s.addClient);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const treatments = useTreatmentStore(s => s.treatments);
  const operators = useOperatorStore(s => s.operators);
  const { isAppointmentModalOpen, editingAppointment, closeAppointmentModal, addAppointment, updateAppointment, selectedDate, slotInfo, appointments, blocks } = useAgendaStore();
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [selectedServices, setSelectedServices] = useState<AppointmentService[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [treatmentQuery, setTreatmentQuery] = useState('');
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [gender, setGender] = useState<'female' | 'male'>('female');

  useEffect(() => {
    if (isAppointmentModalOpen) {
      if (editingAppointment) {
        setSelectedClientId(editingAppointment.clientId);
        setSelectedClientName(editingAppointment.clientName);
        // Ricostruisci la lista: usa services se presente, altrimenti il singolo trattamento salvato
        if (editingAppointment.services && editingAppointment.services.length > 0) {
          setSelectedServices(editingAppointment.services);
        } else {
          const t = treatments.find(tr => tr.id === editingAppointment.treatmentId);
          setSelectedServices([{
            treatmentId: editingAppointment.treatmentId,
            treatmentName: editingAppointment.treatmentName,
            treatmentCategory: editingAppointment.treatmentCategory,
            duration: editingAppointment.duration,
            price: editingAppointment.price,
            gender: t && t.priceMale != null && t.priceMale === editingAppointment.price && t.priceMale !== t.priceFemale ? 'male' : 'female',
          }]);
        }
        setTreatmentQuery('');
        setSelectedOperatorId(editingAppointment.operatorId);
        setStartTime(editingAppointment.startTime);
        setNotes(editingAppointment.notes || '');
      } else if (slotInfo) {
        setClientSearch(''); setSelectedClientId(''); setSelectedClientName('');
        setSelectedServices([]); setTreatmentQuery('');
        setSelectedOperatorId(slotInfo.operatorId);
        setStartTime(slotInfo.time);
        setNotes('');
      } else {
        setClientSearch(''); setSelectedClientId(''); setSelectedClientName('');
        setSelectedServices([]); setTreatmentQuery('');
        const firstWorking = operators.find(o => operatorWorksOn(o, selectedDate)) || operators[0];
        setSelectedOperatorId(firstWorking?.id || '');
        setStartTime('09:00'); setNotes('');
      }
      setShowClientDropdown(false);
      setTreatmentOpen(false);
      // Deduci il sesso dal primo trattamento salvato, altrimenti default Donna
      if (editingAppointment?.services?.[0]?.gender) {
        setGender(editingAppointment.services[0].gender);
      } else if (editingAppointment) {
        const t = treatments.find(tr => tr.id === editingAppointment.treatmentId);
        setGender(t && t.priceMale != null && t.priceMale === editingAppointment.price && t.priceMale !== t.priceFemale ? 'male' : 'female');
      } else {
        setGender('female');
      }
    }
  }, [isAppointmentModalOpen, editingAppointment, slotInfo, operators]);

  const allClients = useClientStore(s => s.clients);
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients.slice(0, 5);
    const q = clientSearch.toLowerCase();
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 8);
  }, [clientSearch, allClients]);

  // Active packages for selected client
  const allPkgData = usePackageStore(s => s.clientPackages);
  const clientActivePkgs = useMemo(() => {
    if (!selectedClientName) return [];
    const normalize = (n: string) => n.toLowerCase().trim().split(/\s+/).sort().join(' ');
    const target = normalize(selectedClientName);
    return allPkgData.filter(
      cp => (normalize(cp.clientName) === target ||
             cp.clientName.toLowerCase().includes(selectedClientName.toLowerCase()) ||
             selectedClientName.toLowerCase().includes(cp.clientName.toLowerCase())) &&
            (cp.status === 'active' || cp.status === 'expiring')
    );
  }, [selectedClientName, allPkgData]);

  const selectedClient = useMemo(() => allClients.find(c => c.id === selectedClientId), [selectedClientId, allClients]);

  // Sceglie automaticamente il listino uomo/donna in base al cliente selezionato
  // (campo genere della scheda se presente, altrimenti dal nome). Modificabile a mano.
  useEffect(() => {
    if (editingAppointment || !selectedClient) return;
    if (selectedClient.gender === 'M') setGender('male');
    else if (selectedClient.gender === 'F') setGender('female');
    else setGender(guessGenderFromName(`${selectedClient.firstName} ${selectedClient.lastName}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  // Prezzo/durata in base al sesso selezionato (fallback all'altro se mancante)
  const genderPrice = (t: Treatment) => gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price);
  const genderDuration = (t: Treatment) => gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration);

  // Aggiunge un trattamento alla lista (con prezzo/durata del sesso corrente,
  // rispettando eventuali trattamenti personalizzati del cliente)
  const addService = (t: Treatment) => {
    const custom = selectedClient?.customTreatments?.find(ct => ct.treatmentId === t.id) || null;
    const service: AppointmentService = {
      treatmentId: t.id,
      treatmentName: t.name,
      treatmentCategory: t.category,
      duration: custom ? custom.duration : genderDuration(t),
      price: custom ? custom.price : genderPrice(t),
      gender,
    };
    setSelectedServices(prev => [...prev, service]);
    setTreatmentQuery('');
    setTreatmentOpen(false);
    if (custom?.notes) {
      setNotes(prev => prev.includes(custom.notes!) ? prev : (prev ? prev + '\n' + custom.notes : custom.notes || ''));
    }
  };
  const removeService = (index: number) => setSelectedServices(prev => prev.filter((_, i) => i !== index));

  const totalDuration = useMemo(() => selectedServices.reduce((s, x) => s + x.duration, 0), [selectedServices]);
  const totalPrice = useMemo(() => selectedServices.reduce((s, x) => s + x.price, 0), [selectedServices]);

  const endTime = useMemo(() => {
    if (selectedServices.length === 0) return startTime;
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + totalDuration;
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }, [startTime, selectedServices, totalDuration]);

  const selectedOperator = operators.find(o => o.id === selectedOperatorId);
  const dateStr = fmtDate(selectedDate);
  const canSave = selectedClientId && selectedServices.length > 0 && selectedOperatorId && startTime;

  const handleSave = () => {
    if (!canSave || selectedServices.length === 0 || !selectedOperator) return;
    const first = selectedServices[0];
    const firstTreatment = treatments.find(t => t.id === first.treatmentId);
    const data = {
      clientId: selectedClientId, clientName: selectedClientName,
      treatmentId: first.treatmentId,
      treatmentName: selectedServices.map(s => s.treatmentName).join(' + '),
      treatmentCategory: first.treatmentCategory,
      operatorId: selectedOperatorId, operatorName: `${selectedOperator.firstName} ${selectedOperator.lastName}`,
      date: dateStr, startTime, endTime, duration: totalDuration,
      price: totalPrice, status: 'confirmed' as const,
      services: selectedServices,
      color: selectedOperator.color || firstTreatment?.color || '#A855F7', locationId: 'loc1', notes, isLocked: false,
    };
    if (editingAppointment) updateAppointment(editingAppointment.id, data);
    else addAppointment(data);
    closeAppointmentModal();
  };

  const isOccupied = useMemo(() => {
    if (selectedServices.length === 0 || !selectedOperatorId) return false;
    const eStart = timeToMinutes(startTime);
    const eEnd = eStart + totalDuration;
    const overlapsAppt = appointments.some(a =>
      a.date === dateStr && a.operatorId === selectedOperatorId &&
      a.id !== editingAppointment?.id &&
      a.status !== 'cancelled' && a.status !== 'no_show' &&
      !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
    );
    const overlapsBlock = blocks.some(b =>
      b.date === dateStr && b.operatorId === selectedOperatorId &&
      !(timeToMinutes(b.endTime) <= eStart || timeToMinutes(b.startTime) >= eEnd)
    );
    return overlapsAppt || overlapsBlock;
  }, [startTime, selectedServices, dateStr, selectedOperatorId, appointments, blocks, editingAppointment, totalDuration]);

  const handleWaitlist = () => {
    closeAppointmentModal();
    onOpenWaitlist({
      clientName: selectedClientName,
      treatmentId: selectedServices[0]?.treatmentId,
      treatmentName: selectedServices.map(s => s.treatmentName).join(' + '),
      duration: totalDuration,
      date: dateStr,
      startTime,
      operatorId: selectedOperatorId,
      notes,
    });
  };

  if (!isAppointmentModalOpen) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={closeAppointmentModal} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4"
        onClick={(e) => e.target === e.currentTarget && closeAppointmentModal()}
      >
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-lg font-display font-semibold text-text-primary">
              {editingAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h3>
            <button onClick={closeAppointmentModal} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* Client */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">Cliente *</label>
                <button 
                  onClick={() => setShowAddClientModal(true)} 
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors font-medium bg-accent/10 px-2 py-1 rounded-md"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Nuovo Cliente
                </button>
              </div>
              
              {selectedClientId ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                  <UserCircle className="w-5 h-5 text-accent" />
                  <span className="text-sm font-medium text-text-primary flex-1">{selectedClientName}</span>
                  <button onClick={() => { setSelectedClientId(''); setSelectedClientName(''); setClientSearch(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input type="text" value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }} onFocus={() => setShowClientDropdown(true)}
                      placeholder="Cerca cliente per nome o telefono..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all" />
                  </div>
                  {showClientDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                      {filteredClients.map(client => (
                        <button key={client.id} onClick={() => { setSelectedClientId(client.id); setSelectedClientName(`${client.firstName} ${client.lastName}`); setShowClientDropdown(false); setClientSearch(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left">
                          <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">{getInitials(client.firstName, client.lastName)}</div>
                          <div className="min-w-0"><p className="text-sm font-medium text-text-primary">{client.firstName} {client.lastName}</p><p className="text-xs text-text-muted">{client.phone}</p></div>
                        </button>
                      ))}
                      {filteredClients.length === 0 && <p className="px-3 py-3 text-sm text-text-muted text-center">Nessun cliente trovato</p>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* === PACCHETTI ATTIVI DEL CLIENTE === */}
            {selectedClientName && clientActivePkgs.length > 0 && (
              <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  📦 Pacchetti Attivi di {selectedClientName.split(' ')[0]}
                </p>
                {clientActivePkgs.map(cp => {
                  const remaining = cp.totalSessions - cp.usedSessions;
                  return (
                    <div key={cp.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-secondary/80 border border-border/50">
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: cp.packageColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{cp.packageName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(cp.totalSessions, 10) }, (_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < cp.usedSessions ? 'bg-success' : 'bg-bg-tertiary'}`} />
                            ))}
                          </div>
                          <span className={`text-[10px] font-bold ${remaining <= 2 ? 'text-warning' : 'text-text-muted'}`}>{remaining}/{cp.totalSessions}</span>
                        </div>
                      </div>
                      <button type="button" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const matchingTreatment = treatments.find(t =>
                          cp.packageName.toLowerCase().includes(t.name.toLowerCase()) ||
                          t.name.toLowerCase().includes(cp.packageName.toLowerCase().split(' ').slice(0, 2).join(' '))
                        );
                        const t = matchingTreatment || treatments[0];
                        if (t) addService(t);
                        setNotes(`📦 Seduta da pacchetto: ${cp.packageName} (${remaining} rimanenti)`);
                      }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold hover:bg-accent/90 transition-colors whitespace-nowrap cursor-pointer z-10">
                        <Package className="w-3 h-3" /> Usa seduta
                      </button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-text-muted italic">La seduta verrà scalata solo quando l&apos;appuntamento sarà completato.</p>
              </div>
            )}

            {/* Treatments (uno o più) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">Trattamenti *</label>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                  <button type="button" onClick={() => setGender('female')}
                    className={`px-2.5 py-1 transition-colors ${gender === 'female' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>♀ Donna</button>
                  <button type="button" onClick={() => setGender('male')}
                    className={`px-2.5 py-1 transition-colors ${gender === 'male' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>♂ Uomo</button>
                </div>
              </div>

              {/* Lista trattamenti aggiunti */}
              {selectedServices.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {selectedServices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/20">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-text-primary flex-1 truncate">{s.treatmentName}</span>
                      <span className="text-xs text-text-muted flex-shrink-0">{s.gender === 'male' ? '♂' : '♀'} {s.duration}min · {formatCurrency(s.price)}</span>
                      <button type="button" onClick={() => removeService(i)} className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ricerca per aggiungere un altro trattamento */}
              <div className="relative">
                <input type="text" value={treatmentQuery}
                  onChange={e => { setTreatmentQuery(e.target.value); setTreatmentOpen(true); }}
                  onFocus={() => setTreatmentOpen(true)}
                  onBlur={() => setTimeout(() => setTreatmentOpen(false), 150)}
                  placeholder={selectedServices.length > 0 ? 'Aggiungi un altro trattamento...' : 'Cerca o scrivi il trattamento...'}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                {treatmentOpen && (() => {
                  const q = treatmentQuery.trim().toLowerCase();
                  const list = (q ? treatments.filter(t => t.name.toLowerCase().includes(q)) : treatments).slice(0, 50);
                  return (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-bg-secondary border border-border shadow-xl">
                      {list.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-text-muted">Nessun trattamento trovato</div>
                      ) : list.map(t => {
                        const ct = selectedClient?.customTreatments?.find(c => c.treatmentId === t.id);
                        const dur = ct ? ct.duration : genderDuration(t);
                        const pr = ct ? ct.price : genderPrice(t);
                        return (
                          <button key={t.id} type="button" onMouseDown={e => e.preventDefault()}
                            onClick={() => addService(t)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                            <span className="text-sm text-text-primary flex-1 truncate">{t.name}{ct ? ' ✨' : ''}</span>
                            <span className="text-xs text-text-muted flex-shrink-0">{dur}min · {formatCurrency(pr)}</span>
                            <Plus className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Totale quando c'è più di un trattamento */}
              {selectedServices.length > 1 && (
                <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20">
                  <span className="text-xs font-semibold text-accent">{selectedServices.length} trattamenti</span>
                  <span className="text-sm font-bold text-accent">{totalDuration} min • {formatCurrency(totalPrice)}</span>
                </div>
              )}
            </div>
            {/* Operator */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Operatrice *</label>
              <div className="grid grid-cols-5 gap-2">
                {operators.map(op => {
                  const off = !operatorWorksOn(op, selectedDate);
                  return (
                  <button key={op.id} type="button" disabled={off} onClick={() => !off && setSelectedOperatorId(op.id)}
                    title={off ? 'A riposo in questa data' : ''}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${off ? 'opacity-40 cursor-not-allowed border-border' : selectedOperatorId === op.id ? 'border-accent bg-accent/10' : 'border-border hover:border-border-light'}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: op.color }}>{getInitials(op.firstName, op.lastName)}</div>
                    <span className="text-[11px] text-text-primary truncate w-full text-center">{op.firstName}{off ? ' (riposo)' : ''}</span>
                  </button>
                  );
                })}
              </div>
            </div>
            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Data</label>
                <input type="date" value={dateStr} readOnly className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Ora Inizio *</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  {Array.from({ length: (END_HOUR - START_HOUR) * 4 }, (_, i) => { const t = START_HOUR*60+i*15; const h=String(Math.floor(t/60)).padStart(2,'0'); const m=String(t%60).padStart(2,'0'); return <option key={i} value={`${h}:${m}`}>{h}:{m}</option>; })}
                </select>
              </div>
            </div>
            {selectedServices.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm text-text-secondary">Fine prevista: <strong className="text-text-primary">{endTime}</strong> ({totalDuration} min) • <strong className="text-text-primary">{formatCurrency(totalPrice)}</strong></span>
              </div>
            )}
            {isOccupied && !editingAppointment && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-error/10 border border-error/20">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-error">Orario Occupato</p>
                  <p className="text-xs text-text-secondary mt-0.5">Questa fascia oraria è già occupata. Vuoi mettere la cliente in lista d'attesa?</p>
                </div>
              </div>
            )}
            
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note interne sull'appuntamento..." rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30 flex justify-between gap-2 flex-shrink-0">
            {isOccupied && !editingAppointment ? (
              <button onClick={handleWaitlist} disabled={!selectedClientName || selectedServices.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors">
                <ListTodo className="w-4 h-4" /> Metti in Lista d'Attesa
              </button>
            ) : <div />}
            
            <div className="flex gap-2">
              <button onClick={closeAppointmentModal} className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                Annulla
              </button>
              <button onClick={handleSave} disabled={!canSave || (isOccupied && !editingAppointment)} className={`px-5 py-2 rounded-xl text-white text-sm font-medium transition-all ${canSave && !(isOccupied && !editingAppointment) ? 'gradient-accent shadow-lg shadow-accent/20' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                {editingAppointment ? 'Salva Modifiche' : 'Crea Appuntamento'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddClientModal && (
          <AddClientModal 
            onClose={() => setShowAddClientModal(false)}
            onSave={(data) => {
              addClient(data);
              setShowAddClientModal(false);
              // We could automatically select the new client here, but since the mock ID isn't returned, 
              // the user can just search for them. In a real app we'd get the ID back and set it.
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
/* ========== DETAIL PANEL ========== */
function DetailPanel({ appointment, onClose, onEdit, onStatusChange, onDelete }: {
  appointment: Appointment; onClose: () => void; onEdit: (a: Appointment) => void;
  onStatusChange: (id: string, status: Appointment['status']) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scaledPkgId, setScaledPkgId] = useState<string | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const usePackageSession = usePackageStore(s => s.useSession);
  const allClientPkgs = usePackageStore(s => s.clientPackages);
  const allClients = useClientStore(s => s.clients);
  
  // Match by normalized name (word-order agnostic)
  const normalize = (n: string) => n.toLowerCase().trim().split(/\s+/).sort().join(' ');
  const targetName = normalize(appointment.clientName);
  
  const clientData = allClients.find(c => 
    normalize(c.firstName + ' ' + c.lastName) === targetName ||
    (c.firstName + ' ' + c.lastName).toLowerCase().includes(appointment.clientName.toLowerCase()) ||
    appointment.clientName.toLowerCase().includes((c.firstName + ' ' + c.lastName).toLowerCase())
  );
  const clientPkgs = allClientPkgs.filter(
    cp => (normalize(cp.clientName) === targetName ||
           cp.clientName.toLowerCase().includes(appointment.clientName.toLowerCase()) ||
           appointment.clientName.toLowerCase().includes(cp.clientName.toLowerCase())) &&
          (cp.status === 'active' || cp.status === 'expiring')
  );

  const packagesWithDebt = clientPkgs.filter(cp => cp.remainingBalance > 0);

  const processCheckout = () => {
    const isPackageSession = appointment.notes?.includes('📦 Seduta da pacchetto');
    onStatusChange(appointment.id, 'completed');

    if (isPackageSession) {
      const matchingPkg = clientPkgs.find(cp =>
        appointment.notes?.includes(cp.packageName) &&
        cp.usedSessions < cp.totalSessions
      );
      if (matchingPkg) {
        usePackageSession(matchingPkg.id, appointment.operatorName, `Completato: ${appointment.treatmentName}`);
        setScaledPkgId(matchingPkg.id);
      }
      onClose();
    } else {
      onClose();
      const params = new URLSearchParams({
        client: appointment.clientName,
        treatment: appointment.treatmentName,
        treatmentId: appointment.treatmentId,
        price: String(appointment.price),
        operator: appointment.operatorName,
      });
      router.push(`/dashboard/pos?${params.toString()}`);
    }
  };

  const handleCheckoutClick = () => {
    if (packagesWithDebt.length > 0) {
      setShowDebtModal(true);
    } else {
      processCheckout();
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-bg-secondary border-l border-border z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-display font-semibold text-text-primary">Dettaglio Appuntamento</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><XCircle className="w-5 h-5" /></button>
          </div>
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${getStatusColor(appointment.status)}15`, color: getStatusColor(appointment.status) }}>
              {statusIcons[appointment.status]}{getStatusLabel(appointment.status)}
            </span>
          </div>
          <div className="bg-bg-tertiary rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: appointment.color }}>
                {appointment.clientName.split(' ').map(n => n[0]).join('')}
              </div>
              <div><p className="font-medium text-text-primary">{appointment.clientName}</p><p className="text-xs text-text-secondary">Cliente</p></div>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: appointment.color }} />
              <div><p className="text-sm font-medium text-text-primary">{appointment.treatmentName}</p><p className="text-xs text-text-secondary">{appointment.duration} minuti</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Orario</p><p className="text-sm font-medium text-text-primary">{appointment.startTime} - {appointment.endTime}</p></div>
              <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Prezzo</p><p className="text-sm font-medium text-text-primary">{formatCurrency(appointment.price)}</p></div>
            </div>
            <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Operatrice</p><p className="text-sm font-medium text-text-primary">{appointment.operatorName}</p></div>
            {appointment.notes && <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Note Appuntamento</p><p className="text-sm text-text-primary">{appointment.notes}</p></div>}
            
            {clientData?.notes && (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning/80 mb-1">Note Cliente</p>
                <p className="text-sm font-medium text-warning">{clientData.notes}</p>
              </div>
            )}
          </div>

          {/* ===== PACCHETTI ATTIVI (info) ===== */}
          {clientPkgs.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">📦 Pacchetti Attivi</p>
              <div className="space-y-2">
                {clientPkgs.map(cp => {
                  const remaining = cp.totalSessions - cp.usedSessions;
                  const isPackageAppt = appointment.notes?.includes(cp.packageName);
                  return (
                    <div key={cp.id} className={`rounded-xl border p-3 ${isPackageAppt ? 'border-accent/40 bg-accent/5' : 'border-border bg-bg-tertiary/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-6 rounded-full" style={{ backgroundColor: cp.packageColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{cp.packageName}</p>
                          <p className="text-[10px] text-text-muted">Scadenza: {cp.expiryDate}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${remaining <= 2 ? 'text-warning' : 'text-text-primary'}`}>{remaining}/{cp.totalSessions}</p>
                          <p className="text-[9px] text-text-muted">rimanenti</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: Math.min(cp.totalSessions, 12) }, (_, i) => (
                          <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < cp.usedSessions ? 'bg-success' : 'bg-bg-tertiary'}`} />
                        ))}
                      </div>
                      {isPackageAppt && (
                        <p className="text-[10px] text-accent font-semibold mt-1.5">✓ Questo appuntamento usa una seduta di questo pacchetto</p>
                      )}
                    </div>
                  );
                })}
                {scaledPkgId && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 text-success text-xs font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" /> Seduta scalata con successo!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {appointment.status === 'completed' ? (
            /* Appuntamento chiuso e pagato: NESSUNA modifica possibile (protezione anti-frode) */
            <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-success/5 border border-success/20">
              <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Appuntamento completato e pagato</p>
                <p className="text-xs text-text-muted mt-0.5">L&apos;appuntamento è chiuso e non può più essere modificato, annullato o eliminato.</p>
              </div>
            </div>
          ) : (
          <div className="space-y-2">
            {!['in_progress', 'in_cabin'].includes(appointment.status) && (
              <button onClick={() => onEdit(appointment)} className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Modifica Appuntamento
              </button>
            )}

            {/* Status buttons */}
            <p className="text-xs text-text-muted pt-2 pb-1">Cambia stato:</p>
            <div className="grid grid-cols-2 gap-2">
              {(appointment.status === 'in_progress' || appointment.status === 'in_cabin') ? (
                <button onClick={handleCheckoutClick}
                  className="col-span-2 py-2.5 rounded-xl text-sm font-medium transition-colors bg-success/10 text-success hover:bg-success/20">
                  <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Check-out</span>
                </button>
              ) : (
                <>
                  <button onClick={() => { onStatusChange(appointment.id, 'in_cabin'); onClose(); }}
                    className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-pink-500/10 text-pink-400 hover:bg-pink-500/20">
                    <span className="flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5" /> Check-in</span>
                  </button>
                  <button onClick={() => { onStatusChange(appointment.id, 'no_show'); onClose(); }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${appointment.status === 'no_show' ? 'bg-error/20 text-error ring-1 ring-error/30' : 'bg-error/10 text-error hover:bg-error/20'}`}>
                    <span className="flex items-center justify-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> No-Show</span>
                  </button>
                </>
              )}

              <button onClick={() => { onStatusChange(appointment.id, 'cancelled'); onClose(); }}
                className={`col-span-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${appointment.status === 'cancelled' ? 'bg-bg-tertiary text-text-muted ring-1 ring-border' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                <span className="flex items-center justify-center gap-1.5"><Ban className="w-3.5 h-3.5" /> Annulla</span>
              </button>
            </div>

            {/* Delete */}
            {!['in_progress', 'in_cabin'].includes(appointment.status) && (
              <div className="pt-3 border-t border-border mt-4">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { onDelete(appointment.id); onClose(); }}
                      className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors">
                      Conferma Eliminazione
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="w-full py-2.5 rounded-xl border border-error/20 text-error text-sm font-medium hover:bg-error/5 transition-colors">
                    Elimina Appuntamento
                  </button>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </motion.div>

      {showDebtModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDebtModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md z-10">
            <div className="flex items-center gap-3 mb-4 text-warning">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-display font-bold">Attenzione: Debiti in sospeso</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              La cliente <strong className="text-text-primary">{appointment.clientName}</strong> ha delle rate in sospeso.
            </p>
            
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto">
              {packagesWithDebt.map(pkg => (
                <div key={pkg.id} className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
                  <p className="text-sm font-semibold text-text-primary mb-1">{pkg.packageName}</p>
                  <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Totale Pacchetto:</span>
                    <span>{formatCurrency(pkg.pricePaid)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-success mb-1">
                    <span>Pagato finora:</span>
                    <span>{formatCurrency(pkg.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-error mt-2 pt-2 border-t border-border/50">
                    <span>Da pagare:</span>
                    <span>{formatCurrency(pkg.remainingBalance)}</span>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => {
                      setShowDebtModal(false);
                      const params = new URLSearchParams({
                        client: appointment.clientName,
                        treatment: `Rata Pacchetto: ${pkg.packageName}`,
                        price: String(pkg.remainingBalance),
                        operator: appointment.operatorName || 'Staff',
                        debtPkgId: pkg.id,
                      });
                      router.push(`/dashboard/pos?${params.toString()}`);
                    }} className="flex-1 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors flex items-center justify-center gap-1">
                      <Euro className="w-3.5 h-3.5" /> Registra Pagamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setShowDebtModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                Annulla
              </button>
              <button onClick={() => {
                setShowDebtModal(false);
                processCheckout();
              }} className="flex-1 py-2.5 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-bg-hover transition-colors">
                Salta per oggi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

/* ========== MAIN PAGE ========== */
export default function AgendaPage() {
  const {
    appointments, blocks, selectedDate, view, selectedOperatorIds,
    setView, goToToday, goToPrev, goToNext, setSelectedDate,
    openAppointmentModal, isAppointmentModalOpen, moveAppointment,
    updateAppointment, deleteAppointment, addAppointment, fetchAppointments,
    fetchBlocks, addBlock, removeBlock,
    setSelectedOperatorIds,
  } = useAgendaStore();
  const operators = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);
  const fetchClients = useClientStore(s => s.fetchClients);
  const fetchTreatments = useTreatmentStore(s => s.fetchTreatments);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchAppointments();
    fetchBlocks();
    fetchOperators();
    fetchClients();
    fetchTreatments();
  }, [fetchAppointments, fetchBlocks, fetchOperators, fetchClients, fetchTreatments]);

  // Mantiene il filtro operatrici allineato alle operatrici esistenti:
  // rimuove gli id di operatrici eliminate e mostra automaticamente le nuove.
  useEffect(() => {
    const existingIds = operators.map(o => o.id);
    const pruned = selectedOperatorIds.filter(id => existingIds.includes(id));
    const missing = existingIds.filter(id => !selectedOperatorIds.includes(id));
    if (missing.length > 0 || pruned.length !== selectedOperatorIds.length) {
      setSelectedOperatorIds([...pruned, ...missing]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operators]);

  // Waitlist state
  const { entries: waitlistEntries, updateStatus: updateWaitlistStatus, addEntry: addWaitlistEntry } = useWaitlistStore();
  const [showWaitlistPanel, setShowWaitlistPanel] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistPreFill, setWaitlistPreFill] = useState<Partial<WaitlistEntry>>({});

  // Add Client Modal state
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const addClient = useClientStore(s => s.addClient);

  const matchingWaitlists = useMemo(() => {
    return waitlistEntries.filter(e => {
      if (e.status !== 'waiting') return false;
      
      const eStart = timeToMinutes(e.startTime);
      const eEnd = eStart + e.duration;

      if (e.operatorId) {
        const hasConflict = appointments.some(a => 
          a.date === e.date && a.operatorId === e.operatorId &&
          !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
        );
        return !hasConflict;
      } else {
        const isFree = operators.some(op => {
          const hasConflict = appointments.some(a => 
            a.date === e.date && a.operatorId === op.id &&
            !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
          );
          return !hasConflict;
        });
        return isFree;
      }
    });
  }, [waitlistEntries, appointments]);

  const handleOpenWaitlistModal = (prefill: Partial<WaitlistEntry> = {}) => {
    setWaitlistPreFill(prefill);
    setShowWaitlistModal(true);
  };

  const visibleOperators = useMemo(
    () => operators.filter(op => selectedOperatorIds.includes(op.id)),
    [selectedOperatorIds, operators]
  );

  const operatorColorById = useMemo(() => {
    const map: Record<string, string> = {};
    operators.forEach(op => { map[op.id] = op.color; });
    return map;
  }, [operators]);

  const dateStr = fmtDate(selectedDate);

  const todayAppointments = useMemo(
    () => appointments.filter(a => a.date === dateStr),
    [appointments, dateStr]
  );

  const todayBlocks = useMemo(
    () => blocks.filter(b => b.date === dateStr),
    [blocks, dateStr]
  );

  const handleAppointmentClick = useCallback((apt: Appointment) => setSelectedApt(apt), []);

  const handleWaitlistAdd = useCallback((apt: Appointment) => {
    handleOpenWaitlistModal({
      clientName: '',
      treatmentId: '',
      treatmentName: '',
      duration: 60,
      date: apt.date,
      startTime: apt.startTime,
      operatorId: apt.operatorId,
    });
  }, []);

  const handleDayClick = useCallback((d: Date) => {
    setSelectedDate(d);
    setView('day');
  }, [setSelectedDate, setView]);

  const handleEdit = useCallback((apt: Appointment) => {
    setSelectedApt(null);
    openAppointmentModal(apt);
  }, [openAppointmentModal]);

  const totalApts = todayAppointments.length;
  const completedApts = todayAppointments.filter(a => a.status === 'completed').length;
  const revenue = todayAppointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').reduce((s, a) => s + a.price, 0);

  const handleSlotBlock = useCallback((operatorId: string, hour: number) => {
    const op = operators.find(o => o.id === operatorId);
    const reason = window.prompt(
      `Blocca la fascia ${String(hour).padStart(2, '0')}:00 – ${String(hour + 1).padStart(2, '0')}:00 di ${op?.firstName || 'questa operatrice'}.\n\nMotivo (es. Pausa, Chiuso, Riunione):`,
      'Pausa'
    );
    if (reason === null) return; // annullato
    addBlock({
      operatorId,
      date: dateStr,
      startTime: `${String(hour).padStart(2, '0')}:00`,
      endTime: `${String(hour + 1).padStart(2, '0')}:00`,
      reason: reason.trim() || 'Bloccato',
    });
  }, [operators, dateStr, addBlock]);

  const handleRemoveBlock = useCallback((block: AgendaBlock) => {
    if (window.confirm(`Sbloccare la fascia ${block.startTime}–${block.endTime}${block.reason ? ` (${block.reason})` : ''}?`)) {
      removeBlock(block.id);
    }
  }, [removeBlock]);

  // Header label
  const headerLabel = useMemo(() => {
    if (view === 'day') return formatDateLong(dateStr);
    if (view === 'month') return `${MONTH_NAMES_IT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    // week
    const d = new Date(selectedDate);
    const dow = (d.getDay() + 6) % 7;
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.getDate()} - ${sun.getDate()} ${MONTH_NAMES_IT[sun.getMonth()]} ${sun.getFullYear()}`;
  }, [view, selectedDate, dateStr]);

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} className="p-2 rounded-xl hover:bg-bg-hover border border-border text-text-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={goToToday} className="px-3 py-2 rounded-xl hover:bg-bg-hover border border-border text-sm font-medium text-text-primary transition-colors">Oggi</button>
          <button onClick={goToNext} className="p-2 rounded-xl hover:bg-bg-hover border border-border text-text-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
          <div className="relative ml-2">
            <button onClick={() => setShowDatePicker(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-bg-hover transition-colors group"
              title="Clicca per scegliere la data">
              <h2 className="text-base font-display font-semibold text-text-primary capitalize">{headerLabel}</h2>
              <CalendarDays className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
            </button>
            {showDatePicker && (
              <MiniDatePicker
                selectedDate={selectedDate}
                onPick={(d) => { setSelectedDate(d); if (view === 'month') setView('day'); }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'day' && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-bg-tertiary text-xs text-text-secondary"><CalendarDays className="w-3.5 h-3.5" /> {totalApts} app.</span>
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success-bg text-xs text-success"><CheckCircle className="w-3.5 h-3.5" /> {completedApts} compl.</span>
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/10 text-xs text-accent" title="Incasso stimato della giornata">Incasso stimato: € {revenue.toLocaleString('it-IT')}</span>
            </div>
          )}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(['day','week','month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${view === v ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'}`}>
                {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setShowWaitlistPanel(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-medium text-sm transition-all
              ${matchingWaitlists.length > 0 ? 'bg-warning text-white border-warning shadow-glow animate-pulse' : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover'}
            `}
          >
            <ListTodo className="w-4 h-4" />
            <span className="hidden sm:inline">Clienti in attesa</span>
            {matchingWaitlists.length > 0 && <span className="bg-white text-warning w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">{matchingWaitlists.length}</span>}
          </button>

          <button onClick={() => setShowAddClientModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-all">
            <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Nuovo Cliente</span>
          </button>

          <button onClick={() => openAppointmentModal()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuovo Appuntamento</span>
          </button>
        </div>
      </div>

      {/* Views */}
      {view === 'day' && (
        <DayView appointments={todayAppointments} blocks={todayBlocks} operators={visibleOperators} selectedDate={selectedDate} onAppointmentClick={handleAppointmentClick} onWaitlistAdd={handleWaitlistAdd}
          onSlotBlock={handleSlotBlock} onRemoveBlock={handleRemoveBlock}
          onSlotClick={(operatorId, hour) => {
            // Parte dal primo orario libero all'interno/dopo la fascia cliccata
            let startMin = hour * 60;
            const dayAppts = todayAppointments.filter(a => a.operatorId === operatorId && a.status !== 'cancelled' && a.status !== 'no_show');
            let moved = true;
            while (moved) {
              moved = false;
              for (const a of dayAppts) {
                const aS = timeToMinutes(a.startTime), aE = timeToMinutes(a.endTime);
                if (startMin >= aS && startMin < aE) { startMin = aE; moved = true; }
              }
            }
            const h = String(Math.floor(startMin / 60)).padStart(2, '0');
            const m = String(startMin % 60).padStart(2, '0');
            openAppointmentModal(null, { operatorId, time: `${h}:${m}` });
          }}
          onDropAppointment={(aptId, opId, newStart, duration) => {
            const [h, m] = newStart.split(':').map(Number);
            const endTotal = h * 60 + m + duration;
            const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
            moveAppointment(aptId, opId, newStart, endTime);
          }} />
      )}
      {view === 'week' && (
        <WeekView selectedDate={selectedDate} allAppointments={appointments} operatorColorById={operatorColorById} onAppointmentClick={handleAppointmentClick} onDayClick={handleDayClick} />
      )}
      {view === 'month' && (
        <MonthView selectedDate={selectedDate} allAppointments={appointments} operatorColorById={operatorColorById} onAppointmentClick={handleAppointmentClick} onDayClick={handleDayClick} />
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedApt && <DetailPanel appointment={selectedApt} onClose={() => setSelectedApt(null)} onEdit={handleEdit}
          onStatusChange={(id, status) => updateAppointment(id, { status })}
          onDelete={(id) => deleteAppointment(id)} />}
      </AnimatePresence>

      {/* Appointment Modal */}
      <AnimatePresence>
        {isAppointmentModalOpen && <AppointmentModal onOpenWaitlist={handleOpenWaitlistModal} />}
      </AnimatePresence>

      {/* Waitlist Modals & Panels */}
      <AnimatePresence>
        {showWaitlistModal && <WaitlistModal onClose={() => setShowWaitlistModal(false)} initialData={waitlistPreFill} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAddClientModal && (
          <AddClientModal 
            onClose={() => setShowAddClientModal(false)}
            onSave={(data) => {
              addClient(data);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWaitlistPanel && <WaitlistPanel onClose={() => setShowWaitlistPanel(false)} onOpenNew={() => { setShowWaitlistPanel(false); handleOpenWaitlistModal(); }} />}
      </AnimatePresence>
    </div>
  );
}
