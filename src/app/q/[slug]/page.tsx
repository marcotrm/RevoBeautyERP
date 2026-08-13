'use client';

/**
 * Landing pubblica dei QR affiliati: è la pagina che si apre inquadrando il
 * QR di un'attività partner. Due passi: presentazione dell'omaggio → dati +
 * consenso → voucher subito sullo schermo. Nessun codice di conferma: la
 * difesa vera è che l'affiliato guadagna solo quando il cliente viene in
 * centro e spende. Stesso stile "carta su sfondo sfumato" della pagina Prenota.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import { maiuscoleNome } from '@/lib/nomiPropri';

type Landing = {
  ok: boolean;
  attivo: boolean;
  stato: string;
  attivita: string;
  trattamento: string;
  messaggio: string | null;
  condizioni: string | null;
  centro: { nome: string; indirizzo: string };
};

const VISITOR_KEY = 'revo_aff_vid';

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch { return ''; }
}

export default function LandingAffiliato() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [landing, setLanding] = useState<Landing | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  // form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // flusso
  const [passo, setPasso] = useState<'form' | 'fatto'>('form');
  const [voucher, setVoucher] = useState('');
  const [copiato, setCopiato] = useState(false);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const scanFatto = useRef(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/affiliazione/landing/${slug}`)
      .then(r => r.json())
      .then((d: Landing) => setLanding(d))
      .catch(() => setLanding(null))
      .finally(() => setCaricamento(false));
  }, [slug]);

  // Una scansione = una visita: si conta una volta sola per apertura.
  useEffect(() => {
    if (!slug || !landing?.ok || scanFatto.current) return;
    scanFatto.current = true;
    fetch('/api/affiliazione/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, visitorId: visitorId() }),
    }).catch(() => {});
  }, [slug, landing]);

  const registra = async () => {
    setInvio(true); setErrore(null);
    try {
      const res = await fetch('/api/affiliazione/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, firstName: firstName.trim(), lastName: lastName.trim(),
          phone: phone.trim(), email: email.trim() || null,
          privacy, marketing, visitorId: visitorId(),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Registrazione non riuscita. Riprova.');
      setVoucher(d.voucher);
      setPasso('fatto');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  const copiaVoucher = async () => {
    try { await navigator.clipboard.writeText(voucher); setCopiato(true); setTimeout(() => setCopiato(false), 2000); } catch {}
  };

  const puoiRegistrare = firstName.trim() && lastName.trim() && phone.replace(/\D/g, '').length >= 9 && privacy;

  if (caricamento) {
    return <main style={styles.page}><div style={styles.card}><p style={styles.muted}>Un attimo…</p></div></main>;
  }

  if (!landing?.ok) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>RevoBeauty</div>
          <h1 style={styles.title}>Offerta non trovata</h1>
          <p style={styles.sub}>Questo QR non è collegato a nessuna offerta attiva. Chiedi all&apos;attività che te l&apos;ha mostrato, o contattaci direttamente.</p>
        </div>
      </main>
    );
  }

  if (!landing.attivo) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>RevoBeauty</div>
          <h1 style={styles.title}>Offerta non più disponibile</h1>
          <p style={styles.sub}>Questa promozione di <b>{landing.attivita}</b> è terminata. Ti aspettiamo comunque da {landing.centro.nome} in {landing.centro.indirizzo}!</p>
        </div>
      </main>
    );
  }

  // --- Voucher ottenuto -------------------------------------------------
  if (passo === 'fatto') {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.checkCircle}>✓</div>
          <h1 style={styles.doneTitle}>Il tuo omaggio è pronto!</h1>
          <p style={styles.doneSub}>Ecco il tuo buono per <b>{landing.trattamento}</b>. Fai uno screenshot!</p>
          <div style={styles.voucherBox}>
            <div style={styles.voucherLabel}>Codice omaggio</div>
            <div style={styles.voucherCode}>{voucher}</div>
            <button style={styles.copyBtn} onClick={copiaVoucher}>{copiato ? 'Copiato ✓' : 'Copia il codice'}</button>
          </div>
          <p style={styles.smallNote}>
            Mostra questo codice quando vieni in centro: {landing.centro.nome}, {landing.centro.indirizzo}.
            {landing.condizioni ? ` ${landing.condizioni}` : ''}
          </p>
          <a href="/prenota" style={styles.ctaLink}>Prenota subito il tuo appuntamento</a>
          <p style={{ ...styles.smallNote, textAlign: 'center' }}>Oppure passa a trovarci quando vuoi: il buono ti aspetta.</p>
        </div>
      </main>
    );
  }

  // --- Presentazione + form --------------------------------------------
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>RevoBeauty</div>
        <div style={styles.giftBadge}>🎁 Trattamento in omaggio</div>
        <h1 style={styles.title}>
          Grazie a <span style={styles.evidenzia}>{landing.attivita}</span> hai diritto a un trattamento gratuito da RevoBeauty
        </h1>
        <p style={styles.sub}>{landing.messaggio || `Una seduta di ${landing.trattamento} in regalo, senza impegno. Registrati qui sotto e ricevi subito il tuo buono.`}</p>

        <div style={styles.treatBox}>
          <div style={{ fontWeight: 700 }}>{landing.trattamento}</div>
          <div style={styles.muted}>{landing.centro.nome} · {landing.centro.indirizzo}</div>
        </div>

        <label style={styles.label}>I tuoi dati</label>
        <input style={styles.input} {...NO_AUTOFILL} placeholder="Nome" value={firstName} onChange={e => setFirstName(maiuscoleNome(e.target.value))} />
        <input style={styles.input} {...NO_AUTOFILL} placeholder="Cognome" value={lastName} onChange={e => setLastName(maiuscoleNome(e.target.value))} />
        <input style={styles.input} {...NO_AUTOFILL} placeholder="Cellulare (con WhatsApp)" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        <input style={styles.input} {...NO_AUTOFILL} placeholder="Email (facoltativa)" value={email} onChange={e => setEmail(e.target.value)} inputMode="email" />

        <label style={styles.consent}>
          <input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
          <span>Acconsento al trattamento dei miei dati per usufruire dell&apos;offerta (obbligatorio)</span>
        </label>
        <label style={styles.consent}>
          <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
          <span>Voglio ricevere promozioni e novità da RevoBeauty (facoltativo)</span>
        </label>

        {errore && <div style={styles.error}>{errore}</div>}

        <button
          style={{ ...styles.cta, ...(puoiRegistrare && !invio ? {} : styles.ctaDisabled) }}
          disabled={!puoiRegistrare || invio}
          onClick={registra}
        >
          {invio ? 'Un attimo…' : 'Ricevi il tuo omaggio'}
        </button>
        <p style={styles.smallNote}>
          Il buono appare subito qui sullo schermo: mostralo quando vieni in centro.
          {landing.condizioni ? ` ${landing.condizioni}` : ''}
        </p>
      </div>
    </main>
  );
}

const P = '#A855F7';
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg,#faf5ff 0%,#fdf2f8 100%)', padding: '24px 16px', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif', color: '#1f1230' },
  card: { width: '100%', maxWidth: 460, background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px -12px rgba(168,85,247,.25)', padding: 24, alignSelf: 'flex-start' },
  brand: { fontWeight: 800, fontSize: 14, letterSpacing: '.16em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  giftBadge: { display: 'inline-block', marginTop: 14, padding: '6px 12px', borderRadius: 999, background: '#faf5ff', border: `1px solid ${P}33`, color: P, fontWeight: 700, fontSize: 13 },
  title: { fontSize: 24, fontWeight: 800, margin: '10px 0 6px', lineHeight: 1.2 },
  evidenzia: { background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  sub: { color: '#6b6577', fontSize: 15, margin: 0 },
  treatBox: { margin: '16px 0 4px', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${P}`, background: '#faf5ff', fontSize: 15 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P, marginTop: 20, marginBottom: 8 },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5dff0', fontSize: 15, marginBottom: 10, outlineColor: P },
  otpInput: { fontSize: 30, letterSpacing: '.35em', textAlign: 'center', fontWeight: 800, marginTop: 16 },
  consent: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#6b6577', margin: '4px 0 8px' },
  cta: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 },
  ctaDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  ctaLink: { display: 'block', textAlign: 'center', padding: '14px', borderRadius: 14, background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 16, textDecoration: 'none', marginTop: 8 },
  linkBtn: { display: 'block', width: '100%', marginTop: 12, border: 'none', background: 'transparent', color: P, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  muted: { color: '#94809f', fontSize: 13 },
  smallNote: { color: '#94809f', fontSize: 12.5, marginTop: 12, lineHeight: 1.5 },
  error: { background: '#fdeaee', color: '#be123c', padding: '10px 12px', borderRadius: 10, fontSize: 13, margin: '10px 0' },
  warn: { background: '#fef9e7', color: '#92600a', padding: '10px 12px', borderRadius: 10, fontSize: 13, margin: '10px 0' },
  checkCircle: { width: 56, height: 56, borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  doneTitle: { textAlign: 'center', fontSize: 24, fontWeight: 800, margin: '0 0 4px' },
  doneSub: { textAlign: 'center', color: '#6b6577', margin: '0 0 18px' },
  voucherBox: { textAlign: 'center', border: `2px dashed ${P}`, borderRadius: 16, padding: '18px 14px', background: '#faf5ff', marginBottom: 14 },
  voucherLabel: { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P },
  voucherCode: { fontSize: 32, fontWeight: 800, letterSpacing: '.06em', margin: '6px 0 10px' },
  copyBtn: { border: `1px solid ${P}`, background: '#fff', color: P, fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 10, cursor: 'pointer' },
};
