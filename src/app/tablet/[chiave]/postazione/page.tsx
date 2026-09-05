'use client';

/**
 * La postazione: la schermata unica del tablet del centro.
 *
 * Tre stati, uno per volta, mai mescolati.
 *
 *  - APERTA: nessuno l'ha in mano. Si vede il nome del centro e l'ora, e non
 *    c'e' niente da premere se non «sono un'operatrice». E' lo stato in cui il
 *    tablet passa la maggior parte della giornata, appoggiato al banco.
 *  - OPERATRICE: si entra con le proprie credenziali. Si vede chi c'e' oggi e
 *    si sceglie a chi passare il tablet.
 *  - CLIENTE: il tablet e' in mano alla persona, e da qui non si torna
 *    indietro senza rifare l'accesso. Niente ricerca, niente elenchi, niente
 *    scheda di nessun altro.
 *
 * Il tempo di inattivita' chiude la sessione della cliente e riporta alla
 * schermata iniziale. Avvisa dieci secondi prima invece di sparire di colpo:
 * una persona che sta leggendo un consenso non deve vedersi cancellare tutto
 * senza capire perche'.
 */

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import {
  statoPostazione, entraComeOperatrice, passaAllaCliente, chiudiPostazione,
  appuntamentiDiOggi, cercaClienteDaTablet, mieiConsensi, firmaConsensoDalTablet,
  type StatoPostazione, type RigaOggi, type RigaCliente,
} from '@/app/actions/postazione';
import type { DocumentoDaLeggere } from '@/app/actions/consensiVersionati';
import FirmaGrafica from '@/components/FirmaGrafica';

/** Dopo quanti secondi di immobilita' si avvisa, prima di chiudere. */
const PREAVVISO_S = 10;

/**
 * L'orologio, come sorgente esterna.
 *
 * L'ora non e' uno stato della pagina: e' una cosa che sta fuori e cambia da
 * sola. Chiedendola cosi' non serve scrivere uno stato a ogni minuto — e
 * durante il disegno della pagina non si chiama niente di impuro, che sul
 * server darebbe un'ora diversa da quella del tablet.
 */
function Orologio() {
  const ora = useSyncExternalStore(
    cb => { const t = setInterval(cb, 20_000); return () => clearInterval(t); },
    () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    () => '',
  );
  return <p style={s.ora}>{ora}</p>;
}

export default function Postazione() {
  const { chiave } = useParams<{ chiave: string }>();
  const [stato, setStato] = useState<StatoPostazione | null>(null);

  const aggiornaStato = useCallback(async () => {
    try { setStato(await statoPostazione(String(chiave))); } catch { /* rete: si riprova */ }
  }, [chiave]);

  useEffect(() => {
    // La prima domanda parte fuori dal disegno della pagina: dentro l'effetto
    // si mette in coda e basta, cosi' non innesca un secondo render immediato.
    const t = setTimeout(() => { void aggiornaStato(); }, 0);
    return () => clearTimeout(t);
  }, [aggiornaStato]);

  if (!stato) return <main style={s.pagina}><p style={s.attesa}>Un attimo…</p></main>;

  if (!stato.autorizzata) {
    return (
      <main style={s.pagina}>
        <div style={s.centro}>
          <div style={s.cerchio}><span style={{ fontSize: 40 }}>🔒</span></div>
          <h1 style={s.titolo}>Dispositivo non collegato</h1>
          <p style={s.sotto}>
            Questo tablet non risulta fra quelli del centro. Il collegamento si fa dal gestionale,
            in Impostazioni → Tablet.
          </p>
        </div>
      </main>
    );
  }

  if (stato.modalita === 'cliente') {
    return <ModoCliente stato={stato} onFine={aggiornaStato} />;
  }

  if (stato.modalita === 'operatrice') {
    return <ModoOperatrice chiave={String(chiave)} stato={stato} onCambio={aggiornaStato} />;
  }

  return <ModoAperto chiave={String(chiave)} onEntrata={aggiornaStato} />;
}

/* ============================================================
   Aperta: il tablet appoggiato al banco.
   ============================================================ */
