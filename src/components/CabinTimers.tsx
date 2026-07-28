'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, BellRing, BellOff, ChevronDown, ChevronUp, AlarmClockCheck, X } from 'lucide-react';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatCountdown, countdownTone, runningTreatments } from '@/lib/cabinTimer';
import type { Appointment } from '@/types';

const ALERTED_KEY = 'revo_cabin_alerted';
// Non avvisare per trattamenti finiti da molto (es. gestionale riaperto il giorno dopo)
const MAX_LATE_ALERT_MS = 30 * 60_000;

function loadAlerted(): string[] {
  try { return JSON.parse(localStorage.getItem(ALERTED_KEY) || '[]'); } catch { return []; }
}
function saveAlerted(ids: string[]) {
  try { localStorage.setItem(ALERTED_KEY, JSON.stringify(ids.slice(-50))); } catch { /* no-op */ }
}

/** Tre bip con la Web Audio API (nessun file audio da caricare). */
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.45, 0.9].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch { /* audio non disponibile */ }
}

/**
 * Cronometro dei trattamenti in cabina, sempre attivo in tutto il gestionale.
 * Dal check-in parte il conto alla rovescia; a tempo scaduto suona, manda la
 * notifica del browser e apre l'avviso per andare a fermare il macchinario.
 */
export default function CabinTimers() {
  const router = useRouter();
  const appointments = useAgendaStore(s => s.appointments);
  const fetchAppointments = useAgendaStore(s => s.fetchAppointments);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [finished, setFinished] = useState<Appointment[]>([]);
  const alertedRef = useRef<string[]>([]);

  useEffect(() => {
    setMounted(true);
    alertedRef.current = loadAlerted();
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // I dati arrivano anche dagli altri dispositivi: check-in fatto dal tablet in cabina
  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useAutoRefresh(useCallback(() => { fetchAppointments(); }, [fetchAppointments]), 30000);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const running = useMemo(() => runningTreatments(appointments), [appointments]);

  // Scatta l'avviso quando il tempo finisce (una sola volta per appuntamento)
  useEffect(() => {
    const scaduti = running.filter(({ appt, endAt }) =>
      endAt <= now &&
      now - endAt < MAX_LATE_ALERT_MS &&
      !alertedRef.current.includes(appt.id)
    );
    if (scaduti.length === 0) return;

    alertedRef.current = [...alertedRef.current, ...scaduti.map(s => s.appt.id)];
    saveAlerted(alertedRef.current);
    setFinished(prev => [...prev, ...scaduti.map(s => s.appt)]);
    playBeep();

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scaduti.forEach(({ appt }) => {
        try {
          new Notification('⏰ Trattamento finito', {
            body: `${appt.clientName} — ${appt.treatmentName}\n${appt.operatorName}: vai a fermare il macchinario`,
            tag: `revo-cabina-${appt.id}`,
          });
        } catch { /* no-op */ }
      });
    }
  }, [running, now]);

  const askPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const res = await Notification.requestPermission();
    setPermission(res);
  };

  if (!mounted || (running.length === 0 && finished.length === 0)) return null;

  return createPortal(
    <>
      {/* Pannello con i trattamenti in corso */}
      {running.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[80] w-[280px] rounded-2xl border border-border bg-bg-secondary/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <button onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-accent/10 hover:bg-accent/15 transition-colors">
            <Timer className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-text-primary flex-1 text-left">
              In cabina ({running.length})
            </span>
            {collapsed ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>

          {!collapsed && (
            <div className="p-2 space-y-1.5 max-h-[45vh] overflow-y-auto">
              {running.map(({ appt, endAt }) => {
                const left = endAt - now;
                const tone = countdownTone(left);
                const toneCls = tone === 'over' ? 'bg-error/15 text-error' : tone === 'soon' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
                return (
                  <div key={appt.id} className="rounded-xl border border-border/60 bg-bg-tertiary/40 p-2.5">
                    <p className="text-xs font-semibold text-text-primary truncate">{appt.clientName}</p>
                    <p className="text-[11px] text-text-secondary truncate">{appt.treatmentName}</p>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <span className="text-[10px] text-text-muted truncate">{appt.operatorName}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${toneCls}`}>
                        {formatCountdown(left)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {permission === 'default' && (
                <button onClick={askPermission}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-accent/10 text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors">
                  <BellRing className="w-3.5 h-3.5" /> Attiva le notifiche
                </button>
              )}
              {permission === 'denied' && (
                <p className="flex items-center gap-1.5 px-1 text-[10px] text-text-muted">
                  <BellOff className="w-3 h-3" /> Notifiche bloccate dal browser: resta l&apos;avviso a schermo
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Avviso a tempo scaduto */}
      <AnimatePresence>
        {finished.length > 0 && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-error/40 bg-bg-secondary shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-error/10">
                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  className="w-11 h-11 rounded-full bg-error/20 flex items-center justify-center text-error flex-shrink-0">
                  <AlarmClockCheck className="w-6 h-6" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-display font-bold text-text-primary">Trattamento finito</h3>
                  <p className="text-xs text-text-secondary">Vai in cabina a fermare il macchinario</p>
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[45vh] overflow-y-auto">
                {finished.map(a => (
                  <div key={a.id} className="rounded-xl border border-border bg-bg-tertiary/40 p-3">
                    <p className="text-sm font-bold text-text-primary">{a.clientName}</p>
                    <p className="text-xs text-text-secondary">{a.treatmentName}</p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {a.operatorName ? `${a.operatorName} · ` : ''}
                      iniziato alle {a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }) : '—'} · {a.duration} min
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-4 pt-0 flex gap-2">
                <button onClick={() => setFinished([])}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors flex items-center justify-center gap-1.5">
                  <X className="w-4 h-4" /> Ho fermato tutto
                </button>
                <button onClick={() => { setFinished([]); router.push('/dashboard/agenda'); }}
                  className="flex-1 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 transition-opacity">
                  Vai all&apos;agenda
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
