'use client';

/**
 * Prenotazione online pubblica — è la pagina che le clienti aprono dal QR,
 * da WhatsApp e dal sito.
 *
 * Tre passi con barra di avanzamento: Servizio → Orario → Dati.
 *  - più trattamenti nella stessa seduta ("Aggiungi un altro trattamento"),
 *    ognuno con l'operatrice voluta o "la prima disponibile";
 *  - la ricerca degli orari parte dai filtri (quali giorni vanno bene, da che
 *    ora): invece di sfogliare i giorni a uno a uno, il sistema propone i
 *    primi buoni. Gli orari arrivano dal motore condiviso con la app clienti,
 *    che rispetta turni, pause e appuntamenti già presi.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NO_AUTOFILL } from '@/lib/noAutofill';

type Treatment = {
  id: string; name: string; category: string;
  price: number; duration: number;
  priceMale: number | null; priceFemale: number | null;
  durationMale: number | null; durationFemale: number | null;
};
type Operatrice = { id: string; nome: string };
type Assegnazione = { treatmentId: string; treatmentName: string; operatorId: string; operatorName: string; startTime: string; endTime: string; duration: number; price: number };
type Slot = { time: string; endTime: string; durataTotale: number; prezzoTotale: number; assegnazioni: Assegnazione[] };
type GiornoDisponibile = { date: string; slots: Slot[] };

/** Una riga del carrello: trattamento scelto + operatrice voluta. */
type Scelta = { treatmentId: string; operatorId: string };

const CATEGORIE: Record<string, string> = {
  facial: 'Viso', body: 'Corpo', laser: 'Laser / Epilazione', massage: 'Massaggi',
  nails: 'Unghie', waxing: 'Ceretta', consultation: 'Consulenza', hair: 'Capelli', makeup: 'Trucco',
};
const GIORNI = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mer' },
  { n: 4, label: 'Gio' }, { n: 5, label: 'Ven' }, { n: 6, label: 'Sab' },
];
const ORE = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const dataLunga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