function ModoAperto({ chiave, onEntrata }: { chiave: string; onEntrata: () => void }) {
  const [apri, setApri] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [occupato, setOccupato] = useState(false);

  const entra = async () => {
    setOccupato(true);
    setErrore('');
    try {
      const r = await entraComeOperatrice(chiave, email, password);
      if (!r.ok) { setErrore(r.errore || 'Non sono riuscito a farti entrare.'); return; }
      setEmail(''); setPassword(''); setApri(false);
      onEntrata();
    } catch {
      setErrore('Errore di rete: riprova.');
    } finally { setOccupato(false); }
  };

  return (
    <main style={s.pagina}>
      <div style={s.centro}>
        <div style={s.cerchio}><span style={{ fontSize: 44 }}>✨</span></div>
        <h1 style={s.titolo}>RevoBeauty</h1>
        <p style={s.sotto}>Postazione del centro</p>

        {!apri ? (
          <button onClick={() => setApri(true)} style={s.bottoneGrande}>Sono un&apos;operatrice</button>
        ) : (
          <div style={s.scheda}>
            {/*
              L'accesso e' quello vero, con le credenziali della persona.
              Nessuna scorciatoia nascosta: un tasto segreto su un tablet che
              gira in sala d'attesa lo trova qualcuno in pochi giorni.
            */}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="La tua email" autoComplete="off" style={s.campo} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void entra(); }}
              placeholder="Password" autoComplete="off" style={s.campo} />
            {errore && <p style={s.errore}>{errore}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setApri(false); setErrore(''); }} style={{ ...s.bottoneChiaro, flex: 1 }}>Annulla</button>
              <button onClick={() => void entra()} disabled={occupato || !email.trim() || !password}
                style={{ ...s.bottoneGrande, flex: 2, opacity: occupato || !email.trim() || !password ? 0.5 : 1 }}>
                {occupato ? 'Un attimo…' : 'Entra'}
              </button>
            </div>
          </div>
        )}
      </div>
      <Orologio />
    </main>
  );
}

/* ============================================================
   Operatrice: chi c'e' oggi, e a chi passo il tablet.
   ============================================================ */
