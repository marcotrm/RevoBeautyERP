'use client';

/**
 * Il listino come lo legge una cliente sul telefono.
 *
 * Una colonna sola: donna o uomo si sceglie in cima e i prezzi cambiano, così
 * non si legge una tabella a due colonne su uno schermo da sei pollici. La
 * ricerca serve a chi sa già cosa cerca, le categorie a chi sta guardando.
 */

import React, { useMemo, useState } from 'react';
import { getCategoryLabel } from '@/lib/helpers';
import type { Centro } from '@/lib/centro';

export interface VocePacchetto {
  id: string;
  nome: string;
  sedute: number;
  prezzo: number;
  trattamento: string;
  aSeduta: number;
  /** Quanto costa in meno rispetto alle stesse sedute pagate singole. */
  risparmio: number | null;
}

export interface VoceListino {
  id: string;
  nome: string;
  categoria: string;
  prezzoDonna: number;
  prezzoUomo: number;
  minutiDonna: number;
  minutiUomo: number;
}

/*
  Zero euro non si scrive "0,00 €".

  Un prezzo a zero in listino vuol dire quasi sempre "dipende" — la
  consulenza, l'unghia da aggiustare — e sulla pagina pubblica "0,00 €"
  si legge come "gratis" e diventa una discussione al banco.
*/
const euro = (n: number) => (n > 0 ? `${n.toFixed(2).replace('.', ',')} €` : 'su richiesta');

export default function ListinoClient({ voci, pacchetti, centro }: {
  voci: VoceListino[]; pacchetti: VocePacchetto[]; centro: Centro;
}) {
  const [uomo, setUomo] = useState(false);
  const [cerca, setCerca] = useState('');

  const gruppi = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const filtrate = q ? voci.filter(v => v.nome.toLowerCase().includes(q)) : voci;
    const mappa = new Map<string, VoceListino[]>();
    for (const v of filtrate) {
      const k = v.categoria;
      if (!mappa.has(k)) mappa.set(k, []);
      mappa.get(k)!.push(v);
    }
    return [...mappa.entries()].sort((a, b) => getCategoryLabel(a[0]).localeCompare(getCategoryLabel(b[0])));
  }, [voci, cerca]);

  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <header style={s.header}>
          <p style={s.occhiello}>Listino</p>
          <h1 style={s.titolo}>{centro.nome}</h1>
          {centro.indirizzo && <p style={s.indirizzo}>{centro.indirizzo}</p>}
        </header>

        <div style={s.controlli}>
          <div style={s.switch}>
            {[['Donna', false], ['Uomo', true]].map(([lab, val]) => (
              <button key={String(lab)} onClick={() => setUomo(val as boolean)}
                style={{ ...s.switchBtn, ...(uomo === val ? s.switchOn : {}) }}>
                {lab as string}
              </button>
            ))}
          </div>
          <input value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="Cerca un trattamento…" style={s.cerca} />
        </div>

        {gruppi.length === 0 && <p style={s.vuoto}>Nessun trattamento con questo nome.</p>}

        {gruppi.map(([categoria, lista]) => (
          <section key={categoria} style={s.sezione}>
            <h2 style={s.categoria}>{getCategoryLabel(categoria)}</h2>
            <div>
              {lista.map(v => (
                <div key={v.id} style={s.riga}>
                  <div style={{ minWidth: 0 }}>
                    <p style={s.nome}>{v.nome}</p>
                    <p style={s.minuti}>{uomo ? v.minutiUomo : v.minutiDonna} min</p>
                  </div>
                  <p style={s.prezzo}>{euro(uomo ? v.prezzoUomo : v.prezzoDonna)}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* I pacchetti: quello che conviene davvero, col risparmio scritto. */}
        {pacchetti.length > 0 && (
          <section style={s.sezione}>
            <h2 style={s.categoria}>Pacchetti</h2>
            <p style={s.introPacchetti}>
              Più sedute insieme costano meno. Si pagano una volta e si usano quando vuoi, fino a esaurimento.
            </p>
            <div>
              {pacchetti.map(p => (
                <div key={p.id} style={s.riga}>
                  <div style={{ minWidth: 0 }}>
                    <p style={s.nome}>{p.nome}</p>
                    <p style={s.minuti}>
                      {p.sedute} sedute · {euro(p.aSeduta)} a seduta
                      {p.risparmio ? <span style={s.risparmio}> · risparmi {euro(p.risparmio)}</span> : null}
                    </p>
                  </div>
                  <p style={s.prezzo}>{euro(p.prezzo)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/*
          Qui non si prenota.

          C'era il tasto che portava alla prenotazione online, ma il listino
          gira su WhatsApp e finisce a gente che non è ancora cliente: si
          riempirebbe l'agenda di appuntamenti presi senza che nessuno del
          centro ci abbia parlato. Il listino serve a far sapere quanto costa,
          punto — l'appuntamento si prende parlando con qualcuno.
        */}
        <div style={s.chiusura}>
          <p style={s.chiusuraTitolo}>Per prenotare, scrivici o passa a trovarci</p>
          <p style={s.nota}>
            I prezzi sono aggiornati a oggi. Alcuni trattamenti cambiano in base alla zona o alla durata:
            te lo diciamo prima di cominciare.
          </p>
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#faf7fb', color: '#2b1b33', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', padding: '24px 16px 48px' },
  wrap: { maxWidth: 640, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 20 },
  occhiello: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#a8823c', fontWeight: 700, margin: 0 },
  titolo: { fontSize: 32, margin: '4px 0 2px', color: '#5b2a67', fontWeight: 800 },
  indirizzo: { fontSize: 13, color: '#8b7a92', margin: 0 },
  controlli: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 },
  switch: { display: 'flex', background: '#fff', border: '1px solid #ece3ef', borderRadius: 14, padding: 4, gap: 4 },
  switchBtn: { flex: 1, padding: '10px 0', border: 'none', background: 'transparent', borderRadius: 10, fontSize: 15, fontWeight: 600, color: '#8b7a92', cursor: 'pointer' },
  switchOn: { background: '#5b2a67', color: '#fff' },
  cerca: { width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #ece3ef', fontSize: 15, background: '#fff', color: '#2b1b33', boxSizing: 'border-box' },
  sezione: { marginBottom: 26 },
  categoria: { fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: '#a8823c', fontWeight: 700, margin: '0 0 8px', paddingBottom: 6, borderBottom: '1px solid #ece3ef' },
  riga: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3edf5' },
  nome: { margin: 0, fontSize: 15, fontWeight: 600 },
  minuti: { margin: '2px 0 0', fontSize: 12, color: '#8b7a92' },
  prezzo: { margin: 0, fontSize: 16, fontWeight: 800, color: '#5b2a67', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  chiusura: { marginTop: 10, padding: '16px 14px', borderRadius: 16, background: '#fff', border: '1px solid #ece3ef', textAlign: 'center' },
  chiusuraTitolo: { margin: 0, fontSize: 15, fontWeight: 700, color: '#5b2a67' },
  introPacchetti: { fontSize: 12, color: '#8b7a92', margin: '0 0 6px', lineHeight: 1.5 },
  risparmio: { color: '#2e7d32', fontWeight: 700 },
  nota: { fontSize: 12, color: '#8b7a92', textAlign: 'center', marginTop: 8, lineHeight: 1.5, marginBottom: 0 },
  vuoto: { textAlign: 'center', color: '#8b7a92', padding: '30px 0' },
};
