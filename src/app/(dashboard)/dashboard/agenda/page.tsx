'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useClientStore } from '@/stores/useClientStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { anteprimaCandidate, lanciaCopriBuchi } from '@/app/actions/copriBuchi';
import type { Candidata } from '@/lib/copriBuchi';
import { usePackageStore } from '@/stores/usePackageStore';
import { coperturaPacchetto } from '@/lib/coperturaPacchetto';
import { useWaitlistStore, WaitlistEntry } from '@/stores/useWaitlistStore';
import { Appointment, AppointmentService, AgendaBlock, Operator, Treatment, Product, Client } from '@/types';
import {
  ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Plus,
  Clock, CheckCircle, Check, CalendarCheck, AlertCircle, Play, XCircle, Ban, ListTodo,
  Lock, X, Search, UserCircle, Minus, Package, Sparkles, AlertTriangle, Euro, UserPlus, Settings, Moon, Smartphone, Sun, MessageSquare, Users, Crown
, Loader2 } from 'lucide-react';
import {
  formatDateLong, timeToMinutes, minutesToTime, getStatusLabel,
  getStatusColor, formatCurrency, getInitials, getCategoryLabel, guessGenderFromName,
} from '@/lib/helpers';
import { resolveTreatmentForPackage } from '@/lib/packageTreatment';
import { GIFT_OPTIONS, isGiftPackage } from '@/lib/giftOptions';
import { changeGiftTreatment } from '@/app/actions/packages';
import { type WeekScheduleMap } from '@/app/actions/weekShifts';
import { resolveDaySchedule, mondayISO } from '@/lib/weekSchedule';
import { isWalkIn, oraDiAdesso } from '@/lib/walkIn';
import { schedaCompleta, campiMancanti } from '@/lib/schedaCliente';
import { todayRome } from '@/lib/date';
import { clientiTop } from '@/app/actions/clientiTop';
import { chiaveNome, riassunto, type ClienteTop } from '@/lib/clientiTop';
import { sedutaIncassata } from '@/app/actions/daIncassare';
import { useCabinStore } from '@/stores/useCabinStore';
import { useProductStore } from '@/stores/useProductStore';
import { appointmentsForOperator, servicesOf, serviceOperatorId, hasMultipleOperators, type SplitAppointment } from '@/lib/appointmentSplit';
import { useWeekShiftsStore } from '@/stores/useWeekShiftsStore';
import CabinCountdown from '@/components/CabinCountdown';
import WaitlistModal from '@/components/WaitlistModal';
import WaitlistPanel from '@/components/WaitlistPanel';
import AddClientModal from '@/components/AddClientModal';
import { NO_AUTOFILL } from '@/lib/noAutofill';

/** Mostra in chiaro il rifiuto del server (es. cliente doppione). */
function avvisaErroreCliente(e: unknown) {
  const msg = e instanceof Error ? e.message : '';
  alert(msg.includes('CLIENTE_DOPPIONE')
    ? msg.replace('CLIENTE_DOPPIONE: ', '')
    : 'Salvataggio del cliente non riuscito. Riprova.');
}

/**
 * La misura di ogni comando della barra: stessa altezza, stesso raggio, e mai
 * a capo. È una costante e non tre classi copiate perché basta che uno dei
 * tasti abbia un padding diverso e la fila si vede storta.
 */
const BTN = 'inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all';

/** Il tasto con la sola icona: stessa altezza, quadrato, nome nel title. */
const ICONA = 'inline-flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 transition-colors';

const HOUR_HEIGHT = 88;
const START_HOUR = 8;
const END_HOUR = 24; // agenda aperta fino a mezzanotte
const TOTAL_HOURS = END_HOUR - START_HOUR;

/*
  La spunta verde vuol dire UNA cosa sola: fatto.

  Prima "confermato" e "completato" avevano la stessa identica spunta e
  cambiava solo la sfumatura del grigio-verde: guardando l'agenda non si
  capiva quali clienti erano già passate. Ora il prenotato ha l'icona del
  calendario in grigio (c'è, deve ancora venire) e il completato la spunta
  verde piena.
*/
const statusIcons: Record<string, React.ReactNode> = {
  confirmed: <CalendarCheck className="w-3 h-3" />,
  pending: <AlertCircle className="w-3 h-3" />,
  in_progress: <Play className="w-3 h-3" />,
  in_cabin: <Sparkles className="w-3 h-3" />,
  completed: <SpuntaVerde />,
  no_show: <XCircle className="w-3 h-3" />,
  cancelled: <Ban className="w-3 h-3" />,
  waitlist: <ListTodo className="w-3 h-3" />,
};

/** Pallino verde pieno con la spunta bianca: si vede anche di sfuggita. */
function SpuntaVerde() {
  return (
    <span className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-success text-white flex-shrink-0" title="Completato">
      <Check className="w-2.5 h-2.5" strokeWidth={4} />
    </span>
  );
}

const WEEK_DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTH_NAMES_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Ultima cabina usata su questo dispositivo: la proponiamo già pronta al check-in
const LAST_CABIN_KEY = 'revo_ultima_cabina';

/* ========== APPOINTMENT BLOCK (Day View) ========== */
// Verifica se un'operatrice lavora in una certa data, in base al turno settimanale
// (schedule keyed 1=Lun .. 6=Sab; domenica salone chiuso).
// weekMap è la mappa dei turni della settimana mostrata (opId -> {dow -> turno}).
function operatorWorksOn(op: Operator, date: Date, weekMap?: Record<string, WeekScheduleMap>): boolean {
  const dow = date.getDay(); // 0=Domenica .. 6=Sabato
  if (dow === 0) return false; // domenica il centro è chiuso
  if (op.isResource) return true; // le cabine/risorse sono sempre disponibili negli altri giorni
  const day = resolveDaySchedule(weekMap, op, date);
  if (!day) return true; // nessun turno impostato: assume operativa
  return day.isWorking !== false;
}

// Fasce in cui l'operatrice NON è in servizio in quel giorno: prima dell'inizio
// turno, dopo la fine, e durante la pausa. Restituisce minuti-dall'inizio-agenda.
interface UnavailBand { startMin: number; endMin: number; label: string; kind: 'fuori' | 'pausa'; }
function operatorUnavailableBands(op: Operator, date: Date, weekMap?: Record<string, WeekScheduleMap>): UnavailBand[] {
  if (op.isResource) return [];
  const day = resolveDaySchedule(weekMap, op, date);
  if (!day || day.isWorking === false) return []; // riposo gestito a parte
  const bands: UnavailBand[] = [];
  const dayStart = START_HOUR * 60;
  const dayEnd = END_HOUR * 60;
  const toMin = (t?: string) => (t && /^\d{1,2}:\d{2}$/.test(t) ? timeToMinutes(t) : null);

  const start = toMin(day.startTime);
  const end = toMin(day.endTime);
  // Prima dell'inizio turno
  if (start != null && start > dayStart) {
    bands.push({ startMin: dayStart - dayStart, endMin: start - dayStart, label: 'Fuori orario', kind: 'fuori' });
  }
  // Dopo la fine turno
  if (end != null && end < dayEnd) {
    bands.push({ startMin: end - dayStart, endMin: dayEnd - dayStart, label: 'Fuori orario', kind: 'fuori' });
  }
  // Pausa
  const bStart = toMin(day.breakStart);
  const bEnd = toMin(day.breakEnd);
  if (bStart != null && bEnd != null && bEnd > bStart) {
    bands.push({ startMin: bStart - dayStart, endMin: bEnd - dayStart, label: 'Pausa', kind: 'pausa' });
  }
  return bands.filter(b => b.endMin > b.startMin);
}

/** true se l'orario (minuti dall'inizio agenda) cade in una fascia non disponibile. */
function isMinuteUnavailable(op: Operator, date: Date, minFromStart: number, weekMap?: Record<string, WeekScheduleMap>): boolean {
  return operatorUnavailableBands(op, date, weekMap).some(b => minFromStart >= b.startMin && minFromStart < b.endMin);
}

/**
 * Cosa si sta trascinando, in un posto solo.
 *
 * Non è uno stato di React apposta: cambia decine di volte al secondo mentre
 * il mouse si muove, e passarlo per `setState` ridisegnerebbe tutta l'agenda
 * a ogni pixel — che è esattamente il lampeggio che si vedeva.
 *
 * `presaY` è dove hai afferrato il blocco rispetto al suo bordo alto: senza,
 * l'appuntamento atterra con l'inizio sotto il cursore e quindi salta in su
 * di quanto l'avevi preso più in basso.
 */
const trascinamento = {
  attivo: false, presaY: 0, durata: 60,
  /** Vero se si sta trascinando la fetta di un appuntamento diviso. */
  fetta: false,
  /** Inizio della fetta e inizio dell'appuntamento intero, per calcolare lo spostamento. */
  inizioFetta: '', inizioIntero: '', durataIntera: 60,
};

