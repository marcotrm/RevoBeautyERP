'use client';

/**
 * La schermata del tablet: aspetta, e quando arriva un modulo lo apre.
 *
 * E' l'unica pagina che il tablet vede mai. Nessun menu, nessun link, nessuna
 * via per finire in agenda o in anagrafica: se una cliente lo prende in mano
 * mentre aspetta, non trova niente da guardare. E' la stessa ragione per cui
 * il POS ha un tastierino e non un computer.
 *
 * Sta acceso tutto il giorno, quindi non deve fare rumore ne' scaldare: chiede
 * ogni due secondi se c'e' qualcosa da firmare, e per il resto sta fermo.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { codaTablet } from '@/app/actions/tablet';

export default function SchermataTablet() {
  const { chiave } = useParams<{ chiave: string }>();
  const [attesa, setAttesa] = useState<string | null>(null);
  const [ora, setOra] = useState('');

  useEffect(() => {
    const aggiorna = () => setOra(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    aggiorna();
    const t = setInterval(aggiorna, 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    const guarda = async () => {
      try {
        const c = await codaTablet(String(chiave));
        if (!vivo) return;
        setAttesa(c.cliente);
        if (c.url) window.location.href = c.url;
      } catch { /* rete ballerina: si riprova fra due secondi */ }
    };
    guarda();
    const t = setInterval(guarda, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, [chiave]);

  return (
    <main style={s.pagina}>
      <div style={s.centro}>
        <div style={s.cerchio}>
          <span style={{ fontSize: 44 }}>✍️</span>
        </div>
        <h1 style={s.titolo}>RevoBeauty</h1>
        <p style={s.sotto}>
          {attesa ? `Sto aprendo il modulo di ${attesa}…` : 'Pronto per la firma'}
        </p>
        <p style={s.nota}>
          Quando serve firmare un consenso, il modulo compare qui da solo.
        </p>
      </div>
      <p style={s.ora}>{ora}</p>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  pagina: {
    minHeight: '100vh', margin: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 40,
    background: 'linear-gradient(180deg,#faf7fd 0%,#f1e8fa 100%)',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    color: '#241f2b', textAlign: 'center', padding: 24,
    // Il tablet sta in verticale sul banco e nessuno deve poterlo trascinare
    // per sbaglio mentre firma.
    overscrollBehavior: 'none', userSelect: 'none', WebkitUserSelect: 'none',
  },
  centro: { maxWidth: 420 },
  cerchio: {
    width: 110, height: 110, borderRadius: 36, margin: '0 auto 22px',
    background: 'linear-gradient(135deg,#A855F7,#EC4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 14px 40px rgba(168,85,247,.3)',
  },
  titolo: { margin: '0 0 8px', fontSize: 30, letterSpacing: 0.5 },
  sotto: { margin: '0 0 14px', fontSize: 19, color: '#5b5266', fontWeight: 600 },
  nota: { margin: 0, fontSize: 14, color: '#8b8394', lineHeight: 1.5 },
  ora: { position: 'fixed', bottom: 18, fontSize: 13, color: '#a49dae' },
};
