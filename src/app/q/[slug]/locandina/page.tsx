'use client';

/**
 * Locandina pronta da stampare per un QR affiliato: la apre l'affiliato dal
 * suo portale (o noi dal gestionale), preme Stampa e la mette sul banco.
 * Con "Salva come PDF" nella finestra di stampa diventa anche il PDF
 * da mandare in tipografia.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Landing = {
  ok: boolean;
  attivita: string;
  trattamento: string;
  condizioni: string | null;
  centro: { nome: string; indirizzo: string };
};

export default function LocandinaQr() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [dati, setDati] = useState<Landing | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/affiliazione/landing/${slug}`).then(r => r.json()).then(setDati).catch(() => {});
  }, [slug]);

  if (!dati?.ok) return <main style={s.page}><p style={{ color: '#94809f' }}>Carico la locandina…</p></main>;

  return (
    <main style={s.page}>
      <button style={s.printBtn} className="no-stampa" onClick={() => window.print()}>🖨️ Stampa la locandina</button>

      <div style={s.poster}>
        <div style={s.brand}>{dati.centro.nome}</div>
        <div style={s.gratis}>Trattamento GRATUITO</div>
        <h1 style={s.treat}>{dati.trattamento}</h1>
        <p style={s.grazie}>In collaborazione con <b>{dati.attivita}</b></p>

        {/* L'immagine arriva già pronta dal server: la locandina è solo cornice. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/affiliazione/qr/${slug}`} alt="QR code" style={s.qr} />

        <p style={s.istruzioni}>Inquadra il QR con la fotocamera<br />e prenota il tuo omaggio</p>
        <div style={s.footer}>
          <div>{dati.centro.nome} · {dati.centro.indirizzo}</div>
          {dati.condizioni && <div style={s.condizioni}>{dati.condizioni}</div>}
        </div>
      </div>

      <style>{`
        @media print {
          .no-stampa { display: none !important; }
          body { background: #fff !important; }
          main { padding: 0 !important; background: #fff !important; }
        }
      `}</style>
    </main>
  );
}

const P = '#A855F7';
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f4eefb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 16px', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif' },
  printBtn: { padding: '12px 22px', borderRadius: 12, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  poster: { width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 10px 40px -12px rgba(168,85,247,.3)', color: '#1f1230' },
  brand: { fontWeight: 800, fontSize: 20, letterSpacing: '.2em', textTransform: 'uppercase', background: `linear-gradient(90deg,${P},#EC4899)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  gratis: { marginTop: 28, fontSize: 15, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: P },
  treat: { fontSize: 40, fontWeight: 800, margin: '8px 0 4px', lineHeight: 1.1 },
  grazie: { color: '#6b6577', fontSize: 17, margin: '0 0 28px' },
  qr: { width: 260, height: 260, border: '1px solid #eee6f6', borderRadius: 16, padding: 8 },
  istruzioni: { fontSize: 19, fontWeight: 700, margin: '24px 0 32px', lineHeight: 1.4 },
  footer: { borderTop: '1px solid #eee6f6', paddingTop: 18, color: '#6b6577', fontSize: 14 },
  condizioni: { marginTop: 8, fontSize: 12, color: '#94809f' },
};
