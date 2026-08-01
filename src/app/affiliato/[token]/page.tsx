'use client';

/**
 * Portale dell'affiliato — "Il mio QR code".
 *
 * L'attività partner apre questo link (glielo diamo noi, con il token segreto
 * nell'URL: niente password) e trova il suo QR da mostrare, scaricare,
 * stampare o condividere, con i numeri di quanto sta portando: scansioni,
 * registrazioni, omaggi usati, clienti paganti, fatturato e commissioni.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type QrStats = {
  scansioni: number; scansioniUniche: number; registrazioni: number; verificati: number;
  abbandonate: number; bloccati: number; conversione: number; appuntamenti: number;
  omaggiUsati: number; clientiPaganti: number; fatturato: number; commissioni: number;
};
type QrItem = { slug: string; nome: string; canale: string | null; trattamento: string; stato: string; url: string; stats: QrStats };
type Portale = {
  ok: boolean; attivita: string; codice: string; commissione: number;
  statiEtichette: Record<string, string>; qrs: QrItem[]; totali: QrStats;
};

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function PortaleAffiliato() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [dati, setDati] = useState<Portale | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [slugAttivo, setSlugAttivo] = useState('');
  const [copiato, setCopiato] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/affiliazione/portale/${token}`)
      .then(r => r.json())
      .then((d: Portale) => {
        setDati(d);
        if (d.ok && d.qrs.length > 0) setSlugAttivo(d.qrs.find(q => q.stato === 'active')?.slug || d.qrs[0].slug);
      })
      .catch(() => setDati(null))
      .finally(() => setCaricamento(false));
  }, [token]);

  if (caricamento) return <main style={s.page}><p style={s.muted}>Un attimo…</p></main>;
  if (!dati?.ok) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <div style={s.brand}>RevoBeauty</div>
          <h1 style={s.title}>Portale non trovato</h1>
          <p style={s.sub}>Il link non è valido. Contatta RevoBeauty per riceverne uno nuovo.</p>
        </div>
      </main>
    );
  }

  const qr = dati.qrs.find(q => q.slug === slugAttivo) || dati.qrs[0];
  const t = dati.totali;

  const copiaLink = async () => {
    if (!qr) return;
    try { await navigator.clipboard.writeText(qr.url); setCopiato(true); setTimeout(() => setCopiato(false), 2000); } catch {}
  };

  // JPG: si parte dal PNG del server e lo si riconverte su un canvas bianco.
  const scaricaJpg = () => {
    if (!qr) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.download = `qr-${dati.codice.toLowerCase()}-${qr.slug}.jpg`;
      a.click();
    };
    img.src = `/api/affiliazione/qr/${qr.slug}`;
  };

  const condividiWhatsApp = () => {
    if (!qr) return;
    const testo = `Con ${dati.attivita} hai un trattamento gratuito da RevoBeauty 🎁 Registrati qui: ${qr.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(testo)}`, '_blank');
  };

  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.brand}>RevoBeauty · Programma partner</div>
          <h1 style={s.title}>{dati.attivita}</h1>
          <p style={s.sub}>Codice affiliato <b>{dati.codice}</b> · Commissione {dati.commissione}% sugli incassi dei clienti che porti</p>
        </div>

        {/* Numeri complessivi */}
        <div style={s.statGrid}>
          <Stat label="Scansioni" value={String(t.scansioni)} extra={`${t.scansioniUniche} uniche`} />
          <Stat label="Registrazioni" value={String(t.verificati)} extra={`${t.conversione}% delle visite`} />
          <Stat label="Prenotazioni" value={String(t.appuntamenti)} />
          <Stat label="Omaggi usati" value={String(t.omaggiUsati)} />
          <Stat label="Clienti paganti" value={String(t.clientiPaganti)} />
          <Stat label="Fatturato portato" value={eur(t.fatturato)} />
          <Stat label="Le tue commissioni" value={eur(t.commissioni)} evidenzia />
        </div>

        {/* Il mio QR code */}
        {qr && (
          <div style={s.card}>
            <h2 style={s.h2}>Il mio QR code</h2>
            {dati.qrs.length > 1 && (
              <div style={s.qrTabs}>
                {dati.qrs.map(q => (
                  <button key={q.slug}
                    style={{ ...s.qrTab, ...(q.slug === qr.slug ? s.qrTabAttivo : {}) }}
                    onClick={() => setSlugAttivo(q.slug)}>
                    {q.nome}
                  </button>
                ))}
              </div>
            )}
            <p style={s.muted}>
              {qr.nome}{qr.canale ? ` · ${qr.canale}` : ''} · Omaggio: {qr.trattamento}
              {qr.stato !== 'active' && <span style={s.statoBadge}> {dati.statiEtichette[qr.stato] || qr.stato}</span>}
            </p>

            <div style={s.qrBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/affiliazione/qr/${qr.slug}`} alt="Il tuo QR code" style={s.qrImg} />
            </div>

            <div style={s.btnRow}>
              <a style={s.btn} href={`/api/affiliazione/qr/${qr.slug}?dl=1`}>Scarica PNG</a>
              <button style={s.btn} onClick={scaricaJpg}>Scarica JPG</button>
              <a style={s.btn} href={`/api/affiliazione/qr/${qr.slug}?f=svg&dl=1`}>Scarica SVG</a>
              <a style={s.btn} href={`/q/${qr.slug}/locandina`} target="_blank">Stampa locandina</a>
              <button style={s.btn} onClick={copiaLink}>{copiato ? 'Copiato ✓' : 'Copia il link'}</button>
              <button style={{ ...s.btn, ...s.btnWa }} onClick={condividiWhatsApp}>Condividi su WhatsApp</button>
            </div>

            {/* Numeri del singolo QR, se ne hai più d'uno */}
            {dati.qrs.length > 1 && (
              <p style={{ ...s.muted, marginTop: 14 }}>
                Questo QR: {qr.stats.scansioni} scansioni · {qr.stats.verificati} registrazioni · {eur(qr.stats.commissioni)} di commissioni
              </p>
            )}
          </div>
        )}

        <p style={{ ...s.muted, textAlign: 'center' }}>
          Le commissioni maturano solo sugli incassi reali dei clienti registrati con il tuo QR. Per domande, scrivi a RevoBeauty.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value, extra, evidenzia }: { label: string; value: string; extra?: string; evidenzia?: boolean }) {
  return (
    <div style={{ ...s.stat, ...(evidenzia ? s.statEvidenzia : {}) }}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, ...(evidenzia ? { color: '#fff' } : {}) }}>{value}</div>
      {extra && <div style={{ ...s.statExtra, ...(evidenzia ? { color: 'rgba(255,255,255,.85)' } : {}) }}>{extra}</div>}
    </div>
  );
}

const P = '#A855F7';
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'linear-gradient(160deg,#faf5ff 0%,#fdf2f8 100%)', padding: '24px 16px', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif', color: '#1f1230' },
  wrap: { width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start' },
  card: { background: '#fff', borderRadius: 20, boxShadow: '0 10px 40px -12px rgba(168,85,247,.2)', padding: 22 },
  brand: { fontWeight: 800, fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  title: { fontSize: 26, fontWeight: 800, margin: '6px 0 4px' },
  h2: { fontSize: 18, fontWeight: 800, margin: '0 0 10px' },
  sub: { color: '#6b6577', fontSize: 14, margin: 0 },
  muted: { color: '#94809f', fontSize: 13 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 },
  stat: { background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 6px 24px -10px rgba(168,85,247,.18)' },
  statEvidenzia: { background: `linear-gradient(120deg,${P},#EC4899)` },
  statLabel: { fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#94809f' },
  statValue: { fontSize: 22, fontWeight: 800, marginTop: 2 },
  statExtra: { fontSize: 12, color: '#94809f', marginTop: 2 },
  qrTabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  qrTab: { padding: '7px 12px', borderRadius: 999, border: '1px solid #ece6f4', background: '#faf8fd', fontSize: 13, fontWeight: 600, color: '#6b6577', cursor: 'pointer' },
  qrTabAttivo: { background: P, color: '#fff', borderColor: P },
  statoBadge: { color: '#b45309', fontWeight: 700 },
  qrBox: { display: 'flex', justifyContent: 'center', margin: '16px 0' },
  qrImg: { width: 240, height: 240, border: '1px solid #eee6f6', borderRadius: 16, padding: 8, background: '#fff' },
  btnRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 },
  btn: { display: 'block', textAlign: 'center', padding: '11px 8px', borderRadius: 12, border: `1px solid ${P}`, background: '#fff', color: P, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none' },
  btnWa: { background: '#25D366', borderColor: '#25D366', color: '#fff' },
};
