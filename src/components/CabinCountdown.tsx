'use client';

import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { formatCountdown, countdownTone, activeTimer, type TimedAppointment } from '@/lib/cabinTimer';

const TONE_CLASS = {
  ok: 'bg-success/15 text-success',
  soon: 'bg-warning/20 text-warning',
  over: 'bg-error/20 text-error',
} as const;

/**
 * Badge con il tempo che manca alla fine del trattamento in corso.
 * Si aggiorna ogni secondo da solo, così non fa ridisegnare tutta l'agenda.
 */
export default function CabinCountdown({ appointment, size = 'sm' }: { appointment: TimedAppointment; size?: 'sm' | 'lg' }) {
  const timer = activeTimer(appointment);
  const endAt = timer?.endAt ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [endAt]);

  if (endAt === null) return null;

  const left = endAt - now;
  const tone = countdownTone(left);

  if (size === 'lg') {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-bold tabular-nums ${TONE_CLASS[tone]}`}>
        <Timer className="w-4 h-4" />
        <span className="text-lg">{formatCountdown(left)}</span>
        <span className="text-[11px] font-semibold opacity-80">
          {tone === 'over' ? 'tempo finito' : 'alla fine'}
        </span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold tabular-nums text-[10px] ${TONE_CLASS[tone]}`}>
      <Timer className="w-2.5 h-2.5" /> {formatCountdown(left)}
    </span>
  );
}
