'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, BellRing, BellOff, ChevronDown, ChevronUp, AlarmClockCheck, X, Volume2, VolumeX } from 'lucide-react';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { useCabinStore } from '@/stores/useCabinStore';
import { cabinName, type Cabin } from '@/lib/cabins';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatCountdown, countdownTone, runningTreatments } from '@/lib/cabinTimer';
import type { Appointment, Operator } from '@/types';

const ALERTED_KEY = 'revo_cabin_alerted';
const VOICE_KEY = 'revo_cabin_voce';
// Non avvisare per trattamenti finiti da molto (es. gestionale riaperto il giorno dopo)
const MAX_LATE_ALERT_MS = 30 * 60_000;
// Il bip dura poco più di un secondo: la voce parte dopo, altrimenti si accavallano.
const VOICE_DELAY_MS = 1400;

function loadAlerted(): string[] {
  try { return JSON.parse(localStorage.getItem(ALERTED_KEY) || '[]'); } catch { return []; }
}
function loadVoiceOn(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; }
}
function saveVoiceOn(on: boolean) {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* no-op */ }
}

/**
 * Annuncio a voce con la sintesi vocale del browser (nessun file audio, nessun
 * servizio esterno). Da dietro il bancone il bip da solo non dice chi ha finito:
 * il nome pronunciato evita di dover guardare lo schermo.
 */
function speak(text: string, esito?: { ok: () => void; ko: () => void }) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return esito?.ko();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.95;
    // Se l'elenco voci è già pronto scegliamo quella italiana; se è ancora vuoto
    // (succede al primo annuncio su Chrome) ci pensa `lang` a farne scegliere una.
    const italiana = synth.getVoices().find(v => v.lang?.toLowerCase().startsWith('it'));
    if (italiana) u.voice = italiana;
    if (esito) {
      let risposto = false;
      u.onstart = () => { risposto = true; esito.ok(); };
      u.onerror = () => { risposto = true; esito.ko(); };
      // Se il browser blocca l'audio non arriva né onstart né onerror: dopo
      // qualche secondo di silenzio lo diamo per non funzionante.
      setTimeout(() => { if (!risposto) esito.ko(); }, 3000);
    }
    synth.speak(u);
  } catch { esito?.ko(); }
}

/**
 * Come chiamare il posto dove è finito il trattamento — a voce e a schermo.
 *
 * Prima di tutto la cabina scelta al check-in ("Cabina 4"): è quella che serve
 * davvero per sapere dove andare. Se non è stata indicata si ripiega sulla
 * cabina/risorsa dell'appuntamento, e in ultimo sul nome dell'operatrice.
 * Mai il nome della cliente: non deve girare a voce per il salone.
 */