function AppointmentBlock({ appointment, onClick, onWaitlistAdd, overlapStyle, color, coccolare }: { appointment: SplitAppointment; onClick: (a: Appointment) => void; onWaitlistAdd?: (a: Appointment) => void; overlapStyle?: React.CSSProperties; color?: string; /** Fra le clienti che spendono di più: va trattata col guanto. */ coccolare?: { speso: number; visite: number; posizione: number } }) {
  const pacchettiCliente = usePackageStore(s => s.clientPackages);
  const blockColor = color || appointment.color;
  const startMin = timeToMinutes(appointment.startTime) - START_HOUR * 60;
  const endMin = timeToMinutes(appointment.endTime) - START_HOUR * 60;
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 18);
  const isSmall = height < 44;

  // Quanto deve pagare la cliente, sempre in chiaro sul blocco: prima si vedeva
  // solo sugli appuntamenti abbastanza alti e solo se il prezzo era maggiore di
  // zero, così i trattamenti brevi e quelli inclusi in un pacchetto sembravano
  // senza importo e bisognava aprirli uno per uno per saperlo.
  const copertura = coperturaPacchetto(appointment, pacchettiCliente);
  const prezzoBreve = appointment.price > 0
    // Anche nei riquadri stretti: "45 €/80 €" dice subito che non è tutto il conto
    ? (appointment.parziale && appointment.totaleAppuntamento
        ? `${formatCurrency(appointment.price)}/${formatCurrency(appointment.totaleAppuntamento)}`
        : formatCurrency(appointment.price))
    : copertura ? copertura.titolo : formatCurrency(0);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('appointmentId', appointment.id);
    e.dataTransfer.setData('duration', String(appointment.duration));
    e.dataTransfer.effectAllowed = 'move';
    trascinamento.attivo = true;
    trascinamento.durata = appointment.duration;
    trascinamento.fetta = Boolean(appointment.parziale);
    trascinamento.inizioFetta = appointment.startTime;
    trascinamento.inizioIntero = appointment.inizioReale || appointment.startTime;
    trascinamento.durataIntera = appointment.durataReale || appointment.duration;
    trascinamento.presaY = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    document.body.classList.add('trascinando');
  };
  const handleDragEnd = () => {
    trascinamento.attivo = false;
    document.body.classList.remove('trascinando');
  };

  /**
   * Cosa non si sposta: il già completato e quello col lucchetto.
   *
   * Un appuntamento completato è storia: spostarlo sposterebbe anche
   * l'incasso di giornata. Le fette degli appuntamenti divisi invece sì:
   * prima erano ferme e alla pressione il browser selezionava il testo,
   * che è il modo peggiore di dire "non si può".
   */
  const isFrozen = Boolean(appointment.isLocked) || appointment.status === 'completed';
  const motivoFermo = appointment.isLocked
    ? 'Appuntamento bloccato: togli il lucchetto per spostarlo'
    : appointment.status === 'completed'
      ? 'Già completato: non si sposta, sposterebbe anche l\'incasso di giornata'
      : '';

  return (
    <div
      draggable={!isFrozen}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={motivoFermo || undefined}
      onClick={(e) => { e.stopPropagation(); onClick(appointment); }}
      className={`appointment-block group ${isFrozen ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${appointment.status === 'in_cabin' ? 'animate-[pulse_1.5s_ease-in-out_infinite] ring-2 ring-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : ''}`}
      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: `${blockColor}22`, borderLeftColor: blockColor, ...overlapStyle }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0">
          <span style={{ color: getStatusColor(appointment.status) }}>{statusIcons[appointment.status]}</span>
          <span className={`font-semibold text-text-primary truncate ${isSmall ? 'text-[10px]' : 'text-xs'}`}>{appointment.clientName}</span>
          {/* La corona è per chi tiene in piedi il centro: chi sta in cabina
              deve saperlo prima di iniziare, non scoprirlo dopo. */}
          {coccolare && (
            <Crown className="w-3 h-3 text-warning flex-shrink-0"
              // Il titolo dice il perché: una corona senza numeri è un vezzo.
              aria-label="Cliente da coccolare" />
          )}
          {appointment.parziale && (
            <Users className="w-3 h-3 text-text-muted flex-shrink-0" />
          )}
          <CabinCountdown appointment={appointment} />
        </div>
        <div className="flex items-center gap-1">
          {isSmall && (
            <span className={`text-[10px] font-semibold flex-shrink-0 ${appointment.price > 0 ? 'text-text-primary' : 'text-accent'}`}>
              {prezzoBreve}
            </span>
          )}
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
            {appointment.price > 0
              ? (
                  // Fetta di un appuntamento diviso: si dice anche il conto intero,
                  // altrimenti si legge 45 € e si incassa meno del dovuto
                  appointment.parziale && appointment.totaleAppuntamento
                    ? <span className="ml-auto font-medium text-text-primary" title={`Questa parte vale ${formatCurrency(appointment.price)}. Il conto completo della cliente è ${formatCurrency(appointment.totaleAppuntamento)}.`}>
                        {formatCurrency(appointment.price)} <span className="text-text-muted font-normal">di {formatCurrency(appointment.totaleAppuntamento)}</span>
                      </span>
                    : <span className="ml-auto font-medium text-text-primary">{formatCurrency(appointment.price)}</span>
                )
              : copertura
                ? <span className="ml-auto font-medium text-accent" title={copertura.etichetta}>
                    {copertura.titolo} · {copertura.rimaste} {copertura.rimaste === 1 ? 'seduta' : 'sedute'}
                  </span>
                : <span className="ml-auto font-medium text-text-primary">{formatCurrency(0)}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** Quanto ha prodotto un'operatrice nella giornata mostrata. */
export interface IncassoOperatrice {
  /** Già fatto: appuntamenti chiusi. */
  incassato: number;
  /** Ancora da fare: prenotati e non ancora completati. */
  daIncassare: number;
  clienti: number;
  completati: number;
}

/**
 * Conta solo le fette di appuntamento di QUESTA operatrice.
 *
 * Su un appuntamento diviso in due (l'acrygel a Michela, la pedicure a
 * Veronica) sommare il prezzo intero a tutte e due gonfierebbe la giornata del
 * doppio. Annullati e no show restano fuori: non li incassa nessuno.
 */
function incassoDelGiorno(fette: SplitAppointment[]): IncassoOperatrice {
  let incassato = 0, daIncassare = 0, completati = 0;
  const clienti = new Set<string>();
  for (const a of fette) {
    if (a.status === 'cancelled' || a.status === 'no_show') continue;
    clienti.add(a.clientId || a.clientName);
    if (a.status === 'completed') { incassato += a.price; completati += 1; }
    else daIncassare += a.price;
  }
  return { incassato, daIncassare, clienti: clienti.size, completati };
}

/**
 * Incasso previsto di una giornata: tutto quello che non è stato disdetto.
 *
 * "Previsto" e non "incassato": comprende gli appuntamenti ancora da fare, che
 * è quello che serve guardando un mese avanti. Le disdette e i mancati arrivi
 * restano fuori, altrimenti il mese sembrerebbe più ricco di com'è.
 */
function incassoPrevisto(apts: { status: string; price: number }[]): number {
  return apts.reduce(
    (s, a) => (a.status === 'cancelled' || a.status === 'no_show' ? s : s + (a.price || 0)),
    0,
  );
}

/** Euro corti, per gli spazi stretti del calendario: "315 €". */
function eurCorto(n: number): string {
  return `${Math.round(n).toLocaleString('it-IT')} €`;
}

/**
 * L'importo dentro alla casella di un calendario: pochi millimetri, niente
 * decimali e niente simbolo. Sopra il migliaio si accorcia ("1,2k"), se no
 * "1.245" sfonda la casella e diventa illeggibile proprio nei giorni pieni.
 */
function euroFitto(n: number): string {
  const v = Math.round(n);
  if (v >= 1000) {
    const k = v / 1000;
    return `${k.toFixed(k >= 10 ? 0 : 1).replace('.', ',')}k`;
  }
  return String(v);
}

function OperatorColumnHeader({ operator, off, incasso }: {
  operator: Operator;
  off?: boolean;
  incasso: IncassoOperatrice;
}) {
  const isResource = !!operator.isResource;
  const [mostra, setMostra] = useState(false);
  const totale = incasso.incassato + incasso.daIncassare;

  return (
    <div
      className="sticky top-0 z-20 border-b-2 px-3 py-3 flex items-center gap-2.5 cursor-help"
      onMouseEnter={() => setMostra(true)}
      onMouseLeave={() => setMostra(false)}
      style={{
        backgroundColor: off ? undefined : `${operator.color}14`,
        borderBottomColor: off ? 'var(--border)' : operator.color,
      }}
    >
      {/* Il conto della giornata: si apre passandoci sopra, così la testata
          resta pulita ma il numero è a un movimento di mouse. */}
      {mostra && (
        <div className="absolute left-2 right-2 top-full mt-1 z-40 rounded-xl border border-border bg-bg-secondary shadow-xl p-3 space-y-1.5 cursor-default">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            {operator.firstName} · oggi
          </p>
          {totale === 0 ? (
            <p className="text-xs text-text-muted">Nessun appuntamento in programma.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-text-secondary">Incassato</span>
                <span className="text-base font-bold text-success">{formatCurrency(incasso.incassato)}</span>
              </div>
              {incasso.daIncassare > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-text-secondary">Ancora da fare</span>
                  <span className="text-sm font-semibold text-text-primary">{formatCurrency(incasso.daIncassare)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 pt-1.5 border-t border-border">
                <span className="text-xs text-text-secondary">Totale giornata</span>
                <span className="text-sm font-bold text-text-primary">{formatCurrency(totale)}</span>
              </div>
              <p className="text-[11px] text-text-muted pt-0.5">
                {incasso.clienti} client{incasso.clienti === 1 ? 'e' : 'i'} · {incasso.completati} completat{incasso.completati === 1 ? 'o' : 'i'}
              </p>
              <p className="text-[10px] text-text-muted/80 leading-snug">
                Su un appuntamento diviso conta solo la parte che fa {operator.firstName}.
              </p>
            </>
          )}
        </div>
      )}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${off ? 'opacity-40 grayscale' : 'shadow-sm'}`} style={{ backgroundColor: operator.color }}>
        {isResource ? <Sun className="w-4 h-4" /> : getInitials(operator.firstName, operator.lastName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${off ? 'text-text-muted' : 'text-text-primary'}`}>{operator.firstName}</p>
        <p className="text-[11px] text-text-muted truncate">{isResource ? 'Cabina · senza operatrice' : operator.lastName}</p>
      </div>
      {isResource ? (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-bold border border-accent/20 flex-shrink-0">
          Cabina
        </span>
      ) : off && (
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
/** Lo spazio più corto che vale la pena segnalare, e il più lungo. */
const BUCO_MIN = 15;
const BUCO_MAX = 600;

/**
 * I vuoti fra un appuntamento e l'altro nella colonna di un'operatrice.
 *
 * Occupato è tutto: appuntamenti, fasce bloccate, pausa e fuori turno. Quello
 * che resta è tempo vendibile, e va segnato ovunque sia: l'ora vuota di
 * apertura vale quanto la mezz'ora incastrata a metà pomeriggio.
 */
function buchiDellaGiornata(
  appuntamenti: SplitAppointment[],
  fasceBloccate: AgendaBlock[],
  fasceNonInServizio: { startMin: number; endMin: number }[],
): { from: number; to: number }[] {
  const occupati: { from: number; to: number }[] = [];
  for (const a of appuntamenti) {
    if (a.status === 'cancelled' || a.status === 'no_show') continue;
    occupati.push({ from: timeToMinutes(a.startTime), to: timeToMinutes(a.endTime) });
  }
  for (const b of fasceBloccate) {
    occupati.push({ from: timeToMinutes(b.startTime), to: timeToMinutes(b.endTime) });
  }
  for (const f of fasceNonInServizio) {
    // Le fasce arrivano in minuti dall'inizio agenda, gli orari in minuti dalla mezzanotte.
    occupati.push({ from: f.startMin + START_HOUR * 60, to: f.endMin + START_HOUR * 60 });
  }
  if (occupati.length < 2) return [];

  occupati.sort((x, y) => x.from - y.from || x.to - y.to);

  const buchi: { from: number; to: number }[] = [];
  let fine = occupati[0].to;
  for (let i = 1; i < occupati.length; i++) {
    const o = occupati[i];
    if (o.from > fine) {
      const durata = o.from - fine;
      // Ogni spazio libero dentro il turno, non solo quello fra due
      // appuntamenti: anche l'ora vuota di apertura è un'ora vendibile.
      if (durata >= BUCO_MIN && durata <= BUCO_MAX) {
        buchi.push({ from: fine, to: o.from });
      }
      fine = o.to;
    } else if (o.to > fine) {
      fine = o.to;
    }
  }
  return buchi;
}

function DayView({ appointments, blocks, operators, selectedDate, coccole, onAppointmentClick, onWaitlistAdd, onSlotClick, onGapClick, onOffriBuco, onSlotBlock, onRemoveBlock, onDropAppointment }: {
  /** Chi spende di più, per nome: sul blocco diventa una corona. */
  coccole?: Map<string, { speso: number; visite: number; posizione: number }>;
  appointments: Appointment[]; blocks: AgendaBlock[]; operators: Operator[]; selectedDate: Date;
  onAppointmentClick: (a: Appointment) => void;
  onWaitlistAdd?: (a: Appointment) => void;
  onSlotClick: (operatorId: string, hour: number) => void;
  /** Clic su un vuoto: apre l'appuntamento esattamente a quell'ora. */
  onGapClick: (operatorId: string, time: string) => void;
  /** Offri il vuoto alle clienti su WhatsApp (Copri buchi). */
  onOffriBuco?: (b: {
    date: string; from: string; to: string;
    operatorId: string; operatorName: string;
    treatment: Treatment; durata: number;
  }) => void;
  onSlotBlock: (operatorId: string, hour: number) => void;
  onRemoveBlock: (block: AgendaBlock) => void;
  /** `mantieniOperatrice` per le fette: cambia l'orario, non chi fa cosa. */
  onDropAppointment: (aptId: string, operatorId: string, newStart: string, duration: number, mantieniOperatrice?: boolean) => void;
}) {
  const trattamenti = useTreatmentStore(s => s.treatments);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  const [dragOver, setDragOver] = useState<{ operatorId: string; time: string } | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Turni della settimana mostrata (ogni settimana ha i suoi orari)
  const weekStart = mondayISO(selectedDate);
  const weekMap = useWeekShiftsStore(s => s.byWeek[weekStart]);
  const fetchWeek = useWeekShiftsStore(s => s.fetchWeek);
  useEffect(() => { fetchWeek(weekStart, true); }, [weekStart, fetchWeek]);

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

  // Ogni colonna mostra la parte di appuntamento che tocca a quell'operatrice:
  // se l'acrygel è di Michela e la pedicure di Veronica, tutte e due vedono
  // occupato solo il proprio pezzo e nessuno ci prenota sopra.
  const byOperator = useMemo(() => {
    const map: Record<string, SplitAppointment[]> = {};
    operators.forEach(op => { map[op.id] = appointmentsForOperator(appointments, op.id); });
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
    // Meno il punto in cui l'hai afferrato: l'appuntamento deve finire dove
    // lo vedi, non con l'inizio incollato al cursore.
    const y = e.clientY - rect.top - trascinamento.presaY;
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
    // Solo quando cambia davvero: `dragover` scatta a ogni pixel e un
    // setState per pixel ridisegna l'intera agenda (il lampeggio).
    setDragOver(prec => (prec && prec.operatorId === operatorId && prec.time === time)
      ? prec : { operatorId, time });
  };

  /**
   * Trascinamento finito.
   *
   * Se la destinazione è fuori turno, in pausa o nel giorno di riposo NON si
   * rifiuta più in silenzio: era l'ultimo posto dove il gestionale diceva di
   * no senza spiegare, e da fuori sembrava che l'appuntamento fosse bloccato.
   * Si chiede conferma e si sposta lo stesso.
   */
  const handleDrop = (e: React.DragEvent, operatorId: string, columnEl: HTMLElement) => {
    e.preventDefault();
    const appointmentId = e.dataTransfer.getData('appointmentId');
    const duration = Number(e.dataTransfer.getData('duration')) || 60;
    if (!appointmentId) return;
    const time = calcTimeFromY(e, columnEl);
    setDragOver(null);

    const op = operators.find(o => o.id === operatorId);
    const riposo = op ? !operatorWorksOn(op, selectedDate, weekMap) : false;
    const fuori = op && !op.isResource && !riposo
      && isMinuteUnavailable(op, selectedDate, timeToMinutes(time) - START_HOUR * 60, weekMap);

    if (op && !op.isResource && (riposo || fuori)) {
      trascinamento.attivo = false;
      document.body.classList.remove('trascinando');
      const scarto = timeToMinutes(time) - timeToMinutes(trascinamento.inizioFetta);
      setConfermaSpostamento({
        appointmentId, operatorId,
        time: trascinamento.fetta
          ? minutesToTime(Math.max(0, timeToMinutes(trascinamento.inizioIntero) + scarto))
          : time,
        duration: trascinamento.fetta ? trascinamento.durataIntera : duration,
        mantieni: trascinamento.fetta,
        nome: `${op.firstName} ${op.lastName}`.trim(),
        motivo: riposo ? 'è il suo giorno di riposo' : 'a quell\'ora non è in servizio',
      });
      return;
    }
    trascinamento.attivo = false;
    document.body.classList.remove('trascinando');
    if (trascinamento.fetta) {
      // Si sposta l'appuntamento intero dello stesso scarto, e le operatrici
      // restano quelle: chi fa cosa si cambia dal dettaglio, non trascinando.
      const scarto = timeToMinutes(time) - timeToMinutes(trascinamento.inizioFetta);
      const nuovoInizio = minutesToTime(Math.max(0, timeToMinutes(trascinamento.inizioIntero) + scarto));
      onDropAppointment(appointmentId, operatorId, nuovoInizio, trascinamento.durataIntera, true);
      return;
    }
    onDropAppointment(appointmentId, operatorId, time, duration);
  };

  /** Spostamento in attesa di conferma, perché finisce fuori dal turno. */
  const [confermaSpostamento, setConfermaSpostamento] = useState<{
    appointmentId: string; operatorId: string; time: string; duration: number;
    nome: string; motivo: string;
    /** Vero per le fette: si sposta l'orario ma le operatrici non si toccano. */
    mantieni?: boolean;
  } | null>(null);

  // Ghost preview position
  const dragGhostTop = dragOver ? (() => {
    const [h, m] = dragOver.time.split(':').map(Number);
    return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
  })() : 0;

  return (
    <div ref={scrollRef} className="agenda-giorno select-none flex-1 overflow-auto border border-border rounded-2xl bg-bg-secondary relative">
      {/* Fuori turno si può, ma va detto: durante il trascinamento non si
          può mostrare un avviso, quindi lo si chiede appena mollato. */}
      {confermaSpostamento && (
        <div className="sticky top-0 z-[70] flex justify-center pt-3 px-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-bg-secondary border border-warning/40 shadow-2xl max-w-lg">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
            <p className="text-sm text-text-primary flex-1">
              <strong>{confermaSpostamento.nome}</strong> {confermaSpostamento.motivo}.
              Sposto lo stesso alle {confermaSpostamento.time}?
            </p>
            <button onClick={() => setConfermaSpostamento(null)}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
              No
            </button>
            <button onClick={() => {
                onDropAppointment(confermaSpostamento.appointmentId, confermaSpostamento.operatorId,
                  confermaSpostamento.time, confermaSpostamento.duration, confermaSpostamento.mantieni);
                setConfermaSpostamento(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-warning text-white text-xs font-semibold hover:brightness-110">
              Sposta
            </button>
          </div>
        </div>
      )}
      <div className="flex min-w-0">
        <TimeGutter />
        {operators.map(operator => {
          const off = !operatorWorksOn(operator, selectedDate, weekMap);
          return (
          <div key={operator.id} className="flex-1 min-w-[160px] border-r border-border/50 last:border-r-0 relative">
            <OperatorColumnHeader operator={operator} off={off}
              incasso={incassoDelGiorno(byOperator[operator.id] || [])} />
            <div className="relative"
              style={off ? {
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0, rgba(148,163,184,0.10) 10px, rgba(148,163,184,0.02) 10px, rgba(148,163,184,0.02) 20px)',
              } : { backgroundColor: `${operator.color}08` }}
              onDragOver={e => handleDragOver(e, operator.id, e.currentTarget)}
              /* Si azzera SOLO uscendo davvero dalla colonna. `dragleave`
                 scatta anche entrando in un figlio — e dentro una colonna ci
                 sono sedici fasce orarie, gli spazi verdi e gli appuntamenti:
                 il rettangolo di anteprima spariva e ricompariva di continuo,
                 ed è quello che si vedeva lampeggiare. */
              onDragLeave={e => {
                const versoDove = e.relatedTarget as Node | null;
                if (!versoDove || !e.currentTarget.contains(versoDove)) setDragOver(null);
              }}
              onDrop={e => handleDrop(e, operator.id, e.currentTarget)}>
              {/* Le fasce orarie sono cliccabili anche nel giorno di riposo:
                  se la cliente viene lo stesso, l'appuntamento si deve poter
                  scrivere. Ci pensa la finestra ad avvisare. */}
              {hours.map(hour => (
                <div key={hour}
                  onClick={() => handleSlotClickDelayed(operator.id, hour)}
                  onDoubleClick={() => handleSlotDoubleClick(operator.id, hour)}
                  className="border-b-2 border-border relative transition-colors group/slot cursor-pointer hover:bg-accent/[0.03]"
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
              {/* Fasce fuori orario e pausa (dal turno dell'operatrice) */}
              {!off && operatorUnavailableBands(operator, selectedDate, weekMap).map((band, bi) => {
                const top = (band.startMin / 60) * HOUR_HEIGHT;
                const h = Math.max(((band.endMin - band.startMin) / 60) * HOUR_HEIGHT, 20);
                const isPausa = band.kind === 'pausa';
                // La fascia grigia si vede ma non ferma il clic: qui sotto c'è
                // lo slot, e un appuntamento fuori turno si può prendere — è
                // la finestra ad avvisare prima di salvare.
                return (
                  <div key={`unavail-${bi}`}
                    className="absolute left-0 right-0 z-[5] pointer-events-none flex flex-col items-center justify-center text-center overflow-hidden"
                    style={{
                      top: `${top}px`, height: `${h}px`,
                      backgroundImage: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.16) 0, rgba(148,163,184,0.16) 10px, rgba(148,163,184,0.04) 10px, rgba(148,163,184,0.04) 20px)',
                    }}>
                    {h >= 34 && (
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        {isPausa ? <Clock className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                        <span className="text-[11px] font-bold">{isPausa ? 'Pausa' : 'Fuori orario'}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* I vuoti fra un appuntamento e l'altro: mezz'ora qui e mezz'ora
                  là, a fine giornata è un'ora di lavoro persa. Segnati con
                  quanto durano e con cosa ci sta dentro; un clic apre già
                  l'appuntamento a quell'ora esatta. */}
              {!off && buchiDellaGiornata(
                byOperator[operator.id] || [],
                (blocksByOperator[operator.id] || []),
                operatorUnavailableBands(operator, selectedDate, weekMap),
              ).map(buco => {
                const durata = buco.to - buco.from;
                const top = ((buco.from - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                const h = (durata / 60) * HOUR_HEIGHT;
                const ora = `${String(Math.floor(buco.from / 60)).padStart(2, '0')}:${String(buco.from % 60).padStart(2, '0')}`;
                // Cosa ci sta: prima i più lunghi, che sfruttano meglio il buco.
                const ciStanno = trattamenti
                  .filter(t => (t.duration || 0) > 0 && (t.duration || 0) <= durata)
                  .sort((a, b) => (b.duration || 0) - (a.duration || 0));
                const titolo = ciStanno.length
                  ? `${durata} minuti disponibili dalle ${ora}. Ci stanno: ${ciStanno.slice(0, 4).map(t => `${t.name} (${t.duration}′)`).join(', ')}${ciStanno.length > 4 ? '…' : ''}. Clicca per prenotare.`
                  : `${durata} minuti disponibili dalle ${ora}. Nessun trattamento a listino così breve.`;
                // Verde, non viola: il viola è il colore degli appuntamenti e
                // il tratteggio si confondeva con le prenotazioni. Il verde
                // dice "libero" prima ancora di leggere.
                return (
                  <div key={`buco-${buco.from}`} onClick={e => { e.stopPropagation(); onGapClick(operator.id, ora); }}
                    title={titolo}
                    className="group/buco absolute left-1 right-1 z-[2] rounded-lg border border-dashed border-success/50 bg-success/[0.07]
                      hover:bg-success/20 hover:border-success transition-colors cursor-pointer
                      flex flex-col items-center justify-center gap-0.5 overflow-hidden"
                    style={{ top: `${top}px`, height: `${Math.max(h - 2, 14)}px` }}>
                    <span className="text-[10px] font-semibold text-success whitespace-nowrap">{durata} min disponibili</span>
                    {h >= 46 && ciStanno.length > 0 && (
                      <span className="text-[9px] text-text-muted truncate max-w-full px-2">ci sta {ciStanno[0].name}</span>
                    )}
                    {/* Offrirlo alle clienti invece di aspettare che chiami
                        qualcuno: compare passandoci sopra, per non riempire
                        l'agenda di bottoni. */}
                    {h >= 40 && ciStanno.length > 0 && onOffriBuco && (
                      <button
                        onClick={e => { e.stopPropagation(); onOffriBuco({
                          date: fmtDate(selectedDate), from: ora, to: `${String(Math.floor(buco.to / 60)).padStart(2, '0')}:${String(buco.to % 60).padStart(2, '0')}`,
                          operatorId: operator.id, operatorName: `${operator.firstName} ${operator.lastName}`.trim(),
                          treatment: ciStanno[0], durata,
                        }); }}
                        title="Offri questo posto alle clienti su WhatsApp"
                        className="absolute right-1 top-1 opacity-0 group-hover/buco:opacity-100 transition-opacity
                          px-1.5 py-0.5 rounded-md bg-success text-white text-[9px] font-bold whitespace-nowrap">
                        Copri
                      </button>
                    )}
                  </div>
                );
              })}

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
                  style={{ top: `${dragGhostTop}px`, height: `${Math.max((trascinamento.durata / 60) * HOUR_HEIGHT - 2, 22)}px` }}>
                  <span className="text-[10px] font-semibold text-accent">{dragOver.time}</span>
                </div>
              )}
              {(() => {
                const operatorApts = byOperator[operator.id] || [];
                // Sort by start time
                const sorted = [...operatorApts].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
                
                // Group overlapping
                const overlappingGroups: SplitAppointment[][] = [];
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

                /*
                  Appuntamenti accavallati: a scaletta, non a colonnine.
                  Dividere la colonna in due faceva due strisce strette e
                  illeggibili anche per dieci minuti di sovrapposizione. Qui
                  restano larghi quasi quanto la colonna: chi comincia dopo si
                  sposta un po' a destra e passa davanti, con un'ombra che dice
                  che sta sopra. Il primo resta leggibile perché il secondo
                  comincia più in basso, e passandoci sopra col mouse quello
                  che tocchi torna davanti a tutti.
                */
                return overlappingGroups.flatMap(group => {
                  // Chi comincia prima sta sotto; a parità di orario sta sotto
                  // il più lungo, così il breve non finisce sepolto.
                  const ordinati = [...group].sort((a, b) =>
                    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                    || (timeToMinutes(b.endTime) - timeToMinutes(b.startTime))
                       - (timeToMinutes(a.endTime) - timeToMinutes(a.startTime))
                  );
                  const cols = ordinati.length;
                  // Lo scalino si stringe se ce ne sono tanti: l'ultimo non
                  // deve mai ridursi a una fettina.
                  const passo = cols > 1 ? Math.min(14, 42 / (cols - 1)) : 0;
                  return ordinati.map((apt, index) => {
                    const overlapStyle: React.CSSProperties = cols > 1 ? {
                      left: `calc(${index * passo}% + 4px)`,
                      right: '4px',
                      width: 'auto',
                      zIndex: 10 + index,
                      // Sovrapposti servono pieni: con lo sfondo trasparente si
                      // vedeva in trasparenza quello sotto e diventava una macchia.
                      backgroundColor: `color-mix(in srgb, ${operator.color || apt.color} 15%, var(--color-bg-secondary))`,
                      boxShadow: index > 0 ? '-8px 0 14px -6px rgba(0,0,0,0.45)' : undefined,
                    } : {};

                    return (
                      <AppointmentBlock
                        key={apt.id}
                        appointment={apt}
                        onClick={onAppointmentClick}
                        onWaitlistAdd={onWaitlistAdd}
                        overlapStyle={overlapStyle}
                        color={operator.color}
                        coccolare={coccole?.get(apt.clientName.trim().toLowerCase().replace(/\s+/g, ' '))}
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
    // Lun-Sab: la domenica il centro è chiuso
    return Array.from({ length: 6 }, (_, i) => {
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
                    {/* Il totale della giornata, non quanti ne restano fuori:
                        "+3 altri" costringeva a sommarli a mente per sapere se
                        il 12 agosto è pieno o vuoto. Accanto l'incasso
                        previsto: è il numero per cui si guarda il mese. */}
                    {dayApts.length > 0 && (
                      <p className="text-[10px] px-1 pt-0.5 flex items-baseline justify-between gap-1">
                        <span className="font-semibold text-text-secondary">
                          {dayApts.length} appuntament{dayApts.length === 1 ? 'o' : 'i'}
                        </span>
                        <span className="font-bold text-accent whitespace-nowrap">
                          {eurCorto(incassoPrevisto(dayApts))}
                        </span>
                      </p>
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

/* ========== CERCA CLIENTE (dalla barra dell'agenda) ========== */

/**
 * "Questa signora quando doveva venire?"
 *
 * Prima si rispondeva sfogliando l'agenda giorno per giorno. Qui si scrivono
 * tre lettere, si sceglie il nome e si legge subito il prossimo appuntamento —
 * senza cercare niente.
 *
 * La ricerca ignora l'ordine delle parole ("caruso anna" trova "Anna Caruso"),
 * gli accenti e le maiuscole: chi sta al banco scrive di fretta.
 */
function normalizza(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function CercaCliente({ clients, appointments, onApriAppuntamento, onVaiAlGiorno }: {
  clients: Client[];
  appointments: Appointment[];
  onApriAppuntamento: (a: Appointment) => void;
  onVaiAlGiorno: (date: string) => void;
}) {
  const [testo, setTesto] = useState('');
  const [aperto, setAperto] = useState(false);
  const [scelto, setScelto] = useState<Client | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Clic fuori: si chiude, come ogni menu a tendina.
  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAperto(false);
    };
    document.addEventListener('mousedown', fuori);
    return () => document.removeEventListener('mousedown', fuori);
  }, [aperto]);

  const suggerimenti = useMemo(() => {
    const q = normalizza(testo);
    if (q.length < 2) return [];
    const parole = q.split(/\s+/);
    return clients
      .filter(c => {
        const campo = normalizza(`${c.firstName} ${c.lastName} ${c.phone || ''}`);
        return parole.every(p => campo.includes(p));
      })
      // Chi INIZIA con quello che si sta scrivendo viene prima: cercando "ann"
      // si vuole Annarita, non Gianluca Annunziata solo perché è alfabetico.
      .sort((a, b) => {
        const inizia = (c: Client) =>
          normalizza(c.firstName).startsWith(parole[0]) || normalizza(c.lastName).startsWith(parole[0]) ? 0 : 1;
        return inizia(a) - inizia(b)
          || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      })
      .slice(0, 8);
  }, [testo, clients]);

  /** Gli appuntamenti del cliente scelto: prima i prossimi, poi gli ultimi fatti. */
  const suoi = useMemo(() => {
    if (!scelto) return { prossimi: [] as Appointment[], passati: [] as Appointment[] };
    const oggi = fmtDate(new Date());
    const miei = appointments
      .filter(a => a.clientId === scelto.id && a.status !== 'cancelled')
      .sort((x, y) => (x.date + x.startTime).localeCompare(y.date + y.startTime));
    return {
      prossimi: miei.filter(a => a.date >= oggi),
      passati: miei.filter(a => a.date < oggi).slice(-3).reverse(),
    };
  }, [scelto, appointments]);

  const chiudi = () => { setAperto(false); setScelto(null); setTesto(''); };

  return (
    // È l'elemento elastico della barra: si allarga se c'è spazio e si
    // stringe quando serve, così tutto il resto resta su una riga sola senza
    // che nessun tasto debba sparire.
    <div ref={boxRef} className="relative flex-1 min-w-[7rem] max-w-[18rem]">
      {/* Stessa altezza dei tasti accanto: è un comando come gli altri. */}
      <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border bg-bg-secondary
        focus-within:border-accent/50 transition-colors">
        <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          value={testo}
          onChange={e => { setTesto(e.target.value); setScelto(null); setAperto(true); }}
          onFocus={() => setAperto(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') chiudi();
            // Invio con un solo risultato: si apre quello, senza toccare il mouse.
            if (e.key === 'Enter' && suggerimenti.length === 1) { setScelto(suggerimenti[0]); setAperto(true); }
          }}
          placeholder="Cerca cliente…"
          className="w-full min-w-0 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
          {...NO_AUTOFILL}
        />
        {!!testo && (
          <button onClick={chiudi} className="text-text-muted hover:text-text-primary flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aperto && (testo.trim().length >= 2 || scelto) && (
        <div className="absolute right-0 top-full mt-1.5 w-[22rem] max-w-[90vw] z-50 rounded-2xl border border-border
          bg-bg-secondary shadow-2xl overflow-hidden">
          {!scelto ? (
            suggerimenti.length === 0 ? (
              <p className="px-4 py-4 text-sm text-text-muted">Nessun cliente con questo nome.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
                {suggerimenti.map(c => (
                  <button key={c.id} onClick={() => setScelto(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-bg-hover transition-colors">
                    <p className="text-sm font-medium text-text-primary">{c.firstName} {c.lastName}</p>
                    {c.phone && <p className="text-[11px] text-text-muted font-mono">{c.phone}</p>}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div>
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">{scelto.firstName} {scelto.lastName}</p>
                  {scelto.phone && <p className="text-[11px] text-text-muted font-mono">{scelto.phone}</p>}
                </div>
                <button onClick={() => setScelto(null)} className="text-[11px] text-accent font-medium">Cambia</button>
                <button onClick={chiudi} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>

              <div className="px-4 py-3 space-y-2 max-h-80 overflow-y-auto">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Prossimi appuntamenti
                </p>
                {suoi.prossimi.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Nessun appuntamento in programma.
                  </p>
                ) : suoi.prossimi.map(a => (
                  <button key={a.id} onClick={() => { onApriAppuntamento(a); chiudi(); }}
                    className="w-full text-left p-2.5 rounded-xl border border-accent/30 bg-accent/5 hover:border-accent/60 transition-colors">
                    <p className="text-sm font-semibold text-text-primary capitalize">
                      {formatDateLong(a.date)} · {a.startTime}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">{a.treatmentName} · {a.operatorName}</p>
                  </button>
                ))}

                {suoi.passati.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider pt-1">Ultime volte</p>
                    {suoi.passati.map(a => (
                      <button key={a.id} onClick={() => { onVaiAlGiorno(a.date); chiudi(); }}
                        className="w-full text-left p-2 rounded-xl border border-border hover:bg-bg-hover transition-colors">
                        <p className="text-xs text-text-secondary capitalize">
                          {formatDateLong(a.date)} · {a.startTime} — {a.treatmentName}
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== OFFRI IL BUCO ALLE CLIENTI (Copri buchi) ========== */
/**
 * Prima di mandare messaggi si vede chi li riceverebbe e quanto costano.
 *
 * Mandare a dieci persone costa poco, ma è pur sempre denaro e soprattutto è
 * la pazienza delle clienti: chi decide deve vedere i nomi, non premere al
 * buio un tasto che "fa marketing".
 */
function OffriBucoModal({ buco, onClose }: {
  buco: { date: string; from: string; to: string; operatorId: string; operatorName: string; treatment: Treatment; durata: number };
  onClose: () => void;
}) {
  const [dati, setDati] = useState<{ candidate: Candidata[]; blocco: number; attesa: number; maxGiri: number } | null>(null);
  const [trattamento, setTrattamento] = useState<Treatment>(buco.treatment);
  const [invio, setInvio] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; msg: string } | null>(null);
  const treatments = useTreatmentStore(s => s.treatments);

  // Solo i trattamenti che ci stanno nel buco: offrirne uno più lungo
  // vorrebbe dire far arrivare una cliente per poi mandarla via.
  const possibili = useMemo(
    () => treatments.filter(t => (t.duration || 0) > 0 && (t.duration || 0) <= buco.durata)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0)),
    [treatments, buco.durata],
  );

  useEffect(() => {
    let vivo = true;
    setDati(null);
    anteprimaCandidate({
      date: buco.date, from: buco.from, to: buco.to,
      operatorId: buco.operatorId, treatmentName: trattamento.name,
    }).then(d => { if (vivo) setDati(d); });
    return () => { vivo = false; };
  }, [buco.date, buco.from, buco.to, buco.operatorId, trattamento.name]);

  const primoBlocco = dati ? dati.candidate.slice(0, dati.blocco) : [];

  const manda = async () => {
    setInvio(true);
    setEsito(null);
    try {
      const r = await lanciaCopriBuchi({
        date: buco.date, from: buco.from, to: buco.to,
        operatorId: buco.operatorId, operatorName: buco.operatorName,
        treatmentId: trattamento.id, treatmentName: trattamento.name,
        prezzo: trattamento.price || 0,
        origine: 'manuale',
      });
      setEsito(r.ok
        ? { ok: true, msg: `Primo blocco partito: ${r.inviati} messaggi. Il prossimo fra mezz'ora se nessuna risponde.` }
        : { ok: false, msg: r.errore || 'Non è partito niente.' });
    } finally { setInvio(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed inset-0 z-[61] flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-display font-semibold text-text-primary">Copri questo buco</h3>
              <p className="text-xs text-text-muted">
                {buco.from}–{buco.to} · {buco.durata} min · {buco.operatorName}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Cosa offriamo</label>
              <select value={trattamento.id} onChange={e => {
                const t = possibili.find(x => x.id === e.target.value);
                if (t) setTrattamento(t);
              }} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
                {possibili.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {t.duration} min · {t.price} €</option>
                ))}
              </select>
            </div>

            {dati === null ? (
              <p className="text-xs text-text-muted flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> cerco a chi scrivere…</p>
            ) : primoBlocco.length === 0 ? (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-text-secondary">
                Nessuna cliente da contattare: servono clienti attive, con il consenso ai messaggi,
                che non abbiano già un appuntamento quel giorno.
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-1.5">
                    Primo blocco: {primoBlocco.length} client{primoBlocco.length === 1 ? 'e' : 'i'}
                  </p>
                  <div className="rounded-xl border border-border divide-y divide-border/40 max-h-56 overflow-y-auto">
                    {primoBlocco.map(c => (
                      <div key={c.clientId} className="px-3 py-2">
                        <p className="text-sm text-text-primary">{c.nome}</p>
                        <p className="text-[10px] text-text-muted">{c.perche}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Se nessuna risponde, fra {dati.attesa} minuti parte il blocco successivo,
                  fino a {dati.maxGiri} blocchi ({dati.candidate.length} client{dati.candidate.length === 1 ? 'e' : 'i'} disponibili in tutto).
                  Si ferma alla prima che dice sì, e l&apos;appuntamento va in agenda da solo.
                  Costo indicativo del primo blocco: <strong className="text-text-secondary">{(primoBlocco.length * 0.07).toFixed(2)} €</strong>
                  {' '}contro {trattamento.price} € di trattamento.
                </p>
              </>
            )}

            {esito && (
              <div className={`p-3 rounded-xl text-xs ${esito.ok ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {esito.msg}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover">
              {esito?.ok ? 'Chiudi' : 'Annulla'}
            </button>
            {!esito?.ok && (
              <button onClick={manda} disabled={invio || !primoBlocco.length}
                className="px-5 py-2 rounded-xl bg-success text-white text-sm font-medium disabled:opacity-40 hover:brightness-110">
                {invio ? 'Invio…' : `Manda a ${primoBlocco.length}`}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ========== BLOCK MODAL (blocca una fascia oraria da/a) ========== */
function BlockModal({ operatorName, dateLabel, defaultStart, defaultEnd, onClose, onSave }: {
  operatorName: string; dateLabel: string; defaultStart: string; defaultEnd: string;
  onClose: () => void; onSave: (start: string, end: string, reason: string) => void;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [reason, setReason] = useState('Pausa');

  const times = useMemo(() => {
    const arr: string[] = [];
    for (let t = START_HOUR * 60; t <= END_HOUR * 60; t += 15) {
      arr.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    }
    return arr;
  }, []);

  const valid = timeToMinutes(end) > timeToMinutes(start);
  const durationLabel = valid ? (() => {
    const mins = timeToMinutes(end) - timeToMinutes(start);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}min` : ''}`.trim();
  })() : '';

  const PRESETS = ['Pausa', 'Chiuso', 'Riunione', 'Formazione', 'Ferie'];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-slate-500/15 flex items-center justify-center"><Lock className="w-4 h-4 text-slate-500" /></div>
              <div>
                <h3 className="text-base font-display font-semibold text-text-primary">Blocca fascia oraria</h3>
                <p className="text-xs text-text-muted">{operatorName} • {dateLabel}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Dalle</label>
                <select value={start} onChange={e => setStart(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 appearance-none">
                  {times.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Alle</label>
                <select value={end} onChange={e => setEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 appearance-none">
                  {times.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {!valid && <p className="text-xs text-error">L&apos;orario di fine deve essere dopo quello di inizio.</p>}
            {valid && <p className="text-xs text-accent font-medium">Durata blocco: {durationLabel}</p>}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Motivo</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Es. Pausa, Chiuso..."
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setReason(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${reason === p ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={() => { if (valid) { onSave(start, end, reason.trim() || 'Bloccato'); onClose(); } }} disabled={!valid}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${valid ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <Lock className="w-4 h-4" /> Blocca
            </button>
          </div>
        </div>
      </motion.div>
    </>
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

/* ========== INCASSO STIMATO: PERIODO A SCELTA ========== */
// L'incasso stimato non è più legato al solo giorno mostrato in agenda:
// si sceglie un periodo (giorno / settimana / mese / intervallo libero) dal calendario.
type RevenueMode = 'day' | 'week' | 'month' | 'range';
type RevenuePeriod = { mode: RevenueMode; start: string; end: string }; // start/end inclusi, formato YYYY-MM-DD

const REVENUE_MODES: { key: RevenueMode; label: string }[] = [
  { key: 'day', label: 'Giorno' },
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'range', label: 'Intervallo' },
];

function parseDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDaysDate(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeekDate(d: Date) {
  return addDaysDate(d, -((d.getDay() + 6) % 7)); // settimana da lunedì
}
function daysBetween(a: string, b: string) {
  return Math.round((parseDateStr(b).getTime() - parseDateStr(a).getTime()) / 86400000);
}

function periodFor(mode: RevenueMode, d: Date): RevenuePeriod {
  if (mode === 'week') {
    const mon = startOfWeekDate(d);
    return { mode, start: fmtDate(mon), end: fmtDate(addDaysDate(mon, 6)) };
  }
  if (mode === 'month') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { mode, start: fmtDate(first), end: fmtDate(last) };
  }
  return { mode, start: fmtDate(d), end: fmtDate(d) }; // day + range (inizio = fine)
}

function shiftPeriod(p: RevenuePeriod, delta: number): RevenuePeriod {
  const s = parseDateStr(p.start);
  if (p.mode === 'day') return periodFor('day', addDaysDate(s, delta));
  if (p.mode === 'week') return periodFor('week', addDaysDate(s, delta * 7));
  if (p.mode === 'month') return periodFor('month', new Date(s.getFullYear(), s.getMonth() + delta, 1));
  const len = daysBetween(p.start, p.end) + 1; // l'intervallo scorre di tutta la sua durata
  return { mode: 'range', start: fmtDate(addDaysDate(s, delta * len)), end: fmtDate(addDaysDate(parseDateStr(p.end), delta * len)) };
}

function periodLabel(p: RevenuePeriod) {
  const s = parseDateStr(p.start), e = parseDateStr(p.end);
  if (p.start === p.end) return `${s.getDate()} ${MONTH_NAMES_IT[s.getMonth()]} ${s.getFullYear()}`;
  if (p.mode === 'month') return `${MONTH_NAMES_IT[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.getDate()} – ${e.getDate()} ${MONTH_NAMES_IT[e.getMonth()]} ${e.getFullYear()}`;
  return `${s.getDate()} ${MONTH_NAMES_IT[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTH_NAMES_IT[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
}

function periodShortLabel(p: RevenuePeriod) {
  const s = parseDateStr(p.start), e = parseDateStr(p.end);
  if (p.start === p.end) return `${s.getDate()}/${s.getMonth() + 1}`;
  if (p.mode === 'month') return `${MONTH_NAMES_IT[s.getMonth()].slice(0, 3)} ${s.getFullYear()}`;
  return `${s.getDate()}/${s.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1}`;
}

const eur = (n: number) => `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Statistiche del periodo: gli annullati e i no show non entrano nell'incasso stimato.
function computeRevenueStats(appointments: Appointment[], p: RevenuePeriod) {
  const inPeriod = appointments.filter(a => a.date >= p.start && a.date <= p.end);
  const billable = inPeriod.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');
  const total = billable.reduce((s, a) => s + a.price, 0);
  const completed = billable.filter(a => a.status === 'completed');
  const incassato = completed.reduce((s, a) => s + a.price, 0);

  const byDay = new Map<string, { total: number; count: number }>();
  billable.forEach(a => {
    const cur = byDay.get(a.date) ?? { total: 0, count: 0 };
    cur.total += a.price; cur.count += 1;
    byDay.set(a.date, cur);
  });
  const days = [...byDay.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1));

  return {
    total, incassato, daIncassare: total - incassato,
    count: billable.length,
    completedCount: completed.length,
    scartati: inPeriod.length - billable.length,
    days,
    numDays: daysBetween(p.start, p.end) + 1,
    mediaGiorno: days.length > 0 ? total / days.length : 0,
  };
}

function RevenuePanel({ appointments, period, isFollowingAgenda, onChange, onFollowAgenda, onClose }: {
  appointments: Appointment[];
  period: RevenuePeriod;
  isFollowingAgenda: boolean;
  onChange: (p: RevenuePeriod) => void;
  onFollowAgenda: () => void;
  onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const s = parseDateStr(period.start);
    return new Date(s.getFullYear(), s.getMonth(), 1);
  });
  // In modalità intervallo il primo click fissa l'inizio, il secondo la fine.
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = fmtDate(today);
  const stats = useMemo(() => computeRevenueStats(appointments, period), [appointments, period]);

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

  // Incasso per giorno del mese mostrato: serve per il pallino sotto i giorni con appuntamenti
  const monthTotals = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach(a => {
      if (a.status === 'cancelled' || a.status === 'no_show') return;
      map.set(a.date, (map.get(a.date) ?? 0) + a.price);
    });
    return map;
  }, [appointments]);

  const changeMonth = (delta: number) => setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const setMode = (mode: RevenueMode) => {
    setRangeAnchor(null);
    onChange(periodFor(mode, parseDateStr(period.start)));
  };

  const pickDay = (d: Date) => {
    const ds = fmtDate(d);
    if (period.mode !== 'range') { onChange(periodFor(period.mode, d)); return; }
    if (!rangeAnchor) { setRangeAnchor(ds); onChange({ mode: 'range', start: ds, end: ds }); return; }
    const [start, end] = rangeAnchor <= ds ? [rangeAnchor, ds] : [ds, rangeAnchor];
    setRangeAnchor(null);
    onChange({ mode: 'range', start, end });
  };

  const navPeriod = (delta: number) => {
    setRangeAnchor(null);
    const next = shiftPeriod(period, delta);
    onChange(next);
    const s = parseDateStr(next.start);
    setViewMonth(new Date(s.getFullYear(), s.getMonth(), 1));
  };

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className="absolute top-full right-0 mt-2 z-[56] w-[23rem] max-h-[calc(100vh-9rem)] overflow-y-auto bg-bg-secondary border border-border rounded-2xl shadow-2xl p-3"
        onClick={e => e.stopPropagation()}>
        {/* Modalità periodo */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {REVENUE_MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  period.mode === m.key ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted"><X className="w-4 h-4" /></button>
        </div>

        {/* Totale del periodo */}
        <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => navPeriod(-1)} className="p-1 rounded-lg hover:bg-bg-hover text-text-secondary" title="Periodo precedente"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-text-primary capitalize text-center">{periodLabel(period)}</span>
            <button onClick={() => navPeriod(1)} className="p-1 rounded-lg hover:bg-bg-hover text-text-secondary" title="Periodo successivo"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <p className="text-2xl font-display font-bold text-accent text-center">{eur(stats.total)}</p>
          <p className="text-[11px] text-text-muted text-center mt-0.5">
            {stats.count} app. su {stats.numDays} {stats.numDays === 1 ? 'giorno' : 'giorni'}
            {stats.days.length > 1 && ` · media ${eur(stats.mediaGiorno)}/giorno lavorato`}
          </p>
        </div>

        {/* Già incassato / ancora da incassare */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-success-bg p-2">
            <p className="text-[10px] text-text-muted">Completati ({stats.completedCount})</p>
            <p className="text-sm font-semibold text-success">{eur(stats.incassato)}</p>
          </div>
          <div className="rounded-xl bg-bg-tertiary p-2">
            <p className="text-[10px] text-text-muted">Da completare</p>
            <p className="text-sm font-semibold text-text-primary">{eur(stats.daIncassare)}</p>
          </div>
        </div>

        {/* Calendario */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs font-semibold text-text-primary capitalize">{MONTH_NAMES_IT[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS_IT.map(d => <div key={d} className="text-center text-[10px] font-semibold text-text-muted">{d.charAt(0)}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = fmtDate(d);
            const inPeriod = ds >= period.start && ds <= period.end;
            const isEdge = ds === period.start || ds === period.end;
            const soldi = monthTotals.get(ds) ?? 0;
            const hasMoney = soldi > 0;
            return (
              <button key={i} onClick={() => pickDay(d)}
                title={hasMoney ? `${formatDateLong(ds)} · ${eur(soldi)}` : formatDateLong(ds)}
                className={`h-11 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center leading-none gap-0.5 ${
                  isEdge ? 'bg-accent text-white font-bold'
                    : inPeriod ? 'bg-accent/15 text-accent'
                    : ds === todayStr ? 'bg-accent/5 text-accent ring-1 ring-accent/30'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}>
                <span>{d.getDate()}</span>
                {/* L'incasso previsto sotto al giorno: il pallino diceva solo
                    "qui c'è qualcosa", e per sapere quanto bisognava passarci
                    sopra col mouse un giorno per volta. Senza decimali, perché
                    a colpo d'occhio servono le centinaia, non i centesimi. */}
                {hasMoney && (
                  <span className={`text-[9px] font-semibold tabular-nums ${
                    isEdge ? 'text-white/90' : inPeriod ? 'text-accent/80' : 'text-text-muted'
                  }`}>
                    {euroFitto(soldi)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {period.mode === 'range' && (
          <p className="text-[10px] text-text-muted text-center mt-2">
            {rangeAnchor ? 'Ora scegli la data di fine' : 'Clicca la data di inizio, poi quella di fine'}
          </p>
        )}

        {/* Dettaglio giorno per giorno */}
        {stats.days.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Dettaglio giornaliero</p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {stats.days.map(([date, v]) => {
                const dd = parseDateStr(date);
                return (
                  <div key={date} className="flex items-center justify-between text-xs px-2 py-1 rounded-lg hover:bg-bg-hover">
                    <span className="text-text-secondary">
                      {WEEK_DAYS_IT[(dd.getDay() + 6) % 7]} {dd.getDate()}/{dd.getMonth() + 1}
                      <span className="text-text-muted"> · {v.count} app.</span>
                    </span>
                    <span className="font-semibold text-text-primary">{eur(v.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={() => { setRangeAnchor(null); onChange(periodFor(period.mode === 'range' ? 'day' : period.mode, new Date())); setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}
            className="flex-1 py-1.5 rounded-lg bg-bg-tertiary text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
            Oggi
          </button>
          {!isFollowingAgenda && (
            <button onClick={() => { setRangeAnchor(null); onFollowAgenda(); }}
              className="flex-1 py-1.5 rounded-lg bg-bg-tertiary text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
              Segui agenda
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ========== APPOINTMENT MODAL ========== */
function AppointmentModal({ onOpenWaitlist }: { onOpenWaitlist: (prefill: Partial<WaitlistEntry>) => void }) {
  const router = useRouter();
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
  /**
   * Chi ha preso l'appuntamento: la ragazza al banco o al telefono, non chi
   * lo esegue. Sono due cose diverse e finivano confuse in un campo solo.
   */
  const [presaDa, setPresaDa] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [apptDate, setApptDate] = useState(() => fmtDate(selectedDate));
  const [notes, setNotes] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [treatmentQuery, setTreatmentQuery] = useState('');
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [gender, setGender] = useState<'female' | 'male'>('female');
  // avviso quando dal nome del pacchetto non si capisce il trattamento
  const [pkgHint, setPkgHint] = useState('');

  // L'elenco delle clienti si apre appena si tocca il campo, e prima non si
  // poteva più chiudere: restava lì a coprire mezza finestra finché non
  // sceglievi qualcuno. Ora si chiude cliccando fuori o con Esc.
  const clientBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showClientDropdown) return;
    const fuori = (e: MouseEvent) => {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    // In cattura: Esc deve chiudere l'elenco, non la finestra intera.
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setShowClientDropdown(false); }
    };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc, true);
    };
  }, [showClientDropdown]);

  // Riempie il modale SOLO all'apertura (o al cambio di appuntamento/slot).
  // Attenzione: qui dentro non vanno messe in dipendenza liste che arrivano dal
  // server (operatrici, clienti, trattamenti): l'auto-aggiornamento dell'agenda
  // le ricarica ogni 20 secondi con un nuovo array e l'effect ripartirebbe,
  // svuotando il modulo mentre lo si sta compilando.
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
        // Chi l'aveva preso, se era stato segnato (i vecchi hanno 'u1')
        setPresaDa(operators.some(o => o.id === editingAppointment.createdBy) ? editingAppointment.createdBy : '');
        setStartTime(editingAppointment.startTime);
        setApptDate(editingAppointment.date);
        setNotes(editingAppointment.notes || '');
      } else if (slotInfo) {
        setPresaDa('');
        setClientSearch(''); setSelectedClientId(''); setSelectedClientName('');
        setSelectedServices([]); setTreatmentQuery('');
        setSelectedOperatorId(slotInfo.operatorId);
        setStartTime(slotInfo.time);
        setApptDate(fmtDate(selectedDate));
        setNotes('');
      } else {
        setPresaDa('');
        setClientSearch(''); setSelectedClientId(''); setSelectedClientName('');
        setSelectedServices([]); setTreatmentQuery('');
        const firstWorking = operators.find(o => !o.isResource && operatorWorksOn(o, selectedDate, apptWeekMap)) || operators.find(o => !o.isResource) || operators[0];
        setSelectedOperatorId(firstWorking?.id || '');
        /*
          Aprendo "Nuovo appuntamento" senza aver cliccato una fascia, quasi
          sempre la cliente è lì davanti: l'orario parte da adesso, non dalle
          nove di mattina. Se si sta guardando un altro giorno resta l'apertura,
          perché "adesso" su un altro giorno non vuol dire niente.
        */
        const oggi = fmtDate(selectedDate) === fmtDate(new Date());
        setStartTime(oggi ? oraDiAdesso() : '09:00');
        setApptDate(fmtDate(selectedDate)); setNotes('');
      }
      setShowClientDropdown(false);
      setTreatmentOpen(false);
      setPkgHint('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppointmentModalOpen, editingAppointment, slotInfo]);

  // Se le operatrici arrivano dopo l'apertura del modale, sceglie comunque un
  // default — ma tocca solo questo campo, non azzera quello che si è già scritto.
  useEffect(() => {
    if (!isAppointmentModalOpen || editingAppointment || selectedOperatorId) return;
    const firstWorking = operators.find(o => !o.isResource && operatorWorksOn(o, selectedDate, apptWeekMap))
      || operators.find(o => !o.isResource) || operators[0];
    if (firstWorking) setSelectedOperatorId(firstWorking.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppointmentModalOpen, editingAppointment, selectedOperatorId, operators]);

  const allClients = useClientStore(s => s.clients);
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients.slice(0, 5);
    const q = clientSearch.toLowerCase();
    return allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 8);
  }, [clientSearch, allClients]);

  // Active packages for selected client
  const allPkgData = usePackageStore(s => s.clientPackages);
  const catalogPackages = usePackageStore(s => s.packages);
  const ricaricaPacchetti = usePackageStore(s => s.fetchPackages);
  // I pacchetti si ricaricano a OGNI apertura del modale: la lista caricata
  // all'apertura della pagina invecchia, e un pacchetto appena creato (o
  // scalato da un altro computer) non si vedeva finché non si ricaricava tutto.
  useEffect(() => {
    if (isAppointmentModalOpen) void ricaricaPacchetti();
  }, [isAppointmentModalOpen, ricaricaPacchetti]);
  // Pacchetti già in mano alla cliente, da richiamare qui invece di rivenderli.
  // L'abbinamento è sulla scheda cliente quando il pacchetto ce l'ha salvata;
  // i pacchetti vecchi hanno solo il nome scritto a mano, quindi si confronta
  // anche quello ignorando maiuscole e ordine di nome/cognome.
  const clientActivePkgs = useMemo(() => {
    if (!selectedClientName) return [];
    const normalize = (n: string) => n.toLowerCase().trim().split(/\s+/).sort().join(' ');
    const target = normalize(selectedClientName);
    return allPkgData.filter(cp => {
      const stessoCliente = (selectedClientId && cp.clientId === selectedClientId) ||
        normalize(cp.clientName) === target ||
        cp.clientName.toLowerCase().includes(selectedClientName.toLowerCase()) ||
        selectedClientName.toLowerCase().includes(cp.clientName.toLowerCase());
      return stessoCliente && (cp.status === 'active' || cp.status === 'expiring');
    });
  }, [selectedClientName, selectedClientId, allPkgData]);

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
  const addService = (t: Treatment, priceOverride?: number) => {
    const custom = selectedClient?.customTreatments?.find(ct => ct.treatmentId === t.id) || null;
    /*
      La durata segue tre regole, in ordine: il tempo personalizzato di QUESTA
      cliente, poi il tempo di CHI lo esegue (a listino), poi lo standard.
      Senza il passaggio di mezzo, un trattamento aggiunto su una colonna già
      scelta nasceva con la durata standard anche quando quell'operatrice ne
      ha una sua: si sceglieva Luisa e in agenda restavano 50 minuti invece
      dei suoi 40.
    */
    const standard = genderDuration(t);
    const abili = (t.operatorSkills || []).map(k => k.operatorId);
    const puoFarlo = Boolean(selectedOperatorId) && (abili.length === 0 || abili.includes(selectedOperatorId));
    const suoTempo = puoFarlo ? durataPerOperatrice(t.id, selectedOperatorId, standard) : standard;
    const service: AppointmentService = {
      treatmentId: t.id,
      treatmentName: t.name,
      treatmentCategory: t.category,
      duration: custom ? custom.duration : suoTempo,
      price: priceOverride != null ? priceOverride : (custom ? custom.price : genderPrice(t)),
      gender,
      // Se si è cliccato su una colonna, il trattamento nasce già assegnato a
      // lei — ma solo se lo sa fare: altrimenti resta da scegliere, invece di
      // nascere con un'operatrice che poi il menu non mostra nemmeno.
      operatorId: puoFarlo ? selectedOperatorId : undefined,
      operatorName: puoFarlo
        ? (() => { const o = operators.find(x => x.id === selectedOperatorId); return o ? `${o.firstName} ${o.lastName}`.trim() : undefined; })()
        : undefined,
    };
    setSelectedServices(prev => [...prev, service]);
    setTreatmentQuery('');
    setTreatmentOpen(false);
    if (custom?.notes) {
      setNotes(prev => prev.includes(custom.notes!) ? prev : (prev ? prev + '\n' + custom.notes : custom.notes || ''));
    }
  };
  const removeService = (index: number) => setSelectedServices(prev => prev.filter((_, i) => i !== index));

  /**
   * Chi sa fare un trattamento, secondo il listino.
   *
   * Se sul trattamento non è spuntato nessuno, lo fanno tutte: è il caso
   * normale e non deve costringere a compilare centoundici righe.
   */
  const chiSaFare = useCallback((treatmentId: string): string[] => {
    const t = treatments.find(x => x.id === treatmentId);
    const skills = t?.operatorSkills || [];
    return skills.map(x => x.operatorId);
  }, [treatments]);

  /** Quanto ci mette LEI su quel trattamento: se non è scritto, la durata standard. */
  const durataPerOperatrice = useCallback((treatmentId: string, operatorId: string, standard: number): number => {
    const t = treatments.find(x => x.id === treatmentId);
    const skill = (t?.operatorSkills || []).find(x => x.operatorId === operatorId);
    return skill?.duration && skill.duration > 0 ? skill.duration : standard;
  }, [treatments]);

  /**
   * Le cabine, numerate.
   *
   * In anagrafica si chiamano tutte e due "Cabina Automatica": in un menu a
   * tendina diventano due righe identiche e non si capisce quale si sta
   * scegliendo. Qui prendono un numero.
   */
  const risorse = useMemo(() => operators.filter(o => o.isResource), [operators]);
  const etichettaRisorsa = (o: Operator, indice: number) => {
    const nome = `${o.firstName} ${o.lastName}`.trim();
    const omonime = risorse.filter(r => `${r.firstName} ${r.lastName}`.trim() === nome).length;
    return omonime > 1 ? `${nome} ${indice + 1}` : nome;
  };

  /**
   * Chi esegue quel trattamento: un'operatrice o una cabina automatica.
   *
   * Cambiando persona cambia anche la durata, se a listino ne ha una sua:
   * il laser lo fanno in due e ci mettono tempi diversi, e l'agenda deve
   * riservare il tempo giusto.
   */
  const setServiceOperator = (index: number, operatorId: string) => {
    const op = operators.find(o => o.id === operatorId);
    setSelectedServices(prev => prev.map((s, i) => {
      if (i !== index) return s;
      // La durata segue chi lo fa: quella a listino per lei, o la standard.
      const t = treatments.find(x => x.id === s.treatmentId);
      const standard = t ? (s.gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration)) : s.duration;
      return {
        ...s,
        operatorId: operatorId || undefined,
        operatorName: op ? `${op.firstName} ${op.lastName}`.trim() : undefined,
        duration: operatorId ? durataPerOperatrice(s.treatmentId, operatorId, standard) : standard,
      };
    }));
  };

  const totalDuration = useMemo(() => selectedServices.reduce((s, x) => s + x.duration, 0), [selectedServices]);
  const totalPrice = useMemo(() => selectedServices.reduce((s, x) => s + x.price, 0), [selectedServices]);

  const endTime = useMemo(() => {
    if (selectedServices.length === 0) return startTime;
    const [h, m] = startTime.split(':').map(Number);
    const total = h * 60 + m + totalDuration;
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }, [startTime, selectedServices, totalDuration]);

  const selectedOperator = operators.find(o => o.id === selectedOperatorId);
  const dateStr = apptDate;
  const apptDateObj = useMemo(() => { const [y, m, d] = apptDate.split('-').map(Number); return new Date(y, m - 1, d); }, [apptDate]);
  // Turni della settimana dell'appuntamento (per mostrare chi è a riposo)
  const apptWeekStart = mondayISO(apptDateObj);
  const apptWeekMap = useWeekShiftsStore(s => s.byWeek[apptWeekStart]);
  const fetchApptWeek = useWeekShiftsStore(s => s.fetchWeek);
  useEffect(() => { if (isAppointmentModalOpen) fetchApptWeek(apptWeekStart); }, [isAppointmentModalOpen, apptWeekStart, fetchApptWeek]);
  /**
   * L'appuntamento sta nella colonna di chi fa il primo trattamento.
   *
   * Prima c'era una griglia a parte per sceglierla, ma da quando ogni
   * trattamento dice chi lo fa quella griglia chiedeva due volte la stessa
   * cosa — e le due risposte potevano perfino contraddirsi.
   */
  useEffect(() => {
    const primo = selectedServices[0]?.operatorId;
    if (primo && primo !== selectedOperatorId) setSelectedOperatorId(primo);
  }, [selectedServices, selectedOperatorId]);

  /**
   * Cosa manca per poter salvare, scritto in italiano.
   *
   * Prima il tasto restava semplicemente spento e non diceva perché: una
   * ragazza c'è rimasta cinque minuti senza capire che non aveva scelto la
   * cliente. Un tasto spento senza spiegazione è un difetto, non una tutela.
   */
  const mancanze: string[] = [];
  if (!selectedClientId) mancanze.push('la cliente');
  if (selectedServices.length === 0) mancanze.push('almeno un trattamento');
  else if (selectedServices.some(s => !s.operatorId)) {
    mancanze.push(selectedServices.filter(s => !s.operatorId).length === 1
      ? 'chi esegue un trattamento'
      : 'chi esegue alcuni trattamenti');
  }
  if (!startTime) mancanze.push("l'ora di inizio");

  const canSave = mancanze.length === 0;

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
      // Chi l'ha preso resta scritto: serve a sapere con chi parlare quando
      // qualcosa non torna, ed è un'informazione che prima si perdeva.
      ...(presaDa ? { createdBy: presaDa } : {}),
    };
    if (editingAppointment) updateAppointment(editingAppointment.id, data);
    else addAppointment(data);
    closeAppointmentModal();
  };

  /**
   * Chi è occupato se l'appuntamento comincia a una certa ora.
   *
   * Non basta controllare l'operatrice principale: da quando i singoli
   * trattamenti si possono affidare ad altre, ognuna va verificata sul proprio
   * pezzo, altrimenti si prenota Rosaria in un orario in cui è già impegnata.
   */
  /** Le fette dell'appuntamento che si sta scrivendo: una per operatrice coinvolta. */
  const fetteAt = useCallback((startMin: number, durataSeVuoto = 15) => {
    const fette = new Map<string, { from: number; to: number }>();
    if (!selectedOperatorId) return fette;
    if (selectedServices.length === 0) {
      fette.set(selectedOperatorId, { from: startMin, to: startMin + durataSeVuoto });
    } else {
      let cursore = startMin;
      for (const s of selectedServices) {
        const opId = s.operatorId || selectedOperatorId;
        const from = cursore;
        const to = cursore + (s.duration || 0);
        const gia = fette.get(opId);
        fette.set(opId, gia ? { from: Math.min(gia.from, from), to: Math.max(gia.to, to) } : { from, to });
        cursore = to;
      }
    }
    return fette;
  }, [selectedOperatorId, selectedServices]);

  /**
   * Fino a che ora quel posto è davvero occupato.
   *
   * Non è sempre l'ora di fine scritta in agenda: se la cliente ha già fatto il
   * check-out, la cabina è libera da quel momento. Succede tutti i giorni con
   * le lampade — prenotate 25 minuti, la cliente esce dopo 15 — e prima
   * l'agenda diceva "occupata" a chi stava entrando davvero, con la stanza
   * vuota davanti agli occhi.
   *
   * Vale solo per il check-out fatto nello stesso giorno: una data diversa è
   * quasi sempre una chiusura dimenticata la sera prima, e non dice niente su
   * quanto è durato il trattamento.
   */
  const fineOccupazione = useCallback((a: Appointment): number => {
    const fine = timeToMinutes(a.endTime);
    if (!a.checkOutAt) return fine;
    const uscita = new Date(a.checkOutAt);
    if (Number.isNaN(uscita.getTime())) return fine;
    const giorno = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(uscita);
    if (giorno !== a.date) return fine;
    const ora = new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(uscita);
    const min = timeToMinutes(ora);
    // Mai prima dell'inizio: un check-out anomalo non deve rendere il posto
    // "libero da ieri".
    return Math.max(timeToMinutes(a.startTime), Math.min(fine, min));
  }, []);

  const conflictsAt = useCallback((startMin: number, durataSeVuoto = 15) => {
    if (!selectedOperatorId) return [] as { operatorId: string; nome: string; motivo: string; minuti: number }[];

    const fette = fetteAt(startMin, durataSeVuoto);

    const altri = appointments.filter(a =>
      a.date === dateStr && a.id !== editingAppointment?.id &&
      a.status !== 'cancelled' && a.status !== 'no_show'
    );

    // `minuti` è di quanto ci si accavalla: dieci minuti su un trattamento da
    // cento non sono un problema, un'ora sì. Il numero serve a chi decide.
    const conflitti: { operatorId: string; nome: string; motivo: string; minuti: number }[] = [];
    const quantoSiSovrappone = (aFrom: number, aTo: number, bFrom: number, bTo: number) =>
      Math.max(0, Math.min(aTo, bTo) - Math.max(aFrom, bFrom));

    for (const [opId, range] of fette) {
      const op = operators.find(o => o.id === opId);
      const nome = op ? `${op.firstName} ${op.lastName}`.trim() : 'Operatrice';

      if (range.to > END_HOUR * 60) {
        conflitti.push({
          operatorId: opId, nome, minuti: range.to - END_HOUR * 60,
          motivo: 'l\'orario sfora la chiusura',
        });
        continue;
      }
      // Anche i trattamenti che altri appuntamenti hanno affidato a lei occupano il suo tempo
      const scontro = appointmentsForOperator(altri, opId).find(a =>
        !(fineOccupazione(a) <= range.from || timeToMinutes(a.startTime) >= range.to)
      );
      if (scontro) {
        const finito = fineOccupazione(scontro);
        conflitti.push({
          operatorId: opId, nome,
          minuti: quantoSiSovrappone(range.from, range.to, timeToMinutes(scontro.startTime), finito),
          motivo: `ha già ${scontro.clientName} dalle ${scontro.startTime} alle ${minutesToTime(finito)}`,
        });
        continue;
      }
      const blocco = blocks.find(b =>
        b.date === dateStr && b.operatorId === opId &&
        !(timeToMinutes(b.endTime) <= range.from || timeToMinutes(b.startTime) >= range.to)
      );
      if (blocco) {
        conflitti.push({
          operatorId: opId, nome,
          minuti: quantoSiSovrappone(range.from, range.to, timeToMinutes(blocco.startTime), timeToMinutes(blocco.endTime)),
          motivo: `ha una fascia bloccata ${blocco.startTime}-${blocco.endTime}`,
        });
      }
    }
    return conflitti;
  }, [selectedOperatorId, fetteAt, dateStr, appointments, blocks, editingAppointment, operators, fineOccupazione]);

  const slotIsFree = useCallback(
    (startMin: number, duration: number) => conflictsAt(startMin, duration).length === 0,
    [conflictsAt],
  );

  /**
   * Chi, a quell'ora, non è in servizio: fuori turno, in pausa o di riposo.
   *
   * È una cosa diversa dall'essere occupata, e va detta a parte. Non blocca:
   * capita di ricevere una cliente mezz'ora dopo la chiusura, e l'agenda deve
   * poterlo scrivere invece di far finta che non succeda.
   */
  const fuoriServizioAt = useCallback((startMin: number, durataSeVuoto = 15) => {
    const fuori: { operatorId: string; nome: string }[] = [];
    for (const [opId, range] of fetteAt(startMin, durataSeVuoto)) {
      const op = operators.find(o => o.id === opId);
      // Le cabine non hanno turni: sono stanze, non persone.
      if (!op || op.isResource) continue;
      // Il giorno di riposo non compare fra le fasce: lì è fuori servizio tutto il giorno.
      let scoperto = !operatorWorksOn(op, apptDateObj, apptWeekMap);
      for (let t = range.from; !scoperto && t < range.to; t += 5) {
        if (isMinuteUnavailable(op, apptDateObj, t - START_HOUR * 60, apptWeekMap)) scoperto = true;
      }
      if (scoperto) fuori.push({ operatorId: opId, nome: `${op.firstName} ${op.lastName}`.trim() });
    }
    return fuori;
  }, [fetteAt, operators, apptDateObj, apptWeekMap]);

  // Tutti gli orari della giornata, con accanto il segno di chi è già
  // impegnata e di quando l'operatrice non è in servizio. Niente sparisce
  // dall'elenco: si mette in chiaro e si lascia scegliere. Un trattamento da
  // cento minuti spesso ne dura ottanta, e una cliente che arriva mezz'ora
  // dopo la chiusura va scritta in agenda, non nascosta.
  const orariPossibili = useMemo(() => {
    const dur = totalDuration || 15;
    const list: { ora: string; occupato: boolean; fuoriTurno: boolean }[] = [];
    for (let t = START_HOUR * 60; t < END_HOUR * 60; t += 15) {
      // In modifica, l'orario attuale dell'appuntamento non si segnala: è già suo.
      const isCurrent = editingAppointment && t === timeToMinutes(startTime);
      list.push({
        ora: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
        occupato: !isCurrent && !slotIsFree(t, dur),
        fuoriTurno: !isCurrent && fuoriServizioAt(t, dur).length > 0,
      });
    }
    return list;
  }, [totalDuration, slotIsFree, fuoriServizioAt, editingAppointment, startTime]);

  // NIENTE cambio d'orario automatico: l'orario che l'operatrice ha cliccato
  // in agenda resta quello. Se poi risulta occupato lo dice l'avviso, ma la
  // scelta non si tocca (richiesta di Dino: "voglio che mi porti le 11 e non
  // muove l'orario").

  // Chi risulta occupato con gli orari attuali: serve a dire per nome chi è
  // impegnata, altrimenti si cambia orario a tentativi.
  const conflitti = useMemo(() => {
    if (selectedServices.length === 0 || !selectedOperatorId) return [];
    return conflictsAt(timeToMinutes(startTime), totalDuration);
  }, [startTime, selectedServices, selectedOperatorId, conflictsAt, totalDuration]);

  // Chi, a quell'ora, non è in servizio. Avviso a parte: è un'altra cosa
  // rispetto all'essere occupata, e si prenota comunque.
  const fuoriServizio = useMemo(() => {
    if (selectedServices.length === 0 || !selectedOperatorId) return [];
    return fuoriServizioAt(timeToMinutes(startTime), totalDuration);
  }, [startTime, selectedServices, selectedOperatorId, fuoriServizioAt, totalDuration]);

  const isOccupied = conflitti.length > 0;
  const isFuoriTurno = fuoriServizio.length > 0;

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
            <div ref={clientBoxRef} className="relative">
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
                      {...NO_AUTOFILL} placeholder="Cerca cliente o numero..."
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all" />
                    {/* La via d'uscita in chiaro: cliccare fuori funziona, ma
                        una crocetta si vede e non bisogna indovinarla. */}
                    {(showClientDropdown || clientSearch) && (
                      <button type="button" title="Chiudi l'elenco"
                        onClick={() => { setShowClientDropdown(false); setClientSearch(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                        <X className="w-4 h-4" />
                      </button>
                    )}
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
                        // Il trattamento è quello del pacchetto: prima da catalogo, poi dal nome.
                        const catalogPkg = catalogPackages.find(p => p.id === cp.packageId);
                        const t = resolveTreatmentForPackage({
                          packageName: cp.packageName,
                          catalogTreatmentName: catalogPkg?.treatmentName,
                          treatments,
                        });
                        if (t) {
                          setPkgHint('');
                          // La seduta è già pagata nel pacchetto: si aggiunge a 0 €.
                          if (!selectedServices.some(s => s.treatmentId === t.id)) addService(t, 0);
                        } else {
                          setPkgHint(`Non riesco a capire il trattamento di «${cp.packageName}»: scegli tu quale trattamento fare qui sotto. La seduta verrà comunque scalata dal pacchetto.`);
                        }
                        setNotes(`📦 Seduta da pacchetto: ${cp.packageName} (${remaining} rimanenti)`);
                      }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold hover:bg-accent/90 transition-colors whitespace-nowrap cursor-pointer z-10">
                        <Package className="w-3 h-3" /> {cp.pricePaid === 0 ? 'Usa omaggio' : 'Usa seduta'}
                      </button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-text-muted italic">La seduta verrà scalata solo quando l&apos;appuntamento sarà completato.</p>
                {pkgHint && (
                  <p className="text-[11px] text-warning font-medium bg-warning/10 rounded-lg px-2.5 py-2">⚠️ {pkgHint}</p>
                )}
              </div>
            )}

            {/* Detto esplicitamente: così si sa che il controllo è stato fatto e
                non si resta col dubbio che il pacchetto ci sia ma non si veda */}
            {selectedClientName && clientActivePkgs.length === 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-text-muted px-1">
                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                Nessun pacchetto attivo per {selectedClientName.split(' ')[0]}.
              </p>
            )}

            {/* Treatments (uno o più) */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <label className="block text-sm font-medium text-text-secondary">Trattamenti *</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { closeAppointmentModal(); router.push('/dashboard/packages'); }}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors font-medium bg-accent/10 px-2 py-1 rounded-md">
                    <Package className="w-3.5 h-3.5" /> Vendi pacchetto
                  </button>
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                    <button type="button" onClick={() => setGender('female')}
                      className={`px-2.5 py-1 transition-colors ${gender === 'female' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>♀ Donna</button>
                    <button type="button" onClick={() => setGender('male')}
                      className={`px-2.5 py-1 transition-colors ${gender === 'male' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>♂ Uomo</button>
                  </div>
                </div>
              </div>

              {/* Lista trattamenti aggiunti */}
              {selectedServices.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {selectedServices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/20 flex-wrap">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{s.treatmentName}</span>
                      <span className="text-xs text-text-muted flex-shrink-0">{s.gender === 'male' ? '♂' : '♀'} {s.duration}min · {formatCurrency(s.price)}</span>
                      {/* Chi lo fa: vuoto = l'operatrice principale scelta sotto.
                          Serve quando due operatrici si dividono la stessa cliente. */}
                      <select value={s.operatorId || ''} onChange={e => setServiceOperator(i, e.target.value)}
                        title="Chi esegue questo trattamento"
                        className={`px-2 py-1 rounded-lg bg-bg-secondary border text-[11px] focus:outline-none flex-shrink-0 max-w-[150px] ${
                          s.operatorId ? 'border-border text-text-secondary focus:border-accent/50'
                            : 'border-warning text-warning focus:border-warning'}`}>
                        <option value="">Chi lo fa? *</option>
                        {/* Solo chi quel trattamento lo sa fare. Se a listino
                            non è spuntato nessuno, ci sono tutte. */}
                        {operators.filter(o => !o.isResource).filter(o => {
                          const abili = chiSaFare(s.treatmentId);
                          return abili.length === 0 || abili.includes(o.id);
                        }).map(o => {
                          const t = treatments.find(x => x.id === s.treatmentId);
                          const sua = (t?.operatorSkills || []).find(k => k.operatorId === o.id)?.duration;
                          return (
                            <option key={o.id} value={o.id}>
                              {o.firstName} {o.lastName}{sua ? ` · ${sua} min` : ''}
                            </option>
                          );
                        })}
                        {/* Le cabine automatiche lavorano senza operatrice: la
                            lampada e la pressoterapia vanno assegnate a loro.
                            Valgono la stessa regola: se il trattamento dice
                            chi lo fa, compaiono solo se sono nell'elenco. */}
                        {risorse.filter(o => {
                          const abili = chiSaFare(s.treatmentId);
                          return abili.length === 0 || abili.includes(o.id);
                        }).map((o, k) => (
                          <option key={o.id} value={o.id}>{etichettaRisorsa(o, k)}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeService(i)} className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {selectedServices.some(s => s.operatorId && s.operatorId !== selectedOperatorId) && (
                    <p className="flex items-start gap-1.5 text-[11px] text-text-muted px-1">
                      <Users className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                      I trattamenti si susseguono nell&apos;ordine dell&apos;elenco: ogni operatrice vedrà in agenda
                      solo il proprio pezzo, con il suo orario.
                    </p>
                  )}
                </div>
              )}

              {/* Ricerca per aggiungere un altro trattamento */}
              <div className="relative">
                <input type="text" value={treatmentQuery}
                  onChange={e => { setTreatmentQuery(e.target.value); setTreatmentOpen(true); }}
                  onFocus={() => setTreatmentOpen(true)}
                  onBlur={() => setTimeout(() => setTreatmentOpen(false), 150)}
                  {...NO_AUTOFILL}
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
            {/* Chi ha preso l'appuntamento: la ragazza al banco, non chi lo
                esegue — quello si sceglie accanto a ogni trattamento. Niente
                cabine qui: un appuntamento lo prende una persona. */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Chi ha preso l&apos;appuntamento</label>
              <div className="grid grid-cols-5 gap-2">
                {operators.filter(o => !o.isResource).map(op => (
                  <button key={op.id} type="button"
                    onClick={() => setPresaDa(presaDa === op.id ? '' : op.id)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      presaDa === op.id ? 'border-accent bg-accent/10' : 'border-border hover:border-border-light'}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: op.color }}>
                      {getInitials(op.firstName, op.lastName)}
                    </div>
                    <span className="text-[11px] text-text-primary truncate w-full text-center">{op.firstName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Data</label>
                <input type="date" value={apptDate} onChange={e => e.target.value && setApptDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Ora Inizio *</label>
                {orariPossibili.length === 0 && !startTime ? (
                  <div className="w-full px-3 py-2.5 rounded-xl bg-error/5 border border-error/20 text-sm text-error">
                    Oggi non è in servizio
                  </div>
                ) : (
                  <select value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                    {/* L'orario scelto resta visibile anche se occupato: si segnala, non si cambia */}
                    {startTime && !orariPossibili.some(o => o.ora === startTime) && (
                      <option value={startTime}>{startTime} — occupato</option>
                    )}
                    {orariPossibili.map(o => (
                      <option key={o.ora} value={o.ora}>
                        {o.ora}
                        {o.occupato && o.fuoriTurno ? ' — occupato, fuori orario'
                          : o.occupato ? ' — occupato'
                          : o.fuoriTurno ? ' — fuori orario' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {selectedServices.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-sm text-text-secondary">Fine prevista: <strong className="text-text-primary">{endTime}</strong> ({totalDuration} min) • <strong className="text-text-primary">{formatCurrency(totalPrice)}</strong></span>
              </div>
            )}
            {/* Cliente già in negozio: la conferma WhatsApp non parte, meglio dirlo prima */}
            {!editingAppointment && isWalkIn(apptDate, startTime) && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border/60">
                <MessageSquare className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-text-secondary leading-relaxed">
                  La cliente è già qui: niente messaggio di conferma su WhatsApp.
                </span>
              </div>
            )}
            {/* Si avvisa, non si sbarra la strada: la durata a listino è larga
                (cento minuti che spesso ne diventano ottanta) e dieci minuti
                di accavallamento al banco si gestiscono. Chi sta lì decide. */}
            {isOccupied && !editingAppointment && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning">
                    {conflitti.length === 1 ? `${conflitti[0].nome} è occupata` : 'Operatrici occupate'}
                  </p>
                  {/* Il nome di chi è impegnata, con chi, e di quanto ci si accavalla:
                      è il numero su cui si decide se va bene lo stesso. */}
                  <ul className="text-xs text-text-secondary mt-1 space-y-0.5">
                    {conflitti.map(c => (
                      <li key={c.operatorId}>
                        <strong className="text-text-primary">{c.nome}</strong> {c.motivo}
                        {c.minuti > 0 && <> — <strong className="text-warning">si sovrappone di {c.minuti} min</strong></>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-text-muted mt-1.5">
                    Puoi prenotare lo stesso. Oppure cambia orario, affida il trattamento a un&apos;altra
                    operatrice, o metti la cliente in lista d&apos;attesa.
                  </p>
                </div>
              </div>
            )}

            {/* Fuori turno: è un'altra cosa dall'essere occupata, e va detta a
                parte. Capita di prendere una cliente mezz'ora dopo la
                chiusura — l'agenda deve poterlo scrivere. */}
            {isFuoriTurno && !editingAppointment && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30">
                <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning">
                    {fuoriServizio.length === 1
                      ? `${fuoriServizio[0].nome} non è in servizio a quest'ora`
                      : 'Operatrici non in servizio a quest\'ora'}
                  </p>
                  {fuoriServizio.length > 1 && (
                    <ul className="text-xs text-text-secondary mt-1 space-y-0.5">
                      {fuoriServizio.map(f => (
                        <li key={f.operatorId}><strong className="text-text-primary">{f.nome}</strong> è fuori turno</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-text-muted mt-1.5">
                    È fuori dal suo turno (o è pausa, o giorno di riposo). Puoi prenotare lo stesso:
                    l&apos;appuntamento comparirà in agenda sulla fascia grigia.
                  </p>
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
          {/* Cosa manca, scritto. Un tasto spento e muto fa perdere minuti
              a chi sta lavorando: qui c'è sempre il perché. */}
          {mancanze.length > 0 && (
            <div className="px-6 pb-3 flex-shrink-0">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  Per salvare manca ancora <strong className="text-warning">{mancanze.join(', ')}</strong>.
                </p>
              </div>
            </div>
          )}
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
              {/* Se è occupata o fuori turno il tasto diventa arancione e
                  cambia nome: si può fare, ma si vede che è una forzatura
                  voluta. */}
              <button onClick={handleSave} disabled={!canSave}
                className={`px-5 py-2 rounded-xl text-white text-sm font-medium transition-all ${
                  !canSave ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                    : (isOccupied || isFuoriTurno) && !editingAppointment ? 'bg-warning shadow-lg shadow-warning/20 hover:brightness-110'
                    : 'gradient-accent shadow-lg shadow-accent/20'}`}>
                {editingAppointment ? 'Salva Modifiche'
                  : isOccupied || isFuoriTurno ? 'Prenota comunque' : 'Crea Appuntamento'}
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
              addClient(data).catch(avvisaErroreCliente);
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
function DetailPanel({ appointment: appointmentProp, onClose, onEdit, onStatusChange, onCancelWithReason, onDelete }: {
  appointment: Appointment; onClose: () => void; onEdit: (a: Appointment) => void;
  onStatusChange: (id: string, status: Appointment['status'], extra?: Partial<Appointment>) => void;
  onCancelWithReason: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  // Sempre allineato al dato in memoria: dopo un check-in o un trattamento
  // aggiunto il pannello si aggiorna da solo
  const liveAppointment = useAgendaStore(s => s.appointments.find(a => a.id === appointmentProp.id));
  const appointment = liveAppointment ?? appointmentProp;
  const updateAppt = useAgendaStore(s => s.updateAppointment);
  const treatments = useTreatmentStore(s => s.treatments);
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [treatmentQuery, setTreatmentQuery] = useState('');
  // Carrello della seduta: oltre ai trattamenti si aggiungono anche i prodotti
  // (creme, kit) dall'anagrafica magazzino. Un totale solo, incassato insieme.
  const [addingProduct, setAddingProduct] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [busySvc, setBusySvc] = useState(false);
  // Check-in: prima si sceglie la cabina, è quella che la voce chiamerà a fine trattamento
  const [askingCabin, setAskingCabin] = useState(false);
  const [cabin, setCabin] = useState('');
  // Avviso "data diversa da oggi", mostrato prima del check-in
  const [dateWarn, setDateWarn] = useState(false);
  // Scheda cliente da completare: al telefono si prendono solo nome e numero,
  // il resto si compila QUI, al check-in, quando la cliente è davanti al banco.
  const [schedaOpen, setSchedaOpen] = useState(false);
  const [schedaForm, setSchedaForm] = useState({ birthDate: '', gender: '' as '' | 'F' | 'M', address: '', city: '', email: '', marketing: false });
  const [schedaBusy, setSchedaBusy] = useState(false);
  const cabins = useCabinStore(s => s.cabins);
  const fetchCabins = useCabinStore(s => s.fetchCabins);
  useEffect(() => { fetchCabins(); }, [fetchCabins]);
  const prodotti = useProductStore(s => s.products);
  const fetchProducts = useProductStore(s => s.fetchProducts);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  // Serve per riassegnare un singolo trattamento a un'altra operatrice
  const operators = useOperatorStore(s => s.operators);

  // Elenco dei trattamenti dell'appuntamento (i vecchi ne hanno uno solo)
  const services: AppointmentService[] = useMemo(() => (
    appointment.services && appointment.services.length > 0
      ? appointment.services
      : [{
          treatmentId: appointment.treatmentId,
          treatmentName: appointment.treatmentName,
          treatmentCategory: appointment.treatmentCategory,
          duration: appointment.duration,
          price: appointment.price,
          checkInAt: appointment.checkInAt,
          checkOutAt: appointment.checkOutAt,
        }]
  ), [appointment]);

  /** Salva i trattamenti ricalcolando durata, fine e totale. */
  const saveServices = async (next: AppointmentService[], extra: Partial<Appointment> = {}) => {
    const totalDuration = next.reduce((s, x) => s + x.duration, 0);
    // Lo sconto concordato resta valido anche se si aggiunge o si toglie un
    // trattamento: `price` è sempre il prezzo finale, listino meno sconto.
    const sconto = appointment.discountAmount || 0;
    const totalPrice = Math.max(0, next.reduce((s, x) => s + x.price, 0) - sconto);
    setBusySvc(true);
    try {
      await updateAppt(appointment.id, {
        services: next,
        duration: totalDuration,
        price: totalPrice,
        endTime: minutesToTime(timeToMinutes(appointment.startTime) + totalDuration),
        ...extra,
      });
    } finally { setBusySvc(false); }
  };

  // Check-in unico per tutto l'appuntamento (non per singolo trattamento):
  // il timer conta la durata totale di tutti i trattamenti.
  // La cabina scelta qui è quella che l'annuncio vocale chiamerà a tempo scaduto.
  const doCheckIn = (cabinNumber?: string) => {
    const n = (cabinNumber ?? '').trim();
    if (n) { try { localStorage.setItem(LAST_CABIN_KEY, n); } catch { /* no-op */ } }
    onStatusChange(appointment.id, 'in_cabin', { checkInAt: new Date().toISOString(), cabinNumber: n || undefined });
    onClose();
  };

  const openCabinPicker = () => {
    let last = '';
    try { last = localStorage.getItem(LAST_CABIN_KEY) || ''; } catch { /* no-op */ }
    setCabin(appointment.cabinNumber || last);
    setAskingCabin(true);
  };

  const addTreatmentToAppointment = (t: Treatment) => {
    const gender = services[0]?.gender ?? 'female';
    const duration = gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration);
    const price = gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price);
    // Cliente già in cabina = trattamento VENDUTO dall'estetista durante la
    // seduta, non prenotato: è un upsell e finisce nella sua classifica.
    const inCabina = appointment.status === 'in_cabin' || appointment.status === 'in_progress';
    saveServices([...services, {
      treatmentId: t.id, treatmentName: t.name, treatmentCategory: t.category,
      duration, price, gender,
      ...(inCabina ? { upsell: true, upsellAt: new Date().toISOString() } : {}),
    }]);
    setAddingTreatment(false);
    setTreatmentQuery('');
  };

  /**
   * Prodotto nel carrello della seduta: durata zero (non sposta gli orari),
   * prezzo nel totale, incassato al check-out insieme ai trattamenti — dove
   * scala anche la giacenza e conta nella classifica upsell di chi vende.
   */
  const addProductToAppointment = (p: Product) => {
    saveServices([...services, {
      treatmentId: `prod-${p.id}`, productId: p.id,
      treatmentName: p.name, treatmentCategory: 'prodotto',
      duration: 0, price: p.price,
    }]);
    setAddingProduct(false);
    setProductQuery('');
  };

  const removeServiceAt = (i: number) => {
    if (services.length <= 1) return;
    saveServices(services.filter((_, idx) => idx !== i));
  };

  /**
   * Passa un singolo trattamento a un'altra operatrice.
   *
   * Serve di continuo: la cliente prende tre cose e una la fa la collega.
   * Prima si poteva fare solo entrando in modifica, e da qui — dove i
   * trattamenti sono già elencati uno per uno — non si capiva come.
   * Vuoto = la fa l'operatrice dell'appuntamento.
   */
  const cambiaOperatriceServizio = (i: number, operatorId: string) => {
    const op = operators.find(o => o.id === operatorId);
    saveServices(services.map((s, idx) => idx === i ? {
      ...s,
      operatorId: operatorId || undefined,
      operatorName: op ? `${op.firstName} ${op.lastName}`.trim() : undefined,
    } : s));
  };

  const treatmentResults = useMemo(() => {
    const q = treatmentQuery.trim().toLowerCase();
    const list = treatments.filter(t => t.isActive !== false);
    if (!q) return list.slice(0, 8);
    return list.filter(t => t.name.toLowerCase().includes(q) || getCategoryLabel(t.category).toLowerCase().includes(q)).slice(0, 8);
  }, [treatmentQuery, treatments]);

  // Tutta l'anagrafica prodotti del magazzino, cercabile per nome o marca
  const productResults = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const list = prodotti.filter(p => p.isActive !== false);
    if (!q) return list.slice(0, 8);
    return list.filter(p => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)).slice(0, 8);
  }, [productQuery, prodotti]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [scaledPkgId, setScaledPkgId] = useState<string | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  // Scelta del pacchetto da scalare al check-out ('none' = incassa in cassa)
  const [showPkgModal, setShowPkgModal] = useState(false);
  const [pkgChoice, setPkgChoice] = useState<string>('none');
  // Cambio del trattamento omaggio (le clienti cambiano idea all'ultimo)
  const [changingGift, setChangingGift] = useState<string | null>(null);
  const [savingGift, setSavingGift] = useState(false);
  const refreshPackages = usePackageStore(s => s.fetchPackages);
  const usePackageSession = usePackageStore(s => s.useSession);
  const allClientPkgs = usePackageStore(s => s.clientPackages);
  const allClients = useClientStore(s => s.clients);
  const updateClientInStore = useClientStore(s => s.updateClient);

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
  const totalPkgDebt = packagesWithDebt.reduce((s, cp) => s + (cp.remainingBalance || 0), 0);

  /*
    Questa seduta è stata incassata davvero?

    Si chiede al server, perché la risposta sta in cassa e non nell'appuntamento:
    finché non lo sappiamo resta `null` e non si scrive niente — dire "non
    pagata" per mezzo secondo su una seduta pagata sarebbe peggio del problema.
  */
  /** Se questa cliente è fra quelle che spendono di più, e quanto. */
  const [coccolaQuesta, setCoccolaQuesta] = useState<ClienteTop | null>(null);
  useEffect(() => {
    let vivo = true;
    clientiTop()
      .then(lista => {
        if (!vivo) return;
        const k = chiaveNome(appointment.clientName);
        setCoccolaQuesta(lista.find(c => chiaveNome(c.nome) === k) || null);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [appointment.clientName]);

  const [incassata, setIncassata] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    if (appointment.status !== 'completed') { setIncassata(null); return; }
    sedutaIncassata(appointment.id).then(r => { if (vivo) setIncassata(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [appointment.id, appointment.status]);

  /*
    Il prezzo concordato con la cliente.

    `listino` è la somma dei trattamenti fatti: resta il riferimento, non si
    tocca. Quello che cambia è `price`, cioè quanto paga davvero — così ogni
    conto già scritto (incasso previsto, cassa, statistiche, scontrino) prende
    la cifra giusta senza dover sapere che esiste uno sconto.
  */
  const listino = services.reduce((s, x) => s + x.price, 0);
  const [scontoAperto, setScontoAperto] = useState(false);
  const [prezzoConcordato, setPrezzoConcordato] = useState('');
  const [motivoSconto, setMotivoSconto] = useState('');

  const apriSconto = () => {
    setPrezzoConcordato(String(appointment.price));
    setMotivoSconto(appointment.discountReason || '');
    setScontoAperto(true);
  };

  const salvaSconto = async () => {
    const finale = Number(prezzoConcordato);
    if (!isFinite(finale) || finale < 0) return;
    // Un prezzo più alto del listino non è uno sconto: è un altro listino, e
    // si scrive cambiando il prezzo del trattamento. Qui si scende soltanto.
    const sconto = Math.max(0, Math.round((listino - finale) * 100) / 100);
    setBusySvc(true);
    try {
      const io = useAuthStore.getState().user;
      await updateAppt(appointment.id, {
        price: Math.min(listino, Math.max(0, finale)),
        discountAmount: sconto || undefined,
        discountReason: sconto ? (motivoSconto.trim() || undefined) : undefined,
        // Chi lo sta facendo: finisce nell'avviso su Telegram e resta scritto
        // sull'appuntamento, così a fine mese uno sconto non è di nessuno.
        discountBy: sconto ? [io?.firstName, io?.lastName].filter(Boolean).join(' ').trim() || undefined : undefined,
      });
      setScontoAperto(false);
    } finally { setBusySvc(false); }
  };

  const togliSconto = async () => {
    setBusySvc(true);
    try {
      await updateAppt(appointment.id, { price: listino, discountAmount: undefined, discountReason: undefined });
    } finally { setBusySvc(false); }
  };

  /** Rimanda in cassa la seduta chiusa e mai incassata, col conto già pronto. */
  const vaiAIncassare = () => {
    const daPagare = services.filter(s => s.price > 0);
    const trattamenti = daPagare.filter(s => !s.productId);
    try {
      sessionStorage.setItem('revo_pos_autosale', JSON.stringify({
        appointmentId: appointment.id,
        client: appointment.clientName,
        treatment: trattamenti.map(s => s.treatmentName).join(' + ') || appointment.treatmentName,
        treatmentId: trattamenti.length > 0 ? appointment.treatmentId : '',
        price: trattamenti.reduce((sum, s) => sum + s.price, 0) || appointment.price,
        products: daPagare.filter(s => s.productId).map(s => ({ id: s.productId, name: s.treatmentName, price: s.price, qty: 1 })),
        operator: appointment.operatorName,
      }));
    } catch { /* no-op */ }
    onClose();
    router.push('/dashboard/pos');
  };

  const fmtClock = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }) : '';
  const cabinMinutes = appointment.checkInAt && appointment.checkOutAt
    ? Math.max(1, Math.round((Date.parse(appointment.checkOutAt) - Date.parse(appointment.checkInAt)) / 60000))
    : null;

  // Pacchetti da cui si può ancora scalare una seduta
  const usablePkgs = clientPkgs.filter(cp => cp.usedSessions < cp.totalSessions);
  // Quanto resta comunque da incassare: i trattamenti della seduta che non sono
  // a 0 € (la manicure fatta insieme al massaggio del pacchetto, per capirci).
  const totaleDaIncassare = services.filter(s => s.price > 0).reduce((s, x) => s + x.price, 0);
  // Pacchetto indicato al momento della prenotazione (se c'è)
  const bookedPkg = appointment.notes?.includes('📦 Seduta da pacchetto')
    ? usablePkgs.find(cp => appointment.notes?.includes(cp.packageName)) || null
    : null;

  /**
   * chosenPkgId: id del pacchetto da scalare, oppure null per incassare in cassa.
   * Se non passato, usa il pacchetto scelto in fase di prenotazione.
   */
  const processCheckout = async (chosenPkgId?: string | null) => {
    const checkOutAt = new Date().toISOString();
    const cabinMinutes = appointment.checkInAt
      ? Math.max(1, Math.round((Date.parse(checkOutAt) - Date.parse(appointment.checkInAt)) / 60000))
      : undefined;
    // Chiude anche il trattamento eventualmente ancora in corso (ferma il timer)
    const closedServices = services.map(s => (s.checkInAt && !s.checkOutAt ? { ...s, checkOutAt } : s));
    onStatusChange(appointment.id, 'completed', { checkOutAt, services: closedServices });

    const pkg = chosenPkgId === undefined
      ? bookedPkg
      : (chosenPkgId ? usablePkgs.find(cp => cp.id === chosenPkgId) || null : null);

    if (pkg) {
      // Lo scalo va ATTESO e un suo fallimento va urlato: un errore silenzioso
      // qui lascia il pacchetto pieno con la seduta già fatta (successo vero).
      try {
        await usePackageSession(pkg.id, appointment.operatorName, `Completato: ${appointment.treatmentName}`);
        setScaledPkgId(pkg.id);
      } catch {
        alert(`ATTENZIONE: la seduta NON è stata scalata dal pacchetto "${pkg.packageName}". Scalala a mano da Trattamenti e Pacchetti.`);
      }
    }

    // Le due cose non si escludono: nella stessa seduta ci può essere il
    // trattamento del pacchetto (a 0 €) più altri da pagare. Prima si scala la
    // seduta, poi si va in cassa a incassare quello che resta.
    const daIncassare = services.filter(s => s.price > 0);
    // Carrello unico ma in cassa viaggiano separati: i trattamenti come conto
    // della seduta, i prodotti come righe di magazzino (scaricano la giacenza
    // e contano nella classifica upsell di chi li ha venduti).
    const trattamentiPagati = daIncassare.filter(s => !s.productId);
    const prodottiInCarrello = daIncassare.filter(s => s.productId);
    // Il conto che arriva in cassa è quello concordato: se sulla seduta c'è uno
    // sconto, lo scontrino deve dire quella cifra, non il listino.
    const totaleTrattamenti = Math.max(0, trattamentiPagati.reduce((sum, s) => sum + s.price, 0) - (appointment.discountAmount || 0));

    if (totaleDaIncassare > 0) {
      onClose();
      try {
        sessionStorage.setItem('revo_pos_autosale', JSON.stringify({
          appointmentId: appointment.id,
          client: appointment.clientName,
          // Con più trattamenti il conto è unico: nome e totale di tutta la seduta
          treatment: trattamentiPagati.map(s => s.treatmentName).join(' + '),
          treatmentId: trattamentiPagati.length > 0 ? appointment.treatmentId : '',
          price: totaleTrattamenti,
          products: prodottiInCarrello.map(s => ({ id: s.productId, name: s.treatmentName, price: s.price, qty: 1 })),
          operator: appointment.operatorName,
          cabinMinutes,
        }));
      } catch { /* no-op */ }
      router.push('/dashboard/pos');
      return;
    }

    onClose();
  };

  // Con dei pacchetti attivi si chiede sempre da quale scalare la seduta
  const askWhichPackage = () => {
    setPkgChoice(bookedPkg ? bookedPkg.id : 'none');
    setShowPkgModal(true);
  };

  // Manda in cassa a saldare le rate di un pacchetto
  const goPayDebt = (pkg: typeof clientPkgs[number]) => {
    setShowPkgModal(false);
    setShowDebtModal(false);
    try {
      sessionStorage.setItem('revo_pos_autosale', JSON.stringify({
        client: appointment.clientName,
        treatment: `Rata Pacchetto: ${pkg.packageName}`,
        price: pkg.remainingBalance,
        operator: appointment.operatorName || 'Staff',
        debtPkgId: pkg.id,
      }));
    } catch { /* no-op */ }
    router.push('/dashboard/pos');
  };

  const handleCheckoutClick = () => {
    // Prenotata come "Seduta da pacchetto"? Allora si scala QUEL pacchetto,
    // in automatico e senza domande: il modale di scelta lasciava spazio a
    // check-out completati senza scalare niente (vissuto, non teoria).
    if (bookedPkg && packagesWithDebt.length === 0) { void processCheckout(undefined); return; }
    // Negli altri casi: prima le rate in sospeso, poi l'eventuale scelta
    if (packagesWithDebt.length > 0) setShowDebtModal(true);
    else if (usablePkgs.length > 0) askWhichPackage();
    else processCheckout(null);
  };

  /**
   * La cliente sta entrando ADESSO: se l'appuntamento è su un altro giorno
   * quasi sempre è stata sbagliata la data in prenotazione, e trattamento e
   * incasso finirebbero su una giornata che non c'entra. Si avvisa qui, prima
   * del check-in, con la possibilità di correggere la data al volo.
   */
  const handleCheckInClick = () => {
    // Prima di tutto la scheda: se mancano i dati chiave il check-in si ferma
    // qui e si apre il modulo da completare. L'obiettivo è zero schede a metà.
    //
    // Si apre anche a scheda completa quando manca il consenso ai messaggi:
    // è la sola occasione in cui la cliente è davanti a te e glielo puoi
    // chiedere. Senza consenso non riceve né auguri né l'avviso di un posto
    // che si libera — e il consenso non si può spuntare per lei, va chiesto.
    if (clientData && (!schedaCompleta(clientData) || !clientData.marketingConsent)) {
      setSchedaForm({
        birthDate: clientData.birthDate || '',
        gender: (clientData.gender === 'M' ? 'M' : clientData.gender === 'F' ? 'F' : ''),
        address: clientData.address || '',
        city: clientData.city || '',
        email: clientData.email || '',
        marketing: Boolean(clientData.marketingConsent),
      });
      setSchedaOpen(true);
      return;
    }
    dopoControlloScheda();
  };

  /** Il check-in vero e proprio, dopo che la scheda risulta a posto. */
  const dopoControlloScheda = () => {
    if (appointment.date !== todayRome()) setDateWarn(true);
    else openCabinPicker();
  };

  const schedaPronta = Boolean(schedaForm.birthDate && schedaForm.gender && schedaForm.address.trim() && schedaForm.city.trim());

  /** Salva i dati completati e prosegue con il check-in. */
  const salvaSchedaEContinua = async () => {
    if (!clientData || !schedaPronta) return;
    setSchedaBusy(true);
    try {
      await updateClientInStore(clientData.id, {
        birthDate: schedaForm.birthDate,
        gender: schedaForm.gender as 'F' | 'M',
        address: schedaForm.address.trim(),
        city: schedaForm.city.trim(),
        email: schedaForm.email.trim() || undefined,
        marketingConsent: schedaForm.marketing,
      });
      setSchedaOpen(false);
      dopoControlloScheda();
    } finally {
      setSchedaBusy(false);
    }
  };

  /** Porta l'appuntamento a oggi (stessi orari) e prosegue col check-in. */
  const spostaAOggiEContinua = async () => {
    setDateWarn(false);
    await updateAppt(appointment.id, { date: todayRome() });
    openCabinPicker();
  };

  const continuaComunque = () => {
    setDateWarn(false);
    openCabinPicker();
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
            {/* Trattamenti: ognuno con il suo check-in/check-out, conto unico alla fine */}
            <div className="rounded-xl bg-bg-tertiary/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Trattamenti {services.length > 1 && <span className="text-text-muted">({services.length})</span>}
                </p>
                {appointment.status !== 'completed' && !addingTreatment && !addingProduct && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setAddingTreatment(true)} disabled={busySvc}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50">
                      <Plus className="w-3 h-3" /> Aggiungi
                    </button>
                    <button onClick={() => setAddingProduct(true)} disabled={busySvc}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warning/10 text-warning text-[11px] font-semibold hover:bg-warning/20 transition-colors disabled:opacity-50">
                      <Plus className="w-3 h-3" /> Prodotto
                    </button>
                  </div>
                )}
              </div>

              {services.map((s, i) => (
                <div key={`${s.treatmentId}-${i}`} className="flex items-center gap-2 rounded-lg bg-bg-secondary/70 border border-border/60 p-2.5">
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: appointment.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{s.productId ? `🧴 ${s.treatmentName}` : s.treatmentName}</p>
                    <p className="text-xs text-text-secondary">
                      {s.productId ? 'Prodotto' : `${s.duration} min`} · {formatCurrency(s.price)}
                    </p>
                    {/* Chi lo fa, cambiabile anche ad appuntamento già preso:
                        capita di continuo che una delle tre cose la faccia la
                        collega, e prima bisognava entrare in modifica. */}
                    {!s.productId && appointment.status !== 'completed' && (
                      <select value={s.operatorId || ''} disabled={busySvc}
                        onChange={e => cambiaOperatriceServizio(i, e.target.value)}
                        title="Chi esegue questo trattamento"
                        className="mt-1.5 w-full max-w-[190px] px-2 py-1 rounded-lg bg-bg-secondary border border-border
                          text-[11px] text-text-secondary focus:outline-none focus:border-accent/50 disabled:opacity-50">
                        <option value="">Lo fa {appointment.operatorName}</option>
                        {operators.filter(o => !o.isResource && o.id !== appointment.operatorId).map(o => (
                          <option key={o.id} value={o.id}>Lo fa {o.firstName} {o.lastName}</option>
                        ))}
                      </select>
                    )}
                    {s.productId === undefined && s.operatorId && s.operatorId !== appointment.operatorId && appointment.status === 'completed' && (
                      <p className="text-xs text-accent">{s.operatorName || 'altra operatrice'}</p>
                    )}
                  </div>
                  {services.length > 1 && appointment.status !== 'completed' && (
                    <button onClick={() => removeServiceAt(i)} disabled={busySvc} title="Togli trattamento"
                      className="p-1 rounded-md text-text-muted hover:text-error flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}

              {addingTreatment && (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input autoFocus type="text" value={treatmentQuery} onChange={e => setTreatmentQuery(e.target.value)}
                      placeholder="Cerca trattamento da aggiungere..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
                    <button onClick={() => { setAddingTreatment(false); setTreatmentQuery(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-border bg-bg-secondary shadow-xl">
                    {treatmentResults.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-text-muted text-center">Nessun trattamento trovato</p>
                    ) : treatmentResults.map(t => (
                      <button key={t.id} onClick={() => addTreatmentToAppointment(t)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-left">
                        <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{t.name}</span>
                        <span className="text-[11px] text-text-muted flex-shrink-0">
                          {t.durationFemale ?? t.duration}min · {formatCurrency(t.priceFemale ?? t.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prodotti dal magazzino: la crema consigliata entra nel carrello della seduta */}
              {addingProduct && (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input autoFocus type="text" value={productQuery} onChange={e => setProductQuery(e.target.value)}
                      placeholder="Cerca prodotto da aggiungere..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-warning/50" />
                    <button onClick={() => { setAddingProduct(false); setProductQuery(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-border bg-bg-secondary shadow-xl">
                    {productResults.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-text-muted text-center">Nessun prodotto trovato</p>
                    ) : productResults.map(p => (
                      <button key={p.id} onClick={() => addProductToAppointment(p)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors text-left">
                        <span className="flex-1 min-w-0 text-sm text-text-primary truncate">🧴 {p.name}</span>
                        <span className="text-[11px] text-text-muted flex-shrink-0">
                          {p.stock <= 0 ? 'esaurito · ' : p.stock <= p.minStock ? `${p.stock} rimasti · ` : ''}{formatCurrency(p.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {services.length > 1 && (
                <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-sm">
                  <span className="text-text-secondary">Totale ({appointment.duration} min)</span>
                  <span className="font-bold text-text-primary">{formatCurrency(appointment.price)}</span>
                </div>
              )}

              {/*
                Il prezzo concordato.

                Al bancone si tratta: "a Rosario gli abbiamo fatto 80 per
                prenderlo". Se quel numero resta solo nella testa di chi l'ha
                detto, chi incassa batte il listino e la promessa salta. Qui si
                scrive una volta e vale ovunque: in agenda, nell'incasso
                previsto, in cassa e sullo scontrino.
              */}
              {!(appointment.isLocked || appointment.status === 'completed') && (
                scontoAperto ? (
                  <div className="pt-2 mt-1 border-t border-border/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Prezzo concordato</label>
                        <input type="number" min={0} step="0.5" value={prezzoConcordato} autoFocus
                          onChange={e => setPrezzoConcordato(e.target.value)}
                          placeholder={String(listino)}
                          className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Perché</label>
                        <input type="text" value={motivoSconto} {...NO_AUTOFILL}
                          onChange={e => setMotivoSconto(e.target.value)}
                          placeholder="es. prima volta"
                          className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted" />
                      </div>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Listino {formatCurrency(listino)}
                      {Number(prezzoConcordato) > 0 && Number(prezzoConcordato) < listino
                        ? ` · sconto ${formatCurrency(listino - Number(prezzoConcordato))}`
                        : ''}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setScontoAperto(false)}
                        className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
                        Annulla
                      </button>
                      <button onClick={salvaSconto} disabled={busySvc}
                        className="flex-1 py-2 rounded-xl gradient-accent text-white text-xs font-bold disabled:opacity-50">
                        Applica
                      </button>
                    </div>
                  </div>
                ) : appointment.discountAmount ? (
                  <div className="flex items-center justify-between gap-2 pt-1.5 mt-1 border-t border-border/60">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-success">
                        Sconto {formatCurrency(appointment.discountAmount)}
                        {appointment.discountReason ? ` — ${appointment.discountReason}` : ''}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        Listino {formatCurrency(listino)} · paga <b className="text-text-primary">{formatCurrency(appointment.price)}</b>
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={apriSconto} className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary text-[11px] font-medium text-text-secondary hover:bg-bg-hover">Cambia</button>
                      <button onClick={togliSconto} disabled={busySvc} className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary text-[11px] font-medium text-error hover:bg-error/10 disabled:opacity-50">Togli</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={apriSconto}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1 rounded-lg bg-bg-tertiary/60 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover transition-colors">
                    <Euro className="w-3 h-3" /> Fai un prezzo diverso dal listino
                  </button>
                )
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Orario</p><p className="text-sm font-medium text-text-primary">{appointment.startTime} - {appointment.endTime}</p></div>
              <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Prezzo</p><p className="text-sm font-medium text-text-primary">{formatCurrency(appointment.price)}</p></div>
            </div>
            <div className="p-3 rounded-xl bg-bg-tertiary/50"><p className="text-xs text-text-muted mb-1">Operatrice</p><p className="text-sm font-medium text-text-primary">{appointment.operatorName}</p></div>

            {/* Perché la corona: senza i numeri sarebbe un vezzo, e chi entra
                in cabina deve sapere quanto vale la persona che ha davanti. */}
            {coccolaQuesta && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/30">
                <Crown className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Fra le clienti che spendono di più {coccolaQuesta.posizione <= 3 ? `— è la n° ${coccolaQuesta.posizione}` : ''}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {riassunto(coccolaQuesta)} negli ultimi 12 mesi. Trattala col guanto: offrile il caffè,
                    chiedile come è andata l&apos;ultima volta, non farla aspettare.
                  </p>
                </div>
              </div>
            )}

            {(appointment.checkInAt || appointment.checkOutAt) && (
              <div className="p-3 rounded-xl bg-pink-500/5 border border-pink-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  <p className="text-xs font-semibold text-pink-400">Tempo in cabina</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[11px] text-text-muted">Check-in</p><p className="text-sm font-medium text-text-primary">{fmtClock(appointment.checkInAt) || '—'}</p></div>
                  <div><p className="text-[11px] text-text-muted">Check-out</p><p className="text-sm font-medium text-text-primary">{fmtClock(appointment.checkOutAt) || (appointment.status === 'in_cabin' ? 'in corso…' : '—')}</p></div>
                </div>
                {appointment.status === 'in_cabin' && (
                  <div className="mt-3">
                    <CabinCountdown appointment={appointment} size="lg" />
                    <p className="text-[10px] text-text-muted text-center mt-1">
                      {appointment.duration} minuti dal check-in · a tempo scaduto parte l&apos;avviso
                    </p>
                  </div>
                )}
                {cabinMinutes !== null && (
                  <p className="mt-2 text-sm font-bold text-text-primary">⏱️ {cabinMinutes} min effettivi <span className="text-xs font-normal text-text-muted">(previsti {appointment.duration} min)</span></p>
                )}
              </div>
            )}

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
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">📦 Pacchetti Attivi</p>
                {/* Con più pacchetti aperti conta il totale, non la singola riga */}
                {clientPkgs.length > 1 && totalPkgDebt > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-error/10 text-error">
                    In tutto deve {formatCurrency(totalPkgDebt)}
                  </span>
                )}
              </div>
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

                      {/* Parte economica: quanto ha già dato e quanto manca ancora.
                          Serve qui perché è il momento in cui la cliente è davanti. */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                        <div className="flex-1 min-w-0">
                          {cp.pricePaid === 0 ? (
                            <p className="text-[11px] font-semibold text-accent">🎁 Omaggio — niente da pagare</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-text-muted">
                                Ha dato <strong className="text-success">{formatCurrency(cp.totalPaid || 0)}</strong> su {formatCurrency(cp.pricePaid)}
                              </p>
                              {(cp.remainingBalance || 0) > 0 ? (
                                <p className="text-[11px] font-bold text-error">Deve ancora dare {formatCurrency(cp.remainingBalance)}</p>
                              ) : (
                                <p className="text-[11px] font-semibold text-success">✓ Saldato</p>
                              )}
                            </>
                          )}
                        </div>
                        {(cp.remainingBalance || 0) > 0 && (
                          <button type="button" onClick={() => goPayDebt(cp)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/15 text-accent text-[10px] font-bold hover:bg-accent/25 transition-colors flex-shrink-0">
                            <Euro className="w-3 h-3" /> Incassa
                          </button>
                        )}
                      </div>

                      {/* L'omaggio inaugurazione si può cambiare finché non è stato usato */}
                      {isGiftPackage(cp.packageName) && cp.usedSessions === 0 && (
                        changingGift === cp.id ? (
                          <div className="mt-2 space-y-1">
                            <p className="text-[10px] text-text-muted">Quale omaggio vuole fare?</p>
                            {GIFT_OPTIONS.map(opt => {
                              const current = cp.packageName.toLowerCase() === opt.name.toLowerCase();
                              return (
                                <button key={opt.key} type="button" disabled={current || savingGift}
                                  onClick={async () => {
                                    setSavingGift(true);
                                    try {
                                      await changeGiftTreatment(cp.id, opt.key);
                                      await refreshPackages();
                                      setChangingGift(null);
                                    } finally { setSavingGift(false); }
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                    current ? 'bg-accent/15 text-accent cursor-default' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                                  }`}>
                                  <span className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                                  <span className="flex-1 text-left">{opt.label}</span>
                                  {current && <span className="text-[9px] font-bold uppercase">attuale</span>}
                                </button>
                              );
                            })}
                            <button type="button" onClick={() => setChangingGift(null)}
                              className="w-full py-1 text-[10px] text-text-muted hover:text-text-primary">Annulla</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setChangingGift(cp.id)}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-warning/10 text-warning text-[11px] font-semibold hover:bg-warning/20 transition-colors">
                            <Sparkles className="w-3 h-3" /> Cambia trattamento omaggio
                          </button>
                        )
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
            /* Appuntamento chiuso: modifiche bloccate (protezione anti-frode).
               Ma "chiuso" e "pagato" sono due cose diverse, e confonderle è
               costato incassi: il check-out chiude la seduta e solo dopo manda
               in cassa: se l'incasso non viene completato, qui si leggeva
               "pagato" su soldi mai presi. */
            incassata === false ? (
              <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-error/10 border border-error/30">
                <div className="w-9 h-9 rounded-full bg-error/15 flex items-center justify-center flex-shrink-0">
                  <Euro className="w-4 h-4 text-error" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-error">Seduta chiusa ma NON incassata</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Il trattamento risulta fatto, ma di questi {formatCurrency(appointment.price)} non c&apos;è traccia
                    in cassa e non è stato emesso nessuno scontrino.
                  </p>
                  <button onClick={vaiAIncassare}
                    className="mt-2.5 w-full py-2 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 transition-opacity">
                    Incassa adesso
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-4 rounded-2xl bg-success/5 border border-success/20">
                <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-success" />
                </div>
                <div>
                  {/* Finché la cassa non ha risposto non si scrive "pagato":
                      è proprio la parola che ha coperto i 400 € mancanti. */}
                  <p className="text-sm font-semibold text-text-primary">
                    {incassata === true ? 'Appuntamento completato e pagato' : 'Appuntamento completato'}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {incassata === null
                      ? 'Controllo in cassa se è stato incassato…'
                      : 'L\u2019appuntamento è chiuso e non può più essere modificato, annullato o eliminato.'}
                  </p>
                </div>
              </div>
            )
          ) : (
          <div className="space-y-2">
            {!['in_progress', 'in_cabin'].includes(appointment.status) && (
              <button onClick={() => onEdit(appointment)} className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Modifica Appuntamento
              </button>
            )}

            {/* Scelta della cabina prima del check-in: è il nome che la voce
                annuncerà a tempo scaduto ("Cabina 4 ha finito il trattamento") */}
            {askingCabin && (
              <div className="mt-3 p-3 rounded-xl bg-pink-500/5 border border-pink-500/20 space-y-2.5">
                <p className="text-xs font-semibold text-text-primary">In quale cabina entra?</p>
                {/* Le cabine arrivano da Impostazioni → Cabine: numero e, se c'è, nome */}
                <div className={`grid gap-1.5 ${cabins.some(c => c.nome) ? 'grid-cols-3' : 'grid-cols-6'}`}>
                  {cabins.map(c => (
                    <button key={c.numero} onClick={() => setCabin(c.numero)}
                      className={`py-2 px-1 rounded-lg transition-colors ${cabin === c.numero ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-primary hover:bg-bg-hover'}`}>
                      <span className="block text-sm font-bold leading-tight">{c.numero}</span>
                      {c.nome && <span className="block text-[9px] leading-tight truncate opacity-80">{c.nome}</span>}
                    </button>
                  ))}
                </div>
                <input type="text" value={cabin} onChange={e => setCabin(e.target.value)} {...NO_AUTOFILL}
                  placeholder="oppure scrivi (es. 7, Sala Laser)"
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
                <div className="flex gap-2">
                  <button onClick={() => setAskingCabin(false)}
                    className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                    Annulla
                  </button>
                  <button onClick={() => doCheckIn(cabin)}
                    className="flex-1 py-2 rounded-lg gradient-accent text-white text-xs font-bold hover:opacity-90 transition-opacity">
                    {cabin.trim() ? `Check-in in cabina ${cabin.trim()}` : 'Check-in senza cabina'}
                  </button>
                </div>
              </div>
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
                  <button onClick={handleCheckInClick}
                    className="py-2.5 rounded-xl text-sm font-medium transition-colors bg-pink-500/10 text-pink-400 hover:bg-pink-500/20">
                    <span className="flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5" /> Check-in</span>
                  </button>
                  <button onClick={() => { onStatusChange(appointment.id, 'no_show'); onClose(); }}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${appointment.status === 'no_show' ? 'bg-error/20 text-error ring-1 ring-error/30' : 'bg-error/10 text-error hover:bg-error/20'}`}>
                    <span className="flex items-center justify-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> No-Show</span>
                  </button>
                </>
              )}

              <button onClick={() => { setReasonText(appointment.cancelReason || ''); setCancelOpen(true); }}
                className={`col-span-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${appointment.status === 'cancelled' ? 'bg-error/15 text-error ring-1 ring-error/30' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                <span className="flex items-center justify-center gap-1.5"><Ban className="w-3.5 h-3.5" /> {appointment.status === 'cancelled' ? 'Annullato — modifica motivo' : 'Annulla appuntamento'}</span>
              </button>
            </div>

            {/* Motivo annullamento già registrato */}
            {appointment.status === 'cancelled' && appointment.cancelReason && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-xl bg-error/5 border border-error/15">
                <Ban className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-error">Motivo annullamento</p>
                  <p className="text-xs text-text-secondary">{appointment.cancelReason}</p>
                </div>
              </div>
            )}

            {/* Elimina definitivamente (solo per errori di inserimento) */}
            {!['in_progress', 'in_cabin'].includes(appointment.status) && (
              <div className="pt-3 border-t border-border mt-4">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { onDelete(appointment.id); onClose(); }}
                      className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors">
                      Sì, elimina senza traccia
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="w-full py-2 rounded-xl text-text-muted text-xs font-medium hover:text-error hover:bg-error/5 transition-colors">
                    Elimina definitivamente (errore di inserimento)
                  </button>
                )}
                <p className="text-[10px] text-text-muted text-center mt-1">Per le disdette usa &quot;Annulla&quot;: resta nello storico del cliente.</p>
              </div>
            )}
          </div>
          )}
        </div>
      </motion.div>

      {/* Modale motivo annullamento */}
      {cancelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCancelOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md z-10">
            <div className="flex items-center gap-3 mb-1 text-error">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg font-display font-bold text-text-primary">Annulla appuntamento</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">{appointment.clientName} • {appointment.startTime}. Indica il motivo (resta nello storico del cliente).</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {['Disdetta del cliente', 'Disdetta last-minute', 'Non si è presentato', 'Malattia', 'Ha spostato l\'appuntamento', 'Chiusura salone'].map(r => (
                <button key={r} onClick={() => setReasonText(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reasonText === r ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} rows={2} placeholder="Oppure scrivi un motivo..."
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelOpen(false)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Indietro</button>
              <button onClick={() => { onCancelWithReason(appointment.id, reasonText.trim() || 'Nessun motivo indicato'); setCancelOpen(false); onClose(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors">
                <Ban className="w-4 h-4" /> Conferma annullamento
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
                      try {
                        sessionStorage.setItem('revo_pos_autosale', JSON.stringify({
                          client: appointment.clientName,
                          treatment: `Rata Pacchetto: ${pkg.packageName}`,
                          price: pkg.remainingBalance,
                          operator: appointment.operatorName || 'Staff',
                          debtPkgId: pkg.id,
                        }));
                      } catch { /* no-op */ }
                      router.push('/dashboard/pos');
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
                // Anche da qui: la seduta prenotata da pacchetto si scala da sola
                if (bookedPkg) void processCheckout(undefined);
                else if (usablePkgs.length > 0) askWhichPackage();
                else processCheckout(null);
              }} className="flex-1 py-2.5 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-bg-hover transition-colors">
                Salta per oggi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Scheda cliente incompleta: il check-in aspetta finché non è a posto.
          I dati si prendono ORA, con la cliente al banco: dopo non li recupera
          più nessuno. Solo l'email può restare vuota (molti non la ricordano). */}
      {schedaOpen && clientData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSchedaOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md rounded-2xl border-2 border-accent/40 bg-bg-secondary shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 px-5 py-4 bg-accent/10">
              <div className="w-11 h-11 rounded-full bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-display font-bold text-text-primary">Completa la scheda di {clientData.firstName}</h3>
                <p className="text-xs text-text-secondary">
                  Manca: {campiMancanti(clientData).join(', ')}. La cliente è qui: chiediglieli adesso.
                </p>
              </div>
              <button onClick={() => setSchedaOpen(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary flex-shrink-0">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Data di nascita *</label>
                  <input type="date" value={schedaForm.birthDate}
                    onChange={e => setSchedaForm(f => ({ ...f, birthDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Sesso *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['F', 'M'] as const).map(g => (
                      <button key={g} onClick={() => setSchedaForm(f => ({ ...f, gender: g }))}
                        className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${schedaForm.gender === g ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                        {g === 'F' ? '♀ Donna' : '♂ Uomo'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Indirizzo *</label>
                <input type="text" value={schedaForm.address} {...NO_AUTOFILL}
                  onChange={e => setSchedaForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Via e numero civico"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Città *</label>
                <input type="text" value={schedaForm.city} {...NO_AUTOFILL}
                  onChange={e => setSchedaForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Es. Maddaloni"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Email (facoltativa, ma chiedila)</label>
                <input type="email" value={schedaForm.email} {...NO_AUTOFILL}
                  onChange={e => setSchedaForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Se non la ricorda, lascia vuoto"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted" />
              </div>
              <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={schedaForm.marketing}
                  onChange={e => setSchedaForm(f => ({ ...f, marketing: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-accent" />
                <span>
                  Acconsente a ricevere messaggi su WhatsApp: auguri di compleanno e
                  <strong className="text-text-primary"> l&apos;avviso quando si libera un posto</strong>.
                  Senza questa spunta non riceve nulla — chiediglielo, non spuntarla per lei.
                </span>
              </label>
            </div>

            <div className="p-5 pt-0 space-y-2">
              <button onClick={salvaSchedaEContinua} disabled={!schedaPronta || schedaBusy}
                className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                {schedaBusy ? 'Salvataggio…' : 'Salva la scheda e fai il check-in'}
              </button>
              <button onClick={() => setSchedaOpen(false)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                Chiudi senza check-in
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Data diversa da oggi: quasi sempre è un errore di prenotazione */}
      {dateWarn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDateWarn(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md rounded-2xl border-2 border-warning/40 bg-bg-secondary shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-warning/10">
              <div className="w-11 h-11 rounded-full bg-warning/20 flex items-center justify-center text-warning flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-text-primary">La data non è quella di oggi</h3>
                <p className="text-xs text-text-secondary">Controlla prima di far entrare la cliente</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-xl border border-border bg-bg-tertiary/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Appuntamento</span>
                  <strong className="text-warning capitalize">{formatDateLong(appointment.date)}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Oggi</span>
                  <strong className="text-text-primary capitalize">{formatDateLong(todayRome())}</strong>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                La cliente sta entrando adesso: se l&apos;appuntamento è su un altro giorno, con ogni
                probabilità la data è stata sbagliata quando è stato preso. Continuando, il trattamento
                e il suo incasso resteranno registrati su quel giorno e non su oggi.
              </p>
            </div>

            <div className="p-5 pt-0 space-y-2">
              <button onClick={spostaAOggiEContinua}
                className="w-full py-2.5 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 transition-opacity">
                Sposta a oggi e continua
              </button>
              <div className="flex gap-2">
                <button onClick={() => setDateWarn(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                  Annulla
                </button>
                <button onClick={continuaComunque}
                  className="flex-1 py-2.5 rounded-xl bg-bg-tertiary text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                  Continua comunque
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Da quale pacchetto scalo la seduta? */}
      {showPkgModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPkgModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md z-10">
            <div className="flex items-center gap-3 mb-1 text-accent">
              <Package className="w-6 h-6" />
              <h3 className="text-lg font-display font-bold text-text-primary">Da quale pacchetto scalo?</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              <strong className="text-text-primary">{appointment.clientName}</strong> — {appointment.treatmentName}
            </p>

            {packagesWithDebt.length > 0 && (
              <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" /> Rate in sospeso
                </p>
                {packagesWithDebt.map(pkg => (
                  <div key={pkg.id} className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-[11px] text-text-secondary truncate">
                      {pkg.packageName}: <strong className="text-error">{formatCurrency(pkg.remainingBalance)}</strong> da pagare
                    </p>
                    <button onClick={() => goPayDebt(pkg)}
                      className="px-2 py-1 rounded-lg bg-accent/15 text-accent text-[11px] font-semibold hover:bg-accent/25 transition-colors flex items-center gap-1 flex-shrink-0">
                      <Euro className="w-3 h-3" /> Incassa
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-5 max-h-[45vh] overflow-y-auto">
              {usablePkgs.map(cp => {
                const remaining = cp.totalSessions - cp.usedSessions;
                const isFree = cp.pricePaid === 0;
                const selected = pkgChoice === cp.id;
                return (
                  <button key={cp.id} type="button" onClick={() => setPkgChoice(cp.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${selected ? 'border-accent bg-accent/10' : 'border-border bg-bg-tertiary/40 hover:bg-bg-hover'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-accent' : 'border-border'}`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: cp.packageColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary truncate">{cp.packageName}</p>
                          {isFree
                            ? <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[10px] font-bold uppercase">Omaggio</span>
                            : <span className="px-1.5 py-0.5 rounded bg-success/15 text-success text-[10px] font-bold uppercase">Già pagato</span>}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {remaining} {remaining === 1 ? 'seduta rimanente' : 'sedute rimanenti'} su {cp.totalSessions}
                          {cp.id === bookedPkg?.id && ' · scelto in prenotazione'}
                        </p>
                        {/* Seduta mista: si scala E si incassa, non è più o l'uno o l'altro */}
                        {totaleDaIncassare > 0 && (
                          <p className="text-[11px] text-accent mt-0.5">
                            + incassa {formatCurrency(totaleDaIncassare)} degli altri trattamenti
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-text-primary flex-shrink-0">0,00 €</span>
                    </div>
                  </button>
                );
              })}

              <button type="button" onClick={() => setPkgChoice('none')}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${pkgChoice === 'none' ? 'border-accent bg-accent/10' : 'border-border bg-bg-tertiary/40 hover:bg-bg-hover'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${pkgChoice === 'none' ? 'border-accent' : 'border-border'}`}>
                    {pkgChoice === 'none' && <div className="w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <Euro className="w-4 h-4 text-text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Nessun pacchetto — incassa in cassa</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Non scala nessuna seduta, apre il punto cassa</p>
                  </div>
                  <span className="text-sm font-bold text-text-primary flex-shrink-0">{formatCurrency(appointment.price)}</span>
                </div>
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPkgModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                Annulla
              </button>
              <button onClick={() => { setShowPkgModal(false); processCheckout(pkgChoice === 'none' ? null : pkgChoice); }}
                className="flex-1 py-2.5 rounded-xl bg-success/15 text-success text-sm font-bold hover:bg-success/25 transition-colors flex items-center justify-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Conferma check-out
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
  const fetchPackages = usePackageStore(s => s.fetchPackages);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [blockModal, setBlockModal] = useState<{ operatorId: string; operatorName: string; start: string; end: string } | null>(null);

  useEffect(() => {
    fetchAppointments();
    fetchBlocks();
    fetchOperators();
    fetchClients();
    fetchTreatments();
    fetchPackages(); // pacchetti cliente: servono per mostrare l'omaggio inaugurazione nel modale
  }, [fetchAppointments, fetchBlocks, fetchOperators, fetchClients, fetchTreatments, fetchPackages]);

  // Agenda sempre aggiornata: appuntamenti, clienti e TURNI ricaricati da soli.
  // Così un cambio turno (orario, pausa, riposo) si riflette in disponibilità
  // e indisponibilità senza ricaricare la pagina.
  useAutoRefresh(useCallback(() => {
    // Non mentre si trascina: ricaricare gli appuntamenti ricostruisce tutti
    // i blocchi e il trascinamento in corso muore a metà, senza spiegazioni.
    if (trascinamento.attivo) return;
    fetchAppointments();
    fetchBlocks();
    fetchClients();
    fetchOperators();
  }, [fetchAppointments, fetchBlocks, fetchClients, fetchOperators]), 20000);

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
    () => operators
      .filter(op => selectedOperatorIds.includes(op.id))
      // le cabine/risorse vanno sempre in fondo, dopo le operatrici
      .sort((a, b) => (a.isResource ? 1 : 0) - (b.isResource ? 1 : 0)),
    [selectedOperatorIds, operators]
  );

  const operatorColorById = useMemo(() => {
    const map: Record<string, string> = {};
    operators.forEach(op => { map[op.id] = op.color; });
    return map;
  }, [operators]);

  const dateStr = fmtDate(selectedDate);

  // Gli appuntamenti annullati spariscono dal calendario: lo slot torna libero.
  // Restano comunque salvati nel database per lo storico e le statistiche.
  const visibleAppointments = useMemo(
    () => appointments.filter(a => a.status !== 'cancelled'),
    [appointments]
  );

  const todayAppointments = useMemo(
    () => visibleAppointments.filter(a => a.date === dateStr),
    [visibleAppointments, dateStr]
  );

  const todayBlocks = useMemo(
    () => blocks.filter(b => b.date === dateStr),
    [blocks, dateStr]
  );

  /** Il buco che si sta per offrire alle clienti: prima si conferma, poi si spende. */
  const [bucoDaOffrire, setBucoDaOffrire] = useState<{
    date: string; from: string; to: string;
    operatorId: string; operatorName: string;
    treatment: Treatment; durata: number;
  } | null>(null);

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

  // Incasso stimato: di default segue il periodo mostrato in agenda (giorno/settimana/mese),
  // ma dal pannello si può scegliere qualsiasi data o intervallo dal calendario.
  const [showRevenuePanel, setShowRevenuePanel] = useState(false);
  /** L'anagrafica, per la ricerca cliente nella barra. */
  const clientiInAnagrafica = useClientStore(s => s.clients);

  /*
    Le clienti che tengono in piedi il centro.

    Si calcola dagli incassi veri (il campo `totalSpent` in anagrafica è a zero
    per tutte, non lo aggiorna nessuno) e si legge una volta sola all'apertura:
    è un numero che si muove di giorno in giorno, non di minuto in minuto.
  */
  const [coccole, setCoccole] = useState<Map<string, { speso: number; visite: number; posizione: number }>>(new Map());
  useEffect(() => {
    clientiTop()
      .then(lista => setCoccole(new Map(lista.map(c => [chiaveNome(c.nome), { speso: c.speso, visite: c.visite, posizione: c.posizione }]))))
      .catch(() => {});
  }, []);
  const [customRevenuePeriod, setCustomRevenuePeriod] = useState<RevenuePeriod | null>(null);
  const revenuePeriod = useMemo(
    () => customRevenuePeriod ?? periodFor(view, selectedDate),
    [customRevenuePeriod, view, selectedDate]
  );
  const revenueStats = useMemo(
    () => computeRevenueStats(appointments, revenuePeriod),
    [appointments, revenuePeriod]
  );

  const handleSlotBlock = useCallback((operatorId: string, hour: number) => {
    const op = operators.find(o => o.id === operatorId);
    setBlockModal({
      operatorId,
      operatorName: op ? `${op.firstName} ${op.lastName}` : 'Operatrice',
      start: `${String(hour).padStart(2, '0')}:00`,
      end: `${String(Math.min(hour + 1, END_HOUR)).padStart(2, '0')}:00`,
    });
  }, [operators]);

  const handleRemoveBlock = useCallback((block: AgendaBlock) => {
    if (window.confirm(`Sbloccare la fascia ${block.startTime}–${block.endTime}${block.reason ? ` (${block.reason})` : ''}?`)) {
      removeBlock(block.id);
    }
  }, [removeBlock]);

  // Header label
  const headerLabel = useMemo(() => {
    // Nella giornata la data va abbreviata: "Martedì 11 Agosto 2026" per
    // esteso mangia duecento pixel e spinge fuori riga il resto della barra.
    if (view === 'day') {
      return parseDateStr(dateStr).toLocaleDateString('it-IT', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      }).replace('.', '');
    }
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
      {/*
        Barra dei comandi: UNA riga sola.

        Tutti i controlli hanno la stessa altezza (BTN) e nessuno va a capo:
        `flex-nowrap` lo impedisce.

        Ci sta perché le azioni secondarie sono solo icone con il nome nel
        suggerimento: il testo per esteso resta a quello che si preme cento
        volte al giorno, cioè Nuovo appuntamento.

        Niente `overflow-x-auto` qui: ritagliava le tendine che si aprono da
        questa barra (ricerca cliente, calendarietto, incasso). Un contenitore
        che scorre in orizzontale taglia anche in verticale, e i menu
        sparivano senza dare segno di vita.
      */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="flex items-center rounded-xl border border-border overflow-hidden h-10 flex-shrink-0">
            <button onClick={goToPrev} title="Indietro"
              className="h-full px-2.5 hover:bg-bg-hover text-text-secondary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            {/* "Oggi" vuol dire la giornata di oggi, non il mese in cui
                cade: chi lo preme vuole vedere gli appuntamenti di adesso. */}
            <button onClick={() => { goToToday(); setView('day'); }} title="Vai all'agenda di oggi"
              className="h-full px-3 border-x border-border hover:bg-bg-hover text-sm font-medium text-text-primary transition-colors">Oggi</button>
            <button onClick={goToNext} title="Avanti"
              className="h-full px-2.5 hover:bg-bg-hover text-text-secondary transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="relative flex-shrink-0">
            <button onClick={() => setShowDatePicker(v => !v)}
              className="flex items-center gap-1.5 h-10 px-2.5 rounded-xl hover:bg-bg-hover transition-colors group"
              title="Clicca per scegliere la data">
              <h2 className="text-base font-display font-semibold text-text-primary capitalize whitespace-nowrap">{headerLabel}</h2>
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

          {view !== 'month' && (
            <button onClick={() => setView('month')} title="Torna alla vista mensile"
              className={`${ICONA} border bg-accent/10 border-accent/30 text-accent hover:bg-accent/20`}>
              <CalendarDays className="w-4 h-4" />
            </button>
          )}

          {/* I due numeri della giornata in un solo riquadro: erano due
              pillole diverse per dire una cosa sola. */}
          {view === 'day' && (
            <span title={`${totalApts} appuntamenti oggi, ${completedApts} già completati`}
              className="hidden 2xl:inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-bg-tertiary text-sm text-text-secondary whitespace-nowrap flex-shrink-0">
              {totalApts}
              <CheckCircle className="w-4 h-4 text-success" /><span className="text-success font-medium">{completedApts}</span>
            </span>
          )}

          <div className="relative hidden xl:block flex-shrink-0">
            <button onClick={() => setShowRevenuePanel(v => !v)}
              className={`${BTN} bg-accent/10 text-accent hover:bg-accent/20`}
              title="Incasso stimato — clicca per scegliere giorno, settimana, mese o intervallo">
              {/* Niente icona dell'euro: il simbolo lo mette già `eur()` e si
                  leggeva "€ € 3.648,40". */}
              <span className="font-semibold">{eur(revenueStats.total)}</span>
              <span className="opacity-70 hidden 2xl:inline">· {periodShortLabel(revenuePeriod)}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRevenuePanel ? 'rotate-180' : ''}`} />
            </button>
            {showRevenuePanel && (
              <RevenuePanel
                appointments={appointments}
                period={revenuePeriod}
                isFollowingAgenda={customRevenuePeriod === null}
                onChange={setCustomRevenuePeriod}
                onFollowAgenda={() => setCustomRevenuePeriod(null)}
                onClose={() => setShowRevenuePanel(false)}
              />
            )}
          </div>
          {/* Da qui in poi le azioni. Il divisorio separa "dove sei" da
              "cosa fai" senza bisogno di una seconda riga. */}
          <span className="w-px h-6 bg-border flex-shrink-0 mx-0.5 hidden lg:block" />

          <CercaCliente
            clients={clientiInAnagrafica}
            appointments={appointments}
            onApriAppuntamento={handleAppointmentClick}
            onVaiAlGiorno={(d) => { setSelectedDate(parseDateStr(d)); setView('day'); }}
          />

          {/* Un colore per ciascuno: senza etichetta è il colore a far
              riconoscere il tasto prima ancora di leggerne il nome. */}
          <button onClick={() => setShowWaitlistPanel(true)} title="Clienti in attesa"
            className={`relative ${ICONA} border ${matchingWaitlists.length > 0
              ? 'bg-warning text-white border-warning shadow-glow animate-pulse'
              : 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20'}`}>
            <ListTodo className="w-4 h-4" />
            {matchingWaitlists.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-white text-warning border border-warning w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                {matchingWaitlists.length}
              </span>
            )}
          </button>

          <button onClick={() => setShowAddClientModal(true)} title="Nuovo cliente in anagrafica"
            className={`${ICONA} border bg-success/10 border-success/30 text-success hover:bg-success/20`}>
            <UserPlus className="w-4 h-4" />
          </button>

          <a href="/agenda-mobile" target="_blank" rel="noopener noreferrer"
            className={`${ICONA} border bg-sky-500/10 border-sky-500/30 text-sky-500 hover:bg-sky-500/20`}
            title="Apri la versione da cellulare">
            <Smartphone className="w-4 h-4" />
          </a>

          {/* Staccato da tutto e ancorato a destra: è il tasto che si cerca
              più spesso, deve stare sempre nello stesso punto — ed è l'unico
              che tiene il nome per esteso. */}
          <button onClick={() => openAppointmentModal()} title="Nuovo appuntamento"
            className={`${BTN} ml-auto flex-shrink-0 gradient-accent text-white shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-105`}>
            <Plus className="w-4 h-4" />
            {/* Su schermi stretti resta il solo più: sparire non può, è il
                comando principale, ma il nome per esteso non ci starebbe. */}
            <span className="hidden xl:inline">Nuovo appuntamento</span>
          </button>
        </div>
      </div>

      {/* Views */}
      {view === 'day' && (
        <DayView appointments={todayAppointments} blocks={todayBlocks} operators={visibleOperators} selectedDate={selectedDate} coccole={coccole} onAppointmentClick={handleAppointmentClick} onWaitlistAdd={handleWaitlistAdd}
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
          // Sul vuoto l'ora è già quella giusta: non va cercato niente.
          onGapClick={(operatorId, time) => openAppointmentModal(null, { operatorId, time })}
          onOffriBuco={(b) => setBucoDaOffrire(b)}
          onDropAppointment={(aptId, opId, newStart, duration, mantieniOperatrice) => {
            const [h, m] = newStart.split(':').map(Number);
            const endTotal = h * 60 + m + duration;
            const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
            // Appuntamento diviso fra due operatrici: si sposta l'orario, ma
            // chi fa cosa resta com'era — si cambia dal dettaglio.
            const attuale = appointments.find(a => a.id === aptId);
            moveAppointment(aptId, mantieniOperatrice && attuale ? attuale.operatorId : opId, newStart, endTime);
          }} />
      )}
      {view === 'week' && (
        <WeekView selectedDate={selectedDate} allAppointments={visibleAppointments} operatorColorById={operatorColorById} onAppointmentClick={handleAppointmentClick} onDayClick={handleDayClick} />
      )}
      {view === 'month' && (
        <MonthView selectedDate={selectedDate} allAppointments={visibleAppointments} operatorColorById={operatorColorById} onAppointmentClick={handleAppointmentClick} onDayClick={handleDayClick} />
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedApt && <DetailPanel appointment={selectedApt} onClose={() => setSelectedApt(null)} onEdit={handleEdit}
          onStatusChange={(id, status, extra) => updateAppointment(id, { status, ...extra })}
          onCancelWithReason={(id, reason) => updateAppointment(id, { status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() })}
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
              addClient(data).catch(avvisaErroreCliente);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWaitlistPanel && <WaitlistPanel onClose={() => setShowWaitlistPanel(false)} onOpenNew={() => { setShowWaitlistPanel(false); handleOpenWaitlistModal(); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {bucoDaOffrire && (
          <OffriBucoModal buco={bucoDaOffrire} onClose={() => setBucoDaOffrire(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {blockModal && (
          <BlockModal
            operatorName={blockModal.operatorName}
            dateLabel={formatDateLong(dateStr)}
            defaultStart={blockModal.start}
            defaultEnd={blockModal.end}
            onClose={() => setBlockModal(null)}
            onSave={(start, end, reason) => {
              addBlock({ operatorId: blockModal.operatorId, date: dateStr, startTime: start, endTime: end, reason });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
