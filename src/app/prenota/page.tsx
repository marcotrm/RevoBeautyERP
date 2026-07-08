'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Treatment = {
  id: string; name: string; category: string;
  price: number; duration: number;
  priceMale: number | null; priceFemale: number | null;
  durationMale: number | null; durationFemale: number | null;
};
type Slot = { time: string; operatorId: string; operatorName: string };

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function nextDays(count: number): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
    days.push({ value, label: i === 0 ? 'Oggi' : i === 1 ? 'Domani' : fmt.format(d) });
  }
  return days;
}

export default function PrenotaPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [query, setQuery] = useState('');
  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { date: string; startTime: string; treatmentName: string; operatorName: string; price: number }>(null);

  const days = useMemo(() => nextDays(21), []);

  useEffect(() => {
    fetch('/api/booking/treatments')
      .then((r) => r.json())
      .then((d) => setTreatments(d.treatments || []))
      .catch(() => {});
  }, []);

  // Carica gli orari quando trattamento, data o sesso cambiano
  useEffect(() => {
    if (!treatment || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    setSlot(null);
    fetch(`/api/booking/availability?date=${date}&treatmentId=${treatment.id}&gender=${gender}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [treatment, date, gender]);

  const priceOf = (t: Treatment) =>
    gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price);
  const durOf = (t: Treatment) =>
    gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration);

  const filtered = query.trim()
    ? treatments.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : treatments;

  const canSubmit = treatment && date && slot && name.trim() && phone.replace(/\D/g, '').length >= 6;

  const submit = async () => {
    if (!canSubmit || !treatment || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentId: treatment.id, date, startTime: slot.time, operatorId: slot.operatorId,
          name: name.trim(), phone: phone.trim(), email: email.trim() || null, gender,
          marketingConsent: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prenotazione non riuscita');
      setDone(data.appointment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const d = new Date(done.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.checkCircle}>✓</div>
          <h1 style={styles.doneTitle}>Prenotazione confermata!</h1>
          <p style={styles.doneSub}>Ti aspettiamo da Revobeauty.</p>
          <div style={styles.summary}>
            <div style={styles.summaryRow}><span>Trattamento</span><b>{done.treatmentName}</b></div>
            <div style={styles.summaryRow}><span>Quando</span><b style={{ textTransform: 'capitalize' }}>{d} · {done.startTime}</b></div>
            <div style={styles.summaryRow}><span>Con</span><b>{done.operatorName}</b></div>
            <div style={styles.summaryRow}><span>Prezzo</span><b>{eur(done.price)}</b></div>
          </div>
          <button style={styles.secondaryBtn} onClick={() => { setDone(null); setTreatment(null); setDate(''); setSlot(null); setName(''); setPhone(''); setEmail(''); }}>
            Prenota un altro appuntamento
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>Revobeauty</div>
        <h1 style={styles.title}>Prenota il tuo appuntamento</h1>
        <p style={styles.sub}>Scegli trattamento, giorno e orario. Ci vediamo in centro!</p>

        {/* Sesso */}
        <div style={styles.genderRow}>
          <button style={{ ...styles.genderBtn, ...(gender === 'female' ? styles.genderActive : {}) }} onClick={() => setGender('female')}>♀ Donna</button>
          <button style={{ ...styles.genderBtn, ...(gender === 'male' ? styles.genderActive : {}) }} onClick={() => setGender('male')}>♂ Uomo</button>
        </div>

        {/* Trattamento */}
        <label style={styles.label}>1 · Trattamento</label>
        {treatment ? (
          <div style={styles.selectedTreat}>
            <div>
              <div style={{ fontWeight: 600 }}>{treatment.name}</div>
              <div style={styles.muted}>{durOf(treatment)} min · {eur(priceOf(treatment))}</div>
            </div>
            <button style={styles.changeBtn} onClick={() => { setTreatment(null); setSlot(null); }}>Cambia</button>
          </div>
        ) : (
          <>
            <input style={styles.input} placeholder="Cerca un trattamento…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div style={styles.treatList}>
              {filtered.slice(0, 40).map((t) => (
                <button key={t.id} style={styles.treatItem} onClick={() => { setTreatment(t); setQuery(''); }}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{t.name}</span>
                  <span style={styles.muted}>{durOf(t)}min · {eur(priceOf(t))}</span>
                </button>
              ))}
              {filtered.length === 0 && <div style={styles.muted}>Nessun trattamento trovato</div>}
            </div>
          </>
        )}

        {/* Data */}
        {treatment && (
          <>
            <label style={styles.label}>2 · Giorno</label>
            <div style={styles.daysRow}>
              {days.map((d) => (
                <button key={d.value} style={{ ...styles.dayBtn, ...(date === d.value ? styles.dayActive : {}) }} onClick={() => setDate(d.value)}>
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Orario */}
        {treatment && date && (
          <>
            <label style={styles.label}>3 · Orario</label>
            {loadingSlots ? (
              <div style={styles.muted}>Cerco gli orari liberi…</div>
            ) : slots.length === 0 ? (
              <div style={styles.muted}>Nessun orario disponibile in questa giornata. Prova un altro giorno.</div>
            ) : (
              <div style={styles.slotsGrid}>
                {slots.map((s) => (
                  <button key={s.time} style={{ ...styles.slotBtn, ...(slot?.time === s.time ? styles.slotActive : {}) }} onClick={() => setSlot(s)}>
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Dati */}
        {treatment && date && slot && (
          <>
            <label style={styles.label}>4 · I tuoi dati</label>
            <input style={styles.input} placeholder="Nome e cognome" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={styles.input} placeholder="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <input style={styles.input} placeholder="Email (facoltativa)" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
            <label style={styles.consent}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Accetto di ricevere comunicazioni e promemoria dal centro</span>
            </label>

            {error && <div style={styles.error}>{error}</div>}

            <button style={{ ...styles.cta, ...(canSubmit && !submitting ? {} : styles.ctaDisabled) }} disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? 'Prenotazione in corso…' : `Conferma · ${eur(priceOf(treatment))}`}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const P = '#A855F7';
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg,#faf5ff 0%,#fdf2f8 100%)', padding: '24px 16px', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif', color: '#1f1230' },
  card: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px -12px rgba(168,85,247,.25)', padding: 24 },
  brand: { fontWeight: 800, fontSize: 14, letterSpacing: '.16em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  title: { fontSize: 26, fontWeight: 800, margin: '8px 0 4px', lineHeight: 1.15 },
  sub: { color: '#6b6577', fontSize: 15, margin: 0 },
  genderRow: { display: 'flex', gap: 8, margin: '20px 0 4px' },
  genderBtn: { flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #ece6f4', background: '#faf8fd', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#6b6577' },
  genderActive: { background: P, color: '#fff', borderColor: P },
  label: { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P, marginTop: 22, marginBottom: 8 },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5dff0', fontSize: 15, marginBottom: 10, outlineColor: P },
  treatList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' },
  treatItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 12, border: '1px solid #f0ebf7', background: '#fff', cursor: 'pointer', fontSize: 14 },
  selectedTreat: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${P}`, background: '#faf5ff' },
  changeBtn: { border: 'none', background: 'transparent', color: P, fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  muted: { color: '#94809f', fontSize: 13 },
  daysRow: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
  dayBtn: { flex: '0 0 auto', padding: '10px 14px', borderRadius: 12, border: '1px solid #ece6f4', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4b4459', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  dayActive: { background: P, color: '#fff', borderColor: P },
  slotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 8 },
  slotBtn: { padding: '10px', borderRadius: 12, border: '1px solid #ece6f4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#4b4459' },
  slotActive: { background: P, color: '#fff', borderColor: P },
  consent: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#6b6577', margin: '4px 0 14px' },
  cta: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  ctaDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  error: { background: '#fdeaee', color: '#be123c', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 10 },
  checkCircle: { width: 56, height: 56, borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  doneTitle: { textAlign: 'center', fontSize: 24, fontWeight: 800, margin: '0 0 4px' },
  doneSub: { textAlign: 'center', color: '#6b6577', margin: '0 0 20px' },
  summary: { background: '#faf8fd', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#6b6577' },
  secondaryBtn: { width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${P}`, background: '#fff', color: P, fontWeight: 600, cursor: 'pointer' },
};