function ModoOperatrice({ chiave, stato, onCambio }: {
  chiave: string; stato: StatoPostazione; onCambio: () => void;
}) {
  const [oggi, setOggi] = useState<RigaOggi[] | null>(null);
  const [cerca, setCerca] = useState('');
  const [trovate, setTrovate] = useState<RigaCliente[]>([]);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    appuntamentiDiOggi().then(setOggi).catch(() => setOggi([]));
  }, []);

  useEffect(() => {
    if (cerca.trim().length < 2) return;
    let vivo = true;
    // Un quarto di secondo di pausa: al banco si scrive lettera per lettera e
    // ogni lettera sarebbe una domanda al server.
    const t = setTimeout(() => {
      cercaClienteDaTablet(cerca).then(r => { if (vivo) setTrovate(r); }).catch(() => {});
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [cerca]);

  const passa = async (clientId: string, appointmentId?: string) => {
    setErrore('');
    const r = await passaAllaCliente({ chiave, clientId, appointmentId });
    if (!r.ok) { setErrore(r.errore || 'Non sono riuscito a passare il tablet.'); return; }
    onCambio();
  };

  const esci = async () => { await chiudiPostazione(); onCambio(); };

  return (
    <main style={{ ...s.pagina, justifyContent: 'flex-start', paddingTop: 24 }}>
      <div style={s.colonna}>
        <div style={s.barra}>
          <div style={{ minWidth: 0 }}>
            <p style={s.barraTitolo}>{stato.operatrice || 'Operatrice'}</p>
            <p style={s.barraSotto}>Postazione del centro</p>
          </div>
          <button onClick={() => void esci()} style={s.bottoneChiaro}>Esci</button>
        </div>

        <p style={s.sezione}>Chi c&apos;è oggi</p>
        {oggi === null && <p style={s.attesa}>Carico gli appuntamenti…</p>}
        {oggi?.length === 0 && <p style={s.vuoto}>Nessun appuntamento oggi.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(oggi || []).map(a => (
            <button key={a.appointmentId} onClick={() => void passa(a.clientId, a.appointmentId)} style={s.riga}>
              <span style={s.rigaOra}>{a.ora}</span>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={s.rigaNome}>{a.cliente}</span>
                <span style={s.rigaSotto}>{a.trattamento} · {a.operatrice}</span>
              </span>
              <span style={a.giaDentro ? s.pillaVerde : s.pilla}>
                {a.giaDentro ? 'in cabina' : 'passa il tablet'}
              </span>
            </button>
          ))}
        </div>

        <p style={s.sezione}>Oppure cerca</p>
        <input value={cerca}
          onChange={e => {
            setCerca(e.target.value);
            // Si svuota qui e non dentro l'effetto: cancellando la ricerca i
            // nomi devono sparire subito, prima ancora di chiedere al server.
            if (e.target.value.trim().length < 2) setTrovate([]);
          }}
          placeholder="Nome, cognome o numero" autoComplete="off" style={s.campo} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {trovate.map(c => (
            <button key={c.clientId} onClick={() => void passa(c.clientId)} style={s.riga}>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span style={s.rigaNome}>{c.nome}</span>
                <span style={s.rigaSotto}>numero che finisce con {c.telefonoCoda || '—'}</span>
              </span>
              <span style={s.pilla}>passa il tablet</span>
            </button>
          ))}
        </div>

        {errore && <p style={s.errore}>{errore}</p>}
      </div>
    </main>
  );
}

/* ============================================================
   Cliente: solo le sue cose, e un tempo che scorre.
   ============================================================ */
function ModoCliente({ stato, onFine }: { stato: StatoPostazione; onFine: () => void }) {
  const [restano, setRestano] = useState(stato.timeoutMinuti * 60);
  /*
    I documenti che mancano a LEI.

    Arrivano da un'azione che non accetta nessun id: legge la sessione e da
    li' sa di chi si tratta. La stessa pagina, aperta da un'altra cliente
    cinque minuti dopo, vede i documenti dell'altra e non puo' vedere questi.
  */
  const [daFirmare, setDaFirmare] = useState<DocumentoDaLeggere[] | null>(null);
  const [aperto, setAperto] = useState<DocumentoDaLeggere | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);
  // Si riempie al primo battito dell'intervallo: `Date.now()` mentre la
  // pagina si disegna e' una lettura del mondo esterno, e sul server darebbe
  // un istante diverso da quello del tablet.
  const ultimoTocco = useRef<number | null>(null);

  const finisci = useCallback(async () => {
    await chiudiPostazione().catch(() => {});
    /*
      Lo stato locale si butta davvero.

      Il cookie e' gia' sparito, ma la pagina resta aperta con dentro quello
      che la persona ha scritto: ricaricare e' l'unico modo pulito per non
      lasciare niente in memoria ne' nella cronologia del browser.
    */
    try { sessionStorage.clear(); } catch { /* niente da pulire */ }
    onFine();
    window.location.reload();
  }, [onFine]);

  const caricaConsensi = useCallback(() => {
    mieiConsensi()
      .then(r => setDaFirmare(r.documenti.filter(d => !d.giaScelto)))
      .catch(() => setDaFirmare([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(caricaConsensi, 0);
    return () => clearTimeout(t);
  }, [caricaConsensi]);

  // Ogni tocco rimette il contatore all'inizio.
  useEffect(() => {
    const tocca = () => { ultimoTocco.current = Date.now(); };
    tocca();
    for (const e of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(e, tocca, { passive: true });
    return () => { for (const e of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(e, tocca); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (ultimoTocco.current === null) ultimoTocco.current = Date.now();
      const passati = Math.floor((Date.now() - ultimoTocco.current) / 1000);
      const r = stato.timeoutMinuti * 60 - passati;
      setRestano(r);
      if (r <= 0) void finisci();
    }, 1000);
    return () => clearInterval(t);
  }, [stato.timeoutMinuti, finisci]);

  const nome = (stato.cliente || '').split(' ')[0];

  if (aperto) {
    return (
      <LeggiEFirma
        documento={aperto}
        onFatto={ricevuta => {
          setAperto(null);
          setFatto(ricevuta);
          caricaConsensi();
        }}
        onIndietro={() => setAperto(null)}
      />
    );
  }

  return (
    <main style={s.pagina}>
      <div style={s.centro}>
        <div style={s.cerchio}><span style={{ fontSize: 40 }}>👋</span></div>
        <h1 style={s.titolo}>Ciao {nome}</h1>
        <p style={s.sotto}>Questo tablet è tuo per qualche minuto.</p>

        {fatto && (
          <p style={s.conferma}>
            Fatto. La tua ricevuta è <b>{fatto}</b>: se ti serve una copia, chiedila in centro.
          </p>
        )}

        {/*
          Le cose da fare arrivano una fase alla volta. Quelle collegate
          davvero si vedono; le altre non si mettono a schermo, perche' un
          tasto che non fa niente in mano a una cliente e' peggio di un tasto
          che non c'e'.
        */}
        {daFirmare === null ? (
          <p style={s.nota}>Un attimo…</p>
        ) : daFirmare.length > 0 ? (
          <>
            <p style={s.nota}>
              Prima di cominciare ci sono {daFirmare.length === 1 ? 'un documento da leggere' : `${daFirmare.length} documenti da leggere`}.
            </p>
            <button onClick={() => setAperto(daFirmare[0])} style={s.bottoneGrande}>
              Leggi e firma
            </button>
          </>
        ) : (
          <p style={s.nota}>
            Non c&apos;è niente da firmare: è tutto a posto. Passa pure il tablet all&apos;operatrice.
          </p>
        )}

        <button onClick={() => void finisci()} style={daFirmare && daFirmare.length > 0 ? s.bottoneChiaro : s.bottoneGrande}>
          Ho finito
        </button>

        {restano <= PREAVVISO_S && (
          <p style={s.avviso}>
            Nessuno tocca lo schermo da un po&apos;: fra {Math.max(0, restano)} second{restano === 1 ? 'o' : 'i'} torno alla schermata iniziale.
          </p>
        )}
      </div>
    </main>
  );
}

/* ============================================================
   Un documento alla volta: si legge, si sceglie, si firma.
   ============================================================ */
function LeggiEFirma({ documento, onFatto, onIndietro }: {
  documento: DocumentoDaLeggere;
  onFatto: (ricevuta: string) => void;
  onIndietro: () => void;
}) {
  const [firma, setFirma] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState('');
  /*
    Il tasto si accende solo dopo aver scorso il testo fino in fondo.

    Non e' un vezzo: un consenso accettato senza averlo aperto e' esattamente
    quello che rende inutile tutto il resto. Non impedisce di firmare senza
    leggere davvero — nessun software puo' — ma toglie il caso in cui si
    accetta senza nemmeno sapere che c'era del testo.
  */
  const [lettoFino, setLettoFino] = useState(false);

  const scegli = async (scelta: 'accettato' | 'rifiutato') => {
    setOccupato(true);
    setErrore('');
    try {
      const r = await firmaConsensoDalTablet({ documentoId: documento.id, scelta, firma: firma || undefined });
      if (!r.ok) { setErrore(r.errore || 'Non sono riuscito a salvare.'); return; }
      onFatto(r.ricevuta || '');
    } catch {
      setErrore('Errore di rete: riprova.');
    } finally { setOccupato(false); }
  };

  const serveFirma = documento.firmaRichiesta;

  return (
    <main style={{ ...s.pagina, justifyContent: 'flex-start', paddingTop: 20 }}>
      <div style={s.colonna}>
        <div style={s.barra}>
          <div style={{ minWidth: 0 }}>
            <p style={s.barraTitolo}>{documento.titolo}</p>
            <p style={s.barraSotto}>
              versione del {documento.versione.slice(0, 10).split('-').reverse().join('/')}
              {documento.necessario ? ' · necessario per il servizio' : ' · facoltativo'}
            </p>
          </div>
          <button onClick={onIndietro} style={s.bottoneChiaro}>Indietro</button>
        </div>

        <div
          onScroll={e => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setLettoFino(true);
          }}
          style={s.testo}
        >
          {documento.testo.split('\n\n').map((par, i) => (
            <p key={i} style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: 16 }}>{par}</p>
          ))}
        </div>

        {!lettoFino && <p style={s.notaPiccola}>Scorri il testo fino in fondo per continuare.</p>}

        {serveFirma && lettoFino && (
          <div style={{ background: '#fff', border: '1px solid #ece6f4', borderRadius: 16, padding: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Firma qui sotto</p>
            <FirmaGrafica onChange={setFirma} />
          </div>
        )}

        {errore && <p style={s.errore}>{errore}</p>}

        {/*
          Rifiutare e' una risposta, non un errore: sta accanto ad accettare,
          scritta uguale. Un modulo che si puo' solo accettare non raccoglie un
          consenso, raccoglie una firma.
        */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => void scegli('rifiutato')} disabled={occupato || !lettoFino}
            style={{ ...s.bottoneChiaro, flex: 1, opacity: occupato || !lettoFino ? 0.5 : 1 }}>
            Non acconsento
          </button>
          <button onClick={() => void scegli('accettato')}
            disabled={occupato || !lettoFino || (serveFirma && !firma)}
            style={{ ...s.bottoneGrande, flex: 2, marginTop: 0, opacity: occupato || !lettoFino || (serveFirma && !firma) ? 0.5 : 1 }}>
            {occupato ? 'Un attimo…' : serveFirma ? 'Firmo e acconsento' : 'Acconsento'}
          </button>
        </div>
        {serveFirma && lettoFino && !firma && (
          <p style={s.notaPiccola}>Per acconsentire serve la firma qui sopra.</p>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  pagina: {
    minHeight: '100vh', margin: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 28, padding: '24px 18px 40px',
    background: 'linear-gradient(180deg,#faf7fd 0%,#f1e8fa 100%)',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    color: '#241f2b', boxSizing: 'border-box',
  },
  centro: { textAlign: 'center', maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  colonna: { width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 },
  cerchio: {
    width: 96, height: 96, borderRadius: '50%', background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 30px rgba(168,85,247,.18)',
  },
  titolo: { fontSize: 30, margin: 0, fontWeight: 700 },
  sotto: { fontSize: 17, color: '#7c7488', margin: 0 },
  nota: { fontSize: 15, color: '#8b8394', margin: '4px 0 0', lineHeight: 1.5 },
  attesa: { fontSize: 16, color: '#8b8394' },
  vuoto: { fontSize: 15, color: '#8b8394', padding: '10px 2px' },
  ora: { fontSize: 15, color: '#a79fb3', margin: 0 },
  scheda: { width: '100%', background: '#fff', border: '1px solid #ece6f4', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 },
  campo: {
    width: '100%', boxSizing: 'border-box', padding: '15px 16px', borderRadius: 14,
    border: '1px solid #ddd4ea', fontSize: 17, outline: 'none', background: '#fff',
  },
  bottoneGrande: {
    width: '100%', boxSizing: 'border-box', padding: '17px 22px', borderRadius: 16, border: 'none',
    background: 'linear-gradient(90deg,#A855F7,#EC4899)', color: '#fff', fontWeight: 700,
    fontSize: 17, cursor: 'pointer', marginTop: 6,
  },
  bottoneChiaro: {
    padding: '13px 18px', borderRadius: 14, border: '1px solid #ddd4ea',
    background: '#fff', color: '#5f5870', fontWeight: 600, fontSize: 15, cursor: 'pointer',
  },
  barra: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', border: '1px solid #ece6f4', borderRadius: 16, padding: '12px 14px' },
  barraTitolo: { margin: 0, fontSize: 17, fontWeight: 700 },
  barraSotto: { margin: 0, fontSize: 12, color: '#8b8394' },
  sezione: { fontSize: 12, textTransform: 'uppercase', letterSpacing: .7, color: '#9a94a3', margin: '14px 0 2px' },
  riga: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    background: '#fff', border: '1px solid #ece6f4', borderRadius: 16, padding: '14px 15px', cursor: 'pointer',
  },
  rigaOra: { fontSize: 16, fontWeight: 700, minWidth: 52 },
  rigaNome: { display: 'block', fontSize: 16, fontWeight: 600 },
  rigaSotto: { display: 'block', fontSize: 12.5, color: '#8b8394' },
  pilla: { fontSize: 12, fontWeight: 700, color: '#A855F7', background: '#f6edfe', borderRadius: 999, padding: '7px 11px', flexShrink: 0 },
  pillaVerde: { fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', borderRadius: 999, padding: '7px 11px', flexShrink: 0 },
  errore: { color: '#dc2626', fontSize: 14, margin: '6px 0 0' },
  testo: {
    background: '#fff', border: '1px solid #ece6f4', borderRadius: 16, padding: '18px 20px',
    maxHeight: '52vh', overflowY: 'auto', color: '#332c3d',
  },
  notaPiccola: { fontSize: 13, color: '#8b8394', margin: 0 },
  conferma: {
    background: '#dcfce7', color: '#166534', borderRadius: 12, padding: '10px 14px',
    fontSize: 14, margin: 0,
  },
  avviso: { color: '#b45309', background: '#fef3c7', borderRadius: 12, padding: '10px 14px', fontSize: 14, margin: '10px 0 0' },
};
