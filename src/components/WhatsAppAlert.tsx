'use client';

/**
 * Avviso messaggi WhatsApp, sempre attivo in tutto il gestionale.
 *
 * Un cliente che scrive e non riceve risposta se ne va: appena arriva un
 * messaggio il menu WhatsApp lampeggia (pallino rosso, vedi Sidebar) e parte un
 * bip. Se dopo 10 minuti quel messaggio è ancora da leggere si apre l'avviso al
 * centro dello schermo, perché il pallino da solo passa inosservato.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Clock, X } from 'lucide-react';
import { useWaInboxStore } from '@/stores/useWaInboxStore';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/** Dopo quanto un messaggio non letto diventa un avviso a schermo. */
const ALERT_AFTER_MS = 10 * 60_000;
/** Quanto dura il "ricordamelo dopo" prima che l'avviso torni. */
const SNOOZE_MS = 5 * 60_000;
/**
 * La pausa va tenuta fuori dal componente: il guscio della dashboard si
 * rimonta (ricarica ruoli, cambio pagina) e con lo stato in memoria l'avviso
 * tornava a schermo un istante dopo averlo rimandato.
 */
const SNOOZE_KEY = 'revo_wa_snooze_fino';

function leggiSnooze(): number {
  try { return Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; }
}
function salvaSnooze(fino: number) {
  try { localStorage.setItem(SNOOZE_KEY, String(fino)); } catch { /* no-op */ }
}
const POLL_MS = 20_000;

/** Due bip con la Web Audio API (nessun file audio da caricare). */
function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.3].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.25);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.27);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* audio non disponibile */ }
}

function waitLabel(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}min`;
}

export default function WhatsAppAlert() {
  const router = useRouter();
  const chats = useWaInboxStore(s => s.chats);
  const total = useWaInboxStore(s => s.total);
  const fetchUnread = useWaInboxStore(s => s.fetchUnread);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [snoozeUntil, setSnoozeUntil] = useState(() => 0);
  const prevTotal = useRef<number | null>(null);

  useEffect(() => { setMounted(true); setSnoozeUntil(leggiSnooze()); }, []);

  /** Rimanda l'avviso e ricordalo, così non torna al primo rerender. */
  const rimanda = useCallback(() => {
    const fino = Date.now() + SNOOZE_MS;
    salvaSnooze(fino);
    setSnoozeUntil(fino);
  }, []);

  useEffect(() => { void fetchUnread(); }, [fetchUnread]);
  useAutoRefresh(useCallback(() => { void fetchUnread(); }, [fetchUnread]), POLL_MS);

  // Basta il minuto: l'attesa si misura in minuti, non in secondi.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(i);
  }, []);

  // Bip + notifica del browser quando arriva qualcosa di nuovo (non al primo giro,
  // altrimenti suonerebbe a ogni apertura del gestionale per messaggi vecchi).
  useEffect(() => {
    const before = prevTotal.current;
    prevTotal.current = total;
    if (before === null || total <= before) return;

    playPing();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('💬 Nuovo messaggio WhatsApp', {
          body: chats[0] ? `${chats[0].name || `+${chats[0].phone}`}: ${chats[0].lastText}`.slice(0, 140) : 'Un cliente ha scritto al centro.',
          tag: 'revo-wa-nuovo',
        });
      } catch { /* no-op */ }
    }
  }, [total, chats]);

  // Chat in attesa da più di 10 minuti: sono quelle che fanno scattare l'avviso.
  const overdue = useMemo(
    () => chats.filter(c => now - new Date(c.oldestUnreadAt).getTime() >= ALERT_AFTER_MS),
    [chats, now]
  );

  const show = overdue.length > 0 && now >= snoozeUntil;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-error/40 bg-bg-secondary shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-error/10">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-11 h-11 rounded-full bg-error/20 flex items-center justify-center text-error flex-shrink-0">
                <MessageSquare className="w-6 h-6" />
              </motion.div>
              <div>
                <h3 className="text-lg font-display font-bold text-text-primary">
                  {overdue.length === 1 ? 'Messaggio senza risposta' : `${overdue.length} messaggi senza risposta`}
                </h3>
                <p className="text-xs text-text-secondary">Rispondi subito su WhatsApp</p>
              </div>
            </div>

            <div className="p-4 space-y-2 max-h-[45vh] overflow-y-auto">
              {overdue.map(c => (
                <div key={c.phone} className="rounded-xl border border-border bg-bg-tertiary/40 p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-text-primary truncate flex-1">{c.name || `+${c.phone}`}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error text-white flex-shrink-0">{c.unread}</span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{c.lastText}</p>
                  <p className="text-[11px] text-error font-semibold mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> in attesa da {waitLabel(now - new Date(c.oldestUnreadAt).getTime())}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-4 pt-0 flex gap-2">
              <button onClick={rimanda}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors flex items-center justify-center gap-1.5">
                <X className="w-4 h-4" /> Tra 5 min
              </button>
              <button onClick={() => { rimanda(); router.push('/dashboard/whatsapp'); }}
                className="flex-1 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold hover:opacity-90 transition-opacity">
                Apri WhatsApp
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
