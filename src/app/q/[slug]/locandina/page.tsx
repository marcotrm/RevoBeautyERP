'use client';

/**
 * Locandina A4 di un QR affiliato, fatta per essere BELLA stampata: fondo
 * pieno nel gradiente RevoBeauty, trattamento a caratteri giganti, QR in una
 * carta bianca in rilievo. "Stampa" (o Salva come PDF dalla finestra di
 * stampa) produce l'A4 a tutta pagina, pronto per banco o vetrina.
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

  if (!dati?.ok) return <main style={s.page}><p style={{ color: '#94809f' }}>Preparo la locandina…</p></main>;

  // Nomi lunghi = caratteri più piccoli, così non sbordano mai dall'A4
  const len = dati.trattamento.length;
  const trattamentoSize = len > 34 ? 44 : len > 22 ? 54 : len > 14 ? 66 : 78;

  return (
    <main style={s.page}>
      <button style={s.printBtn} className="no-stampa" onClick={() => window.print()}>🖨️ Stampa la locandina</button>
      <p style={s.hint} className="no-stampa">Nella finestra di stampa attiva “Grafica di sfondo” e, se vuoi il file, scegli “Salva come PDF”.</p>

      <div style={s.poster} className="locandina">
        {/* bagliori decorativi */}
        <div style={{ ...s.glow, top: '-12%', left: '-18%' }} />
        <div style={{ ...s.glow, bottom: '-15%', right: '-20%', background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 65%)' }} />
        <div style={s.cornice} />

        <div style={s.contenuto}>
          <div style={s.brand}>✦ &nbsp;R E V O B E A U T Y&nbsp; ✦</div>

          <div style={s.regalo}>Un regalo per te</div>
          <div style={s.badge}>TRATTAMENTO GRATUITO</div>

          <h1 style={{ ...s.treat, fontSize: trattamentoSize }}>{dati.trattamento.replace(/\.$/, '')}</h1>

          <p style={s.grazie}>offerto in collaborazione con</p>
          <p style={s.partner}>{dati.attivita}</p>

          <div style={s.qrCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/affiliazione/qr/${slug}`} alt="QR code" style={s.qr} />
            <p style={s.istruzioni}>Inquadra con la fotocamera<br />e prenota il tuo omaggio</p>
          </div>

          <div style={s.footer}>
            <p style={s.indirizzo}>📍 {dati.centro.nome} · {dati.centro.indirizzo}</p>
            {dati.condizioni && <p style={s.condizioni}>{dati.condizioni}</p>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .no-stampa { display: none !important; }
          main { padding: 0 !important; background: #fff !important; display: block !important; }
          .locandina {
            width: 210mm !important; height: 297mm !important;
            max-width: none !important; aspect-ratio: auto !important;
            margin: 0 !important; border-radius: 0 !important; box-shadow: none !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
        }
        .locandina, .locandina * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f4eefb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 16px 48px', fontFamily: '-apple-system,Segoe UI,system-ui,sans-serif' },
  printBtn: { padding: '12px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(90deg,#A855F7,#EC4899)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  hint: { margin: 0, fontSize: 12, color: '#94809f' },

  poster: {
    position: 'relative', width: '100%', maxWidth: 640, aspectRatio: '210 / 297',
    background: 'linear-gradient(160deg, #7C3AED 0%, #A855F7 45%, #EC4899 100%)',
    borderRadius: 18, overflow: 'hidden', color: '#fff',
    boxShadow: '0 24px 70px -24px rgba(124,58,237,.55)',
  },
  glow: { position: 'absolute', width: '65%', paddingBottom: '65%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 65%)' },
  cornice: { position: 'absolute', inset: '2.8%', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, pointerEvents: 'none' },

  contenuto: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '7% 8% 6%' },
  brand: { fontSize: 15, fontWeight: 700, letterSpacing: '.35em', opacity: 0.95 },

  regalo: { marginTop: '5%', fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 30, fontWeight: 400, opacity: 0.95 },
  badge: { marginTop: 14, padding: '8px 22px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.14)', fontSize: 15, fontWeight: 800, letterSpacing: '.22em' },

  treat: { margin: '4.5% 0 0', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.01em', textShadow: '0 4px 24px rgba(0,0,0,0.18)', textTransform: 'capitalize' },

  grazie: { margin: '4.5% 0 0', fontSize: 15, opacity: 0.9 },
  partner: { margin: '2px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '.02em' },

  qrCard: { marginTop: '5%', background: '#fff', borderRadius: 22, padding: '5.5% 7% 4.5%', boxShadow: '0 18px 50px -18px rgba(0,0,0,0.45)' },
  qr: { width: 'min(46vw, 250px)', maxWidth: '100%', display: 'block' },
  istruzioni: { margin: '12px 0 0', color: '#1f1230', fontSize: 16, fontWeight: 800, lineHeight: 1.35 },

  footer: { marginTop: 'auto', paddingTop: '4%' },
  indirizzo: { margin: 0, fontSize: 15, fontWeight: 600, opacity: 0.95 },
  condizioni: { margin: '6px 0 0', fontSize: 11.5, opacity: 0.8 },
};