export default function PrenotaPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [operatrici, setOperatrici] = useState<Operatrice[]>([]);
  const [gender, setGender] = useState<'female' | 'male'>('female');

  // --- passo 1: il carrello ---
  const [scelte, setScelte] = useState<Scelta[]>([{ treatmentId: '', operatorId: '' }]);
  const [categoria, setCategoria] = useState<string[]>(['']);

  // --- passo 2: filtri e orari ---
  const [giorniOk, setGiorniOk] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [oraDa, setOraDa] = useState('09:00');
  const [oraA, setOraA] = useState('19:00');
  const [giorni, setGiorni] = useState<GiornoDisponibile[] | null>(null);
  const [cercando, setCercando] = useState(false);
  const [slotScelto, setSlotScelto] = useState<{ date: string; slot: Slot } | null>(null);

  // --- passo 3: dati ---
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<null | { date: string; startTime: string; endTime: string; treatmentName: string; operatorName: string; price: number; servizi: { nome: string; orario: string; operatrice: string; prezzo: number }[] }>(null);

  useEffect(() => {
    fetch('/api/booking/treatments').then(r => r.json()).then(d => setTreatments(d.treatments || [])).catch(() => {});
    fetch('/api/booking/operators').then(r => r.json()).then(d => setOperatrici(d.operators || [])).catch(() => {});
  }, []);

  const prezzoDi = useCallback((t: Treatment) =>
    gender === 'male' ? (t.priceMale ?? t.priceFemale ?? t.price) : (t.priceFemale ?? t.price), [gender]);
  const durataDi = useCallback((t: Treatment) =>
    gender === 'male' ? (t.durationMale ?? t.durationFemale ?? t.duration) : (t.durationFemale ?? t.duration), [gender]);

  const categorieDisponibili = useMemo(() => {
    const set = [...new Set(treatments.map(t => t.category))];
    return set.sort((a, b) => (CATEGORIE[a] || a).localeCompare(CATEGORIE[b] || b));
  }, [treatments]);

  const sceltePiene = scelte.filter(s => s.treatmentId);
  const totaleDurata = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId);
    return s + (t ? durataDi(t) : 0);
  }, 0);
  const totalePrezzo = sceltePiene.reduce((s, x) => {
    const t = treatments.find(t => t.id === x.treatmentId);
    return s + (t ? prezzoDi(t) : 0);
  }, 0);

  // Cambiare i trattamenti dopo aver scelto l'orario renderebbe quell'orario
  // sbagliato: si torna indietro e si ricerca.
  const invalidaOrari = () => { setGiorni(null); setSlotScelto(null); };

  const cerca = async () => {
    setCercando(true); setErrore(null); setSlotScelto(null);
    try {
      const res = await fetch('/api/booking/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: sceltePiene.map(s => ({ treatmentId: s.treatmentId, operatorId: s.operatorId || null })),
          gender, giorniSettimana: giorniOk, from: oraDa, to: oraA, giorni: 21,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ricerca non riuscita');
      setGiorni(d.giorni || []);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore. Riprova.');
    } finally {
      setCercando(false);
    }
  };

  const conferma = async () => {
    if (!slotScelto) return;
    setInvio(true); setErrore(null);
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome.trim(), phone: telefono.trim(), email: email.trim() || null, gender,
          date: slotScelto.date, startTime: slotScelto.slot.time,
          services: sceltePiene.map(s => ({ treatmentId: s.treatmentId, operatorId: s.operatorId || null })),
          marketingConsent: marketing,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Prenotazione non riuscita');
      setFatto(d.appointment);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  // ---------------------------------------------------------------- fatto
  if (fatto) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <div style={s.check}>✓</div>
          <h1 style={s.doneTitle}>Prenotazione confermata!</h1>
          <p style={s.doneSub}>Ti aspettiamo da RevoBeauty.</p>
          <div style={s.riepilogo}>
            <div style={s.riga}><span>Quando</span><b style={{ textTransform: 'capitalize' }}>{dataLunga(fatto.date)} · {fatto.startTime}</b></div>
            {fatto.servizi.map((sv, i) => (
              <div key={i} style={s.riga}><span>{sv.orario} · {sv.nome}</span><b>{sv.operatrice}</b></div>
            ))}
            <div style={{ ...s.riga, borderTop: '1px solid #ece6f4', paddingTop: 10 }}>
              <span>Totale</span><b>{eur(fatto.price)}</b>
            </div>
          </div>
          <p style={s.nota}>Riceverai la conferma su WhatsApp. Se devi spostare, rispondi a quel messaggio.</p>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------- wizard
  return (
    <main style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>RevoBeauty</div>
        <h1 style={s.title}>Prenota il tuo appuntamento</h1>

        {/* barra dei passi */}
        <div style={s.passi}>
          {[[1, 'Servizio'], [2, 'Orario'], [3, 'I tuoi dati']].map(([n, label]) => (
            <div key={n as number} style={{ flex: 1 }}>
              <div style={{ ...s.passoLabel, ...(passo >= (n as number) ? s.passoAttivo : {}) }}>{label}</div>
              <div style={{ ...s.passoBarra, ...(passo >= (n as number) ? s.passoBarraAttiva : {}) }} />
            </div>
          ))}
        </div>

        {/* ============================ PASSO 1 ============================ */}
        {passo === 1 && (
          <>
            <div style={s.genderRow}>
              <button style={{ ...s.genderBtn, ...(gender === 'female' ? s.genderActive : {}) }}
                onClick={() => { setGender('female'); invalidaOrari(); }}>♀ Donna</button>
              <button style={{ ...s.genderBtn, ...(gender === 'male' ? s.genderActive : {}) }}
                onClick={() => { setGender('male'); invalidaOrari(); }}>♂ Uomo</button>
            </div>

            {scelte.map((sc, i) => {
              const cat = categoria[i] || '';
              const diCategoria = cat ? treatments.filter(t => t.category === cat) : [];
              return (
                <div key={i} style={s.bloccoServizio}>
                  {scelte.length > 1 && (
                    <div style={s.bloccoTitolo}>
                      <span>Trattamento {i + 1}</span>
                      <button style={s.rimuovi} onClick={() => {
                        setScelte(scelte.filter((_, j) => j !== i));
                        setCategoria(categoria.filter((_, j) => j !== i));
                        invalidaOrari();
                      }}>Togli</button>
                    </div>
                  )}

                  <label style={s.label}>Categoria</label>
                  <select style={s.select} value={cat} onChange={e => {
                    const next = [...categoria]; next[i] = e.target.value; setCategoria(next);
                    const ns = [...scelte]; ns[i] = { ...ns[i], treatmentId: '' }; setScelte(ns);
                    invalidaOrari();
                  }}>
                    <option value="">Scegli una categoria…</option>
                    {categorieDisponibili.map(c => <option key={c} value={c}>{CATEGORIE[c] || c}</option>)}
                  </select>

                  {cat && (
                    <>
                      <label style={s.label}>Trattamento</label>
                      <select style={s.select} value={sc.treatmentId} onChange={e => {
                        const ns = [...scelte]; ns[i] = { ...ns[i], treatmentId: e.target.value }; setScelte(ns);
                        invalidaOrari();
                      }}>
                        <option value="">Scegli un trattamento…</option>
                        {diCategoria.map(t => (
                          <option key={t.id} value={t.id}>{t.name} — {durataDi(t)} min · {eur(prezzoDi(t))}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {sc.treatmentId && (
                    <>
                      <label style={s.label}>Con chi</label>
                      <select style={s.select} value={sc.operatorId} onChange={e => {
                        const ns = [...scelte]; ns[i] = { ...ns[i], operatorId: e.target.value }; setScelte(ns);
                        invalidaOrari();
                      }}>
                        <option value="">La prima disponibile</option>
                        {operatrici.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    </>
                  )}
                </div>
              );
            })}

            <button style={s.aggiungi} onClick={() => {
              setScelte([...scelte, { treatmentId: '', operatorId: '' }]);
              setCategoria([...categoria, '']);
              invalidaOrari();
            }}>+ Aggiungi un altro trattamento</button>

            {sceltePiene.length > 0 && (
              <div style={s.totale}>
                <span>{sceltePiene.length} trattament{sceltePiene.length === 1 ? 'o' : 'i'} · {totaleDurata} min</span>
                <b>{eur(totalePrezzo)}</b>
              </div>
            )}

            <button style={{ ...s.cta, ...(sceltePiene.length > 0 ? {} : s.ctaOff) }}
              disabled={sceltePiene.length === 0}
              onClick={() => { setPasso(2); if (!giorni) void cerca(); }}>
              Avanti
            </button>
          </>
        )}

        {/* ============================ PASSO 2 ============================ */}
        {passo === 2 && (
          <>
            <div style={s.riquadroFiltri}>
              <label style={s.label}>Quali giorni ti vanno bene</label>
              <div style={s.giorniRow}>
                {GIORNI.map(g => {
                  const on = giorniOk.includes(g.n);
                  return (
                    <button key={g.n} style={{ ...s.giornoBtn, ...(on ? s.giornoOn : {}) }}
                      onClick={() => setGiorniOk(on ? giorniOk.filter(x => x !== g.n) : [...giorniOk, g.n])}>
                      {g.label}
                    </button>
                  );
                })}
              </div>

              <label style={s.label}>A che ora</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select style={{ ...s.select, marginBottom: 0 }} value={oraDa} onChange={e => setOraDa(e.target.value)}>
                  {ORE.slice(0, -1).map(o => <option key={o} value={o}>dalle {o}</option>)}
                </select>
                <select style={{ ...s.select, marginBottom: 0 }} value={oraA} onChange={e => setOraA(e.target.value)}>
                  {ORE.slice(1).map(o => <option key={o} value={o}>alle {o}</option>)}
                </select>
              </div>

              <button style={s.cerca} onClick={cerca} disabled={cercando || giorniOk.length === 0}>
                {cercando ? 'Cerco…' : 'Cerca gli orari liberi'}
              </button>
            </div>

            {errore && <div style={s.errore}>{errore}</div>}

            {cercando ? (
              <p style={s.muted}>Cerco gli orari liberi…</p>
            ) : giorni === null ? null : giorni.length === 0 ? (
              <p style={s.muted}>Nessun orario libero con questi filtri. Prova ad allargare i giorni o la fascia oraria.</p>
            ) : (
              giorni.map(g => (
                <div key={g.date} style={{ marginTop: 16 }}>
                  <p style={s.giornoTitolo}>{dataLunga(g.date)}</p>
                  <div style={s.slotGrid}>
                    {g.slots.map(sl => {
                      const scelto = slotScelto?.date === g.date && slotScelto.slot.time === sl.time;
                      return (
                        <button key={sl.time} style={{ ...s.slotBtn, ...(scelto ? s.slotOn : {}) }}
                          onClick={() => setSlotScelto({ date: g.date, slot: sl })}>
                          {sl.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {slotScelto && (
              <div style={s.riepilogoSlot}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, textTransform: 'capitalize' }}>
                  {dataLunga(slotScelto.date)} · {slotScelto.slot.time}–{slotScelto.slot.endTime}
                </p>
                {slotScelto.slot.assegnazioni.map((a, i) => (
                  <p key={i} style={s.rigaSlot}>{a.startTime} · {a.treatmentName} <span style={{ color: P }}>con {a.operatorName}</span></p>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.indietro} onClick={() => setPasso(1)}>← Indietro</button>
              <button style={{ ...s.cta, flex: 2, ...(slotScelto ? {} : s.ctaOff) }} disabled={!slotScelto}
                onClick={() => setPasso(3)}>Avanti</button>
            </div>
          </>
        )}

        {/* ============================ PASSO 3 ============================ */}
        {passo === 3 && slotScelto && (
          <>
            <div style={s.riepilogoSlot}>
              <p style={{ margin: '0 0 6px', fontWeight: 700, textTransform: 'capitalize' }}>
                {dataLunga(slotScelto.date)} · {slotScelto.slot.time}
              </p>
              {slotScelto.slot.assegnazioni.map((a, i) => (
                <p key={i} style={s.rigaSlot}>{a.treatmentName} · {a.operatorName}</p>
              ))}
              <p style={{ margin: '8px 0 0', fontWeight: 800 }}>Totale {eur(slotScelto.slot.prezzoTotale)}</p>
            </div>

            <label style={s.label}>I tuoi dati</label>
            <input style={s.input} {...NO_AUTOFILL} placeholder="Nome e cognome" value={nome} onChange={e => setNome(e.target.value)} />
            <input style={s.input} {...NO_AUTOFILL} placeholder="Cellulare" value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" />
            <input style={s.input} {...NO_AUTOFILL} placeholder="Email (facoltativa)" value={email} onChange={e => setEmail(e.target.value)} inputMode="email" />

            <label style={s.consenso}>
              <input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
              <span>Acconsento al trattamento dei miei dati per gestire l&apos;appuntamento (obbligatorio)</span>
            </label>
            <label style={s.consenso}>
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
              <span>Voglio ricevere promozioni e novità da RevoBeauty (facoltativo)</span>
            </label>

            {errore && <div style={s.errore}>{errore}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.indietro} onClick={() => setPasso(2)}>← Indietro</button>
              <button
                style={{ ...s.cta, flex: 2, ...(nome.trim() && telefono.replace(/\D/g, '').length >= 9 && privacy && !invio ? {} : s.ctaOff) }}
                disabled={!nome.trim() || telefono.replace(/\D/g, '').length < 9 || !privacy || invio}
                onClick={conferma}>
                {invio ? 'Prenotazione in corso…' : `Conferma · ${eur(slotScelto.slot.prezzoTotale)}`}
              </button>
            </div>
            <p style={s.nota}>Si paga in centro. Riceverai la conferma su WhatsApp.</p>
          </>
        )}
      </div>
    </main>
  );
}

const P = '#A855F7';
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg,#faf5ff 0%,#fdf2f8 100%)', padding: '24px 16px', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif', color: '#1f1230' },
  card: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px -12px rgba(168,85,247,.25)', padding: 24, alignSelf: 'flex-start' },
  brand: { fontWeight: 800, fontSize: 14, letterSpacing: '.16em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  title: { fontSize: 25, fontWeight: 800, margin: '8px 0 0', lineHeight: 1.15 },

  passi: { display: 'flex', gap: 6, margin: '18px 0 6px' },
  passoLabel: { fontSize: 11.5, fontWeight: 700, color: '#b4a8c4', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' },
  passoAttivo: { color: P },
  passoBarra: { height: 4, borderRadius: 999, background: '#efe9f7' },
  passoBarraAttiva: { background: `linear-gradient(90deg,${P},#EC4899)` },

  genderRow: { display: 'flex', gap: 8, margin: '16px 0 4px' },
  genderBtn: { flex: 1, padding: '10px', borderRadius: 12, border: '1px solid #ece6f4', background: '#faf8fd', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#6b6577' },
  genderActive: { background: P, color: '#fff', borderColor: P },

  bloccoServizio: { border: '1px solid #f0ebf7', borderRadius: 16, padding: 14, marginTop: 14, background: '#fcfaff' },
  bloccoTitolo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 800, color: P, textTransform: 'uppercase', letterSpacing: '.05em' },
  rimuovi: { border: 'none', background: 'transparent', color: '#c86b8a', fontWeight: 700, fontSize: 12, cursor: 'pointer' },

  label: { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P, marginTop: 14, marginBottom: 6 },
  select: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid #e5dff0', fontSize: 14.5, background: '#fff', marginBottom: 4, color: '#1f1230' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5dff0', fontSize: 15, marginBottom: 10, outlineColor: P },

  aggiungi: { width: '100%', marginTop: 12, padding: '11px', borderRadius: 12, border: `1.5px dashed ${P}66`, background: '#fff', color: P, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  totale: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '12px 14px', borderRadius: 14, background: '#faf5ff', border: `1px solid ${P}22`, fontSize: 14, color: '#6b6577' },

  riquadroFiltri: { border: '1px solid #f0ebf7', borderRadius: 16, padding: 14, marginTop: 16, background: '#fcfaff' },
  giorniRow: { display: 'flex', gap: 6 },
  giornoBtn: { flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #ece6f4', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#94809f' },
  giornoOn: { background: P, color: '#fff', borderColor: P },
  cerca: { width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' },

  giornoTitolo: { fontSize: 14, fontWeight: 800, textTransform: 'capitalize', margin: '0 0 8px' },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 8 },
  slotBtn: { padding: '10px', borderRadius: 12, border: '1px solid #ece6f4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#4b4459' },
  slotOn: { background: P, color: '#fff', borderColor: P },

  riepilogoSlot: { marginTop: 16, padding: 14, borderRadius: 14, background: '#faf5ff', border: `1.5px solid ${P}`, fontSize: 13.5 },
  rigaSlot: { margin: '3px 0', color: '#6b6577' },

  consenso: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#6b6577', margin: '4px 0 10px' },
  cta: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 16 },
  ctaOff: { opacity: 0.4, cursor: 'not-allowed' },
  indietro: { flex: 1, marginTop: 16, padding: '14px', borderRadius: 14, border: '1px solid #e5dff0', background: '#fff', color: '#6b6577', fontWeight: 600, fontSize: 14, cursor: 'pointer' },

  muted: { color: '#94809f', fontSize: 13.5, marginTop: 14 },
  nota: { color: '#94809f', fontSize: 12.5, marginTop: 12, lineHeight: 1.5, textAlign: 'center' },
  errore: { background: '#fdeaee', color: '#be123c', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginTop: 12 },

  check: { width: 56, height: 56, borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  doneTitle: { textAlign: 'center', fontSize: 24, fontWeight: 800, margin: '0 0 4px' },
  doneSub: { textAlign: 'center', color: '#6b6577', margin: '0 0 20px' },
  riepilogo: { background: '#faf8fd', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  riga: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: '#6b6577' },
};