function cabinLabel(
  appt: { cabinNumber?: string; operatorId?: string; operatorName?: string },
  operators: Operator[],
  cabins: Cabin[] = [],
): string {
  const n = (appt.cabinNumber || '').trim();
  // Il nome dato in Impostazioni → Cabine vince ("Sala Laser"); altrimenti "Cabina 4"
  if (n) return cabinName(n, cabins);
  const op = operators.find(o => o.id === appt.operatorId);
  if (op?.isResource) return `${op.firstName} ${op.lastName}`.trim();
  return op?.firstName || appt.operatorName || 'La cabina';
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
  const operators = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);
  const cabins = useCabinStore(s => s.cabins);
  const fetchCabins = useCabinStore(s => s.fetchCabins);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [finished, setFinished] = useState<Appointment[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);
  // Esito della prova voce: serve a capire su quale computer l'audio è muto
  const [voiceTest, setVoiceTest] = useState<'idle' | 'provo' | 'ok' | 'muta'>('idle');
  const alertedRef = useRef<string[]>([]);
  // L'effect dell'avviso legge preferenza e operatrici senza doverle avere fra
  // le dipendenze: si rilancerebbe a ogni ricarica dati senza motivo.
  const voiceOnRef = useRef(true);
  voiceOnRef.current = voiceOn;
  const operatorsRef = useRef(operators);
  operatorsRef.current = operators;
  const cabinsRef = useRef(cabins);
  cabinsRef.current = cabins;

  useEffect(() => {
    setMounted(true);
    alertedRef.current = loadAlerted();
    setVoiceOn(loadVoiceOn());
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // I dati arrivano anche dagli altri dispositivi: check-in fatto dal tablet in cabina
  useEffect(() => { fetchAppointments(); fetchOperators(); fetchCabins(); }, [fetchAppointments, fetchOperators, fetchCabins]);
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
      !alertedRef.current.includes(`${appt.id}|${endAt}`)
    );
    if (scaduti.length === 0) return;

    alertedRef.current = [...alertedRef.current, ...scaduti.map(s => `${s.appt.id}|${s.endAt}`)];
    saveAlerted(alertedRef.current);
    setFinished(prev => [...prev, ...scaduti.map(s => ({ ...s.appt, treatmentName: s.label }))]);
    playBeep();

    // Dopo il bip, la voce dice DOVE è finito il trattamento, non chi c'è dentro:
    // il nome della cliente detto ad alta voce in mezzo al salone non va bene.
    // Più trattamenti insieme: la sintesi vocale li mette in coda da sola.
    if (voiceOnRef.current) {
      const luoghi = scaduti.map(s => cabinLabel(s.appt, operatorsRef.current, cabinsRef.current));
      setTimeout(() => luoghi.forEach(l => speak(`${l} ha finito il trattamento`)), VOICE_DELAY_MS);
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scaduti.forEach(({ appt, label }) => {
        try {
          new Notification('⏰ Trattamento finito', {
            body: `${appt.clientName} — ${label}\n${appt.operatorName}: vai a fermare il macchinario`,
            tag: `revo-cabina-${appt.id}-${label}`,
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
      {/*
        Pannello con i trattamenti in corso.

        Sta a z-45: sotto ai pannelli e ai modali (che partono da z-50), sopra
        al resto della pagina. Con z-80 finiva DAVANTI al pannello
        dell'appuntamento e si mangiava i pulsanti in basso a destra: su uno
        schermo da portatile il Check-in cascava proprio lì sotto e al clic non
        succedeva niente. Il conto alla rovescia è un'informazione, non deve
        mai coprire un comando; l'avviso di fine trattamento, che invece va
        visto subito, resta a z-95.
      */}
      {running.length > 0 && (
        // Da telefono è ancorato a ENTRAMBI i lati: un elemento fisso agganciato
        // solo a destra, se la finestra di impaginazione è più larga dello
        // schermo, finisce fuori e per vederlo tocca scorrere di lato. Legato
        // anche a sinistra non può andare da nessuna parte. Da tablet in su
        // torna il riquadro da 280px in basso a destra.
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[45] sm:w-[280px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-bg-secondary/95 backdrop-blur-xl shadow-2xl overflow-hidden">
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
              {running.map(({ appt, endAt, label }) => {
                const left = endAt - now;
                const tone = countdownTone(left);
                const toneCls = tone === 'over' ? 'bg-error/15 text-error' : tone === 'soon' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
                return (
                  <div key={`${appt.id}-${endAt}`} className="rounded-xl border border-border/60 bg-bg-tertiary/40 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-text-primary truncate flex-1">{appt.clientName}</p>
                      {appt.cabinNumber && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent/15 text-accent flex-shrink-0">
                          {cabinLabel(appt, operators, cabins)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary truncate">{label}</p>
                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      <span className="text-[10px] text-text-muted truncate">{appt.operatorName}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${toneCls}`}>
                        {formatCountdown(left)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Annuncio vocale: si può spegnere, la preferenza resta su questo dispositivo.
                  Accanto la prova, per sapere subito se su QUESTO computer si sente. */}
              <div className="flex gap-1.5">
                <button onClick={() => { const on = !voiceOn; setVoiceOn(on); saveVoiceOn(on); setVoiceTest('idle'); }}
                  title={voiceOn ? 'A fine trattamento la voce annuncia la cabina' : 'Solo bip, senza voce'}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                    voiceOn ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'bg-bg-tertiary text-text-muted hover:bg-bg-hover'
                  }`}>
                  {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {voiceOn ? 'Voce attiva' : 'Voce spenta'}
                </button>
                <button onClick={() => { setVoiceTest('provo'); speak('Cabina 4 ha finito il trattamento', { ok: () => setVoiceTest('ok'), ko: () => setVoiceTest('muta') }); }}
                  title="Fa dire una frase di prova: serve a controllare che su questo computer si senta"
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold bg-bg-tertiary text-text-secondary hover:bg-bg-hover transition-colors">
                  <Volume2 className="w-3.5 h-3.5" /> Prova
                </button>
              </div>
              {voiceTest !== 'idle' && (
                <p className={`text-[10px] leading-relaxed px-1 ${voiceTest === 'muta' ? 'text-error' : 'text-text-muted'}`}>
                  {voiceTest === 'provo' && 'Sto provando…'}
                  {voiceTest === 'ok' && '✓ La voce funziona su questo computer. Se non l\'hai sentita, controlla il volume.'}
                  {voiceTest === 'muta' && '✗ Nessuna voce su questo computer: manca la voce italiana nel sistema oppure il browser sta bloccando l\'audio. Clicca una volta nella pagina e riprova.'}
                </p>
              )}

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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text-primary flex-1">{a.clientName}</p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-error/15 text-error flex-shrink-0">
                        {cabinLabel(a, operators, cabins)}
                      </span>
                    </div>
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
