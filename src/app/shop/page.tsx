'use client';

/**
 * Lo shop: si ordina online, si ritira in centro.
 *
 * Non e' un e-commerce e non vuole esserlo: niente spedizioni, niente
 * pagamento anticipato, niente carte. La cliente mette da parte la crema
 * quando le viene in mente — la sera, dal divano, appena si accorge che sta
 * finendo — e la ritira al prossimo appuntamento. Si paga al banco.
 *
 * Il pezzo che vale e' proprio quello: senza, quel prodotto lo compra al
 * supermercato e non torna mai piu' su questo scaffale.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { NO_AUTOFILL } from '@/lib/noAutofill';

type Prodotto = { id: string; nome: string; marca: string; categoria: string; prezzo: number; disponibili: number; foto?: string | null };

const P = '#A855F7';
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export default function Shop() {
  const [prodotti, setProdotti] = useState<Prodotto[] | null>(null);
  const [carrello, setCarrello] = useState<Record<string, number>>({});
  const [cerca, setCerca] = useState('');
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [note, setNote] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/shop/prodotti')
      .then(r => r.json())
      .then(d => setProdotti(Array.isArray(d.prodotti) ? d.prodotti : []))
      .catch(() => setProdotti([]));
  }, []);

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const lista = prodotti || [];
    if (!q) return lista;
    return lista.filter(p => `${p.nome} ${p.marca} ${p.categoria}`.toLowerCase().includes(q));
  }, [prodotti, cerca]);

  const perCategoria = useMemo(() => {
    const m = new Map<string, Prodotto[]>();
    for (const p of filtrati) {
      const k = p.categoria || 'Altro';
      m.set(k, [...(m.get(k) || []), p]);
    }
    return [...m.entries()];
  }, [filtrati]);

  const righe = Object.entries(carrello).filter(([, q]) => q > 0);
  const totale = righe.reduce((t, [id, q]) => {
    const p = (prodotti || []).find(x => x.id === id);
    return t + (p ? p.prezzo * q : 0);
  }, 0);

  const cambia = (id: string, delta: number) => {
    setCarrello(c => {
      const p = (prodotti || []).find(x => x.id === id);
      const max = p?.disponibili ?? 1;
      const nuovo = Math.max(0, Math.min((c[id] || 0) + delta, max));
      return { ...c, [id]: nuovo };
    });
  };

  const ordina = async () => {
    setInvio(true); setErrore(null);
    try {
      const res = await fetch('/api/shop/ordina', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: nome.trim(), phone: telefono.trim(), note: note.trim() || undefined,
          righe: righe.map(([productId, qty]) => ({ productId, qty })),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Ordine non riuscito');
      setFatto(d.numero || 0);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore, riprova');
    } finally { setInvio(false); }
  };

  if (fatto !== null) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <div style={s.check}>✓</div>
          <h1 style={s.titolo}>Te li mettiamo da parte</h1>
          <p style={s.sotto}>
            Ordine numero {fatto}. Li trovi pronti col tuo nome sopra: li paghi quando passi, come sempre.
          </p>
          <a href="/prenota" style={s.cta}>Prenota un appuntamento</a>
        </div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={s.titolo}>I nostri prodotti</h1>
        <p style={s.sotto}>Ordina qui, ritiri e paghi in centro. Nessuna spedizione, nessun anticipo.</p>

        <input type="text" value={cerca} onChange={e => setCerca(e.target.value)} {...NO_AUTOFILL}
          placeholder="Cerca un prodotto" style={s.input} />

        {prodotti === null && <p style={s.attesa}>Carico i prodotti…</p>}
        {prodotti !== null && filtrati.length === 0 && <p style={s.attesa}>Nessun prodotto disponibile in questo momento.</p>}

        {perCategoria.map(([cat, lista]) => (
          <section key={cat} style={{ marginTop: 22 }}>
            <h2 style={s.categoria}>{cat}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lista.map(p => {
                const q = carrello[p.id] || 0;
                return (
                  <div key={p.id} style={s.prodotto}>
                    {/* La foto: senza, uno scaffale online e' un elenco di
                        parole, e le creme non si comprano leggendo. */}
                    {p.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.foto} alt="" style={s.miniatura} />
                      : <div style={{ ...s.miniatura, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🧴</div>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={s.nomeProdotto}>{p.nome}</p>
                      <p style={s.marca}>
                        {p.marca}
                        {p.disponibili <= 3 ? ` · ne restano ${p.disponibili}` : ''}
                      </p>
                    </div>
                    <span style={s.prezzo}>{eur(p.prezzo)}</span>
                    {q === 0 ? (
                      <button onClick={() => cambia(p.id, 1)} style={s.aggiungi}>Aggiungi</button>
                    ) : (
                      <span style={s.contatore}>
                        <button onClick={() => cambia(p.id, -1)} style={s.piccolo}>−</button>
                        <b style={{ minWidth: 18, textAlign: 'center' }}>{q}</b>
                        <button onClick={() => cambia(p.id, 1)} style={s.piccolo}>+</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {righe.length > 0 && (
          <div style={s.carrello}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <b style={{ fontSize: 16 }}>Il tuo ordine</b>
              <b style={{ fontSize: 16, color: P }}>{eur(totale)}</b>
            </div>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} {...NO_AUTOFILL}
              placeholder="Il tuo nome e cognome" style={s.input} />
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} {...NO_AUTOFILL}
              placeholder="Il tuo numero di telefono" style={s.input} />
            <input type="text" value={note} onChange={e => setNote(e.target.value)} {...NO_AUTOFILL}
              placeholder="Una nota (facoltativa)" style={s.input} />
            {errore && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{errore}</p>}
            <button onClick={ordina} disabled={invio || !nome.trim() || !telefono.trim()}
              style={{ ...s.cta, opacity: invio || !nome.trim() || !telefono.trim() ? 0.5 : 1 }}>
              {invio ? 'Mando…' : `Ordina — ${eur(totale)}`}
            </button>
            <p style={{ fontSize: 12, color: '#8b8394', textAlign: 'center', margin: '10px 0 0' }}>
              Non paghi adesso: paghi quando li ritiri.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', margin: 0, padding: '28px 18px 60px',
    background: 'linear-gradient(180deg,#faf7fd 0%,#f4edfb 100%)',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", color: '#241f2b',
  },
  card: { maxWidth: 460, margin: '40px auto', background: '#fff', borderRadius: 20, border: '1px solid #ece6f4', padding: 30, textAlign: 'center' },
  check: { width: 58, height: 58, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  titolo: { fontSize: 24, margin: '0 0 6px' },
  sotto: { fontSize: 14, color: '#7c7488', margin: '0 0 18px', lineHeight: 1.5 },
  categoria: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, color: '#9a94a3', margin: '0 0 10px' },
  prodotto: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #ece6f4', borderRadius: 14, padding: '13px 15px' },
  miniatura: { width: 54, height: 54, borderRadius: 10, objectFit: 'cover', background: '#f6f1fb', flexShrink: 0 },
  nomeProdotto: { margin: 0, fontSize: 15, fontWeight: 600 },
  marca: { margin: '2px 0 0', fontSize: 12, color: '#8b8394' },
  prezzo: { fontSize: 15, fontWeight: 700, flexShrink: 0 },
  aggiungi: { border: `1px solid ${P}`, background: 'transparent', color: P, borderRadius: 10, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  contatore: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  piccolo: { width: 30, height: 30, borderRadius: 9, border: '1px solid #ece6f4', background: '#fff', fontSize: 17, cursor: 'pointer', lineHeight: 1 },
  carrello: { position: 'sticky', bottom: 12, marginTop: 24, background: '#fff', border: '1px solid #ece6f4', borderRadius: 18, padding: 18, boxShadow: '0 12px 34px rgba(36,31,43,.12)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #ece6f4', fontSize: 15, marginTop: 8, outline: 'none' },
  cta: { display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none', marginTop: 14, padding: 14, borderRadius: 14, border: 'none', background: `linear-gradient(90deg,${P},#EC4899)`, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  attesa: { textAlign: 'center', color: '#8b8394', fontSize: 14, marginTop: 30 },
};
