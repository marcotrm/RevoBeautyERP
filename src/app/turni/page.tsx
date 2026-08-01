'use client';

import React, { useEffect, useMemo, useState } from 'react';

type DaySchedule = { isWorking?: boolean; startTime?: string; endTime?: string };
type Operator = { id: string; firstName: string; lastName: string; color: string; schedule: Record<string, DaySchedule> | null };

const DAYS = [
  { key: 1, short: 'Lun', long: 'Lunedì' },
  { key: 2, short: 'Mar', long: 'Martedì' },
  { key: 3, short: 'Mer', long: 'Mercoledì' },
  { key: 4, short: 'Gio', long: 'Giovedì' },
  { key: 5, short: 'Ven', long: 'Venerdì' },
  { key: 6, short: 'Sab', long: 'Sabato' },
];

function initials(f: string, l: string) {
  return ((f?.[0] || '') + (l?.[0] || '')).toUpperCase();
}

/** Il lunedì (YYYY-MM-DD) della settimana corrente più un certo numero di settimane. */
function mondayISO(settimaneAvanti: number): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + settimaneAvanti * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TurniPage() {
  // Giorno di default: oggi (1-6 = Lun-Sab; domenica → mostra Lunedì)
  const todayKey = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d;
  }, []);
  const [day, setDay] = useState<number>(todayKey);
  // Questa settimana o la prossima: cambia i turni (contano le settimane
  // personalizzate in Staff → Turni) e le date sotto i giorni.
  const [settimana, setSettimana] = useState<0 | 1>(0);
  const weekStart = mondayISO(settimana);

  // I dati ricordano di che settimana sono: cambiando settimana si vede il
  // caricamento finché non arrivano quelli giusti (mai i turni sbagliati).
  const [dati, setDati] = useState<{ week: string; operators: Operator[] } | null>(null);
  useEffect(() => {
    const mia = weekStart;
    fetch(`/api/turni?week=${mia}`)
      .then((r) => r.json())
      .then((d) => setDati({ week: mia, operators: d.operators || [] }))
      .catch(() => setDati({ week: mia, operators: [] }));
  }, [weekStart]);
  const operators = dati?.week === weekStart ? dati.operators : null;
  const loading = operators === null;

  /** La data (es. "3") che cade in un certo giorno della settimana mostrata. */
  const dataDel = (dayKey: number): Date => {
    const [y, m, d] = weekStart.split('-').map(Number);
    const data = new Date(y, m - 1, d);
    data.setDate(data.getDate() + (dayKey - 1));
    return data;
  };

  const shiftFor = (op: Operator): { working: boolean; label: string } => {
    const s = op.schedule?.[String(day)];
    if (!s || s.isWorking === false) return { working: false, label: 'Riposo' };
    if (s.startTime && s.endTime) return { working: true, label: `${s.startTime} – ${s.endTime}` };
    return { working: true, label: 'In servizio' };
  };

  const working = (operators || []).filter((o) => shiftFor(o).working);
  const off = (operators || []).filter((o) => !shiftFor(o).working);

  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>Revobeauty</div>
        <h1 style={s.title}>Turni della settimana</h1>
        <p style={s.sub}>Seleziona il giorno per vedere chi è in servizio.</p>

        <div style={s.weekRow}>
          <button style={{ ...s.weekBtn, ...(settimana === 0 ? s.weekActive : {}) }}
            onClick={() => { setSettimana(0); setDay(todayKey); }}>
            Questa settimana
          </button>
          <button style={{ ...s.weekBtn, ...(settimana === 1 ? s.weekActive : {}) }}
            onClick={() => { setSettimana(1); setDay(1); }}>
            Prossima settimana
          </button>
        </div>

        <div style={s.daysRow}>
          {DAYS.map((d) => (
            <button key={d.key} style={{ ...s.dayBtn, ...(day === d.key ? s.dayActive : {}) }} onClick={() => setDay(d.key)}>
              <span style={{ display: 'block' }}>{d.short}</span>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{dataDel(d.key).getDate()}</span>
            </button>
          ))}
        </div>

        <h2 style={s.dayTitle}>
          {dataDel(day).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>

        {loading ? (
          <p style={s.muted}>Carico i turni…</p>
        ) : (operators || []).length === 0 ? (
          <p style={s.muted}>Nessuna operatrice registrata.</p>
        ) : (
          <>
            {working.map((op) => {
              const sh = shiftFor(op);
              return (
                <div key={op.id} style={s.row}>
                  <div style={{ ...s.avatar, background: op.color || '#A855F7' }}>{initials(op.firstName, op.lastName)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.name}>{op.firstName} {op.lastName}</div>
                    <div style={s.workLabel}>{sh.label}</div>
                  </div>
                  <span style={s.badgeOn}>In servizio</span>
                </div>
              );
            })}
            {off.length > 0 && <div style={s.divider}>A riposo</div>}
            {off.map((op) => (
              <div key={op.id} style={{ ...s.row, opacity: 0.6 }}>
                <div style={{ ...s.avatar, background: '#c9c1d6' }}>{initials(op.firstName, op.lastName)}</div>
                <div style={{ flex: 1 }}>
                  <div style={s.name}>{op.firstName} {op.lastName}</div>
                  <div style={s.muted}>Riposo</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

const P = '#A855F7';
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg,#faf5ff 0%,#fdf2f8 100%)', padding: '20px 14px', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif', color: '#1f1230' },
  card: { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 22, boxShadow: '0 10px 40px -12px rgba(168,85,247,.25)', padding: 20 },
  brand: { fontWeight: 800, fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  title: { fontSize: 24, fontWeight: 800, margin: '6px 0 4px', lineHeight: 1.15 },
  sub: { color: '#6b6577', fontSize: 14, margin: 0 },
  weekRow: { display: 'flex', gap: 8, marginTop: 16 },
  weekBtn: { flex: 1, padding: '10px 8px', borderRadius: 12, border: '1px solid #ece6f4', background: '#faf8fd', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', color: '#6b6577' },
  weekActive: { background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', borderColor: 'transparent' },
  daysRow: { display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4 },
  dayBtn: { flex: 1, minWidth: 46, padding: '10px 0', borderRadius: 12, border: '1px solid #ece6f4', background: '#faf8fd', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#6b6577' },
  dayActive: { background: P, color: '#fff', borderColor: P },
  dayTitle: { fontSize: 17, fontWeight: 700, margin: '18px 0 12px', textTransform: 'capitalize' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1ecf7' },
  avatar: { width: 40, height: 40, borderRadius: '50%', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontWeight: 600, fontSize: 15 },
  workLabel: { color: P, fontWeight: 600, fontSize: 14 },
  muted: { color: '#94809f', fontSize: 13 },
  badgeOn: { fontSize: 11, fontWeight: 700, color: '#15803d', background: '#e7f5ec', padding: '4px 9px', borderRadius: 999 },
  divider: { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94809f', marginTop: 16, marginBottom: 4 },
};
