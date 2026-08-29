'use client';

/**
 * Campo data del gestionale, al posto di `<input type="date">`.
 *
 * Il calendario del browser è bianco anche col tema scuro, cambia faccia su
 * ogni browser e — soprattutto — si apre sul mese corrente: per una data di
 * nascita significa tornare indietro venticinque anni una freccia alla volta.
 *
 * Qui si scrive e basta: 25082004 diventa 25/08/2004 mentre si digita, che è
 * il modo in cui la data la si detta al banco. Il calendario resta per quando
 * serve davvero (un appuntamento, "il primo martedì del mese"), con mese e
 * anno da scegliere in un colpo solo.
 *
 * Fuori esce sempre e solo il formato ISO (2004-08-25), lo stesso che usciva
 * dall'input nativo: chi lo usa non deve cambiare niente.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const GIORNI = ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do'];

const due = (n: number) => String(n).padStart(2, '0');
const iso = (a: number, m: number, g: number) => `${a}-${due(m + 1)}-${due(g)}`;

/**
 * ISO → pezzi, senza passare da `new Date`.
 *
 * `new Date('2004-08-25')` viene letto come mezzanotte UTC: in Italia d'estate
 * torna indietro di due ore e il giorno diventa il 24. Su una data di nascita
 * non se ne accorge nessuno finché non parte l'auguri sbagliato.
 */
function pezzi(v: string): { anno: number; mese: number; giorno: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  const anno = Number(m[1]), mese = Number(m[2]) - 1, giorno = Number(m[3]);
  if (mese < 0 || mese > 11 || giorno < 1 || giorno > giorniDelMese(anno, mese)) return null;
  return { anno, mese, giorno };
}

const giorniDelMese = (anno: number, mese: number) => new Date(anno, mese + 1, 0).getDate();

/** Lunedì primo: `getDay()` mette la domenica a 0 e sfalserebbe tutta la griglia. */
const offsetPrimoGiorno = (anno: number, mese: number) => (new Date(anno, mese, 1).getDay() + 6) % 7;

const daIso = (v: string) => {
  const p = pezzi(v);
  return p ? `${due(p.giorno)}/${due(p.mese + 1)}/${p.anno}` : '';
};

/** Solo cifre, al massimo otto, con le barre messe da noi mentre si scrive. */
function mascheraTesto(grezzo: string): string {
  const c = grezzo.replace(/\D/g, '').slice(0, 8);
  if (c.length <= 2) return c;
  if (c.length <= 4) return `${c.slice(0, 2)}/${c.slice(2)}`;
  return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4)}`;
}

/** gg/mm/aaaa → ISO, oppure null se quella data non esiste (il 31 febbraio). */
function testoAIso(testo: string): string | null {
  const c = testo.replace(/\D/g, '');
  if (c.length !== 8) return null;
  const giorno = Number(c.slice(0, 2)), mese = Number(c.slice(2, 4)) - 1, anno = Number(c.slice(4));
  if (mese < 0 || mese > 11 || giorno < 1 || giorno > giorniDelMese(anno, mese)) return null;
  return iso(anno, mese, giorno);
}

/**
 * L'anno scritto con due cifre: 89 → 1989, 04 → 2004.
 *
 * Al banco la data di nascita si detta cosi', «trentuno agosto ottantanove»,
 * e chi scrive batte 310889. Prima quel campo restava vuoto per il gestionale
 * — sei cifre non sono una data — con la differenza che a schermo si leggeva
 * «31/08/89», che sembra una data finita: il tasto del check-in restava
 * spento e non si capiva perche'.
 *
 * Il taglio e' due anni avanti a oggi: «27» e' il 2027 (un appuntamento
 * lontano), «30» e' il 1930 (una signora). Nessuno prenota nel 2030 e nessuno
 * e' nato nel 2027.
 */
function completaAnno(testo: string): string {
  const c = testo.replace(/\D/g, '');
  if (c.length !== 6) return testo;
  const yy = Number(c.slice(4));
  const soglia = (new Date().getFullYear() % 100) + 2;
  const anno = yy <= soglia ? 2000 + yy : 1900 + yy;
  return `${c.slice(0, 2)}/${c.slice(2, 4)}/${anno}`;
}

export default function CampoData({
  value,
  onChange,
  className = '',
  annoMin,
  annoMax,
  disabled = false,
  id,
}: {
  /** Data in formato ISO (2004-08-25), o stringa vuota. */
  value: string;
  onChange: (iso: string) => void;
  /** Classi del campo: si passano quelle già usate dagli altri input della scheda. */
  className?: string;
  /** Estremi dell'elenco anni. Di serie coprono una vita intera più due anni avanti. */
  annoMin?: number;
  annoMax?: number;
  disabled?: boolean;
  id?: string;
}) {
  const oggi = useMemo(() => new Date(), []);
  const annoOggi = oggi.getFullYear();
  const primoAnno = annoMin ?? annoOggi - 100;
  const ultimoAnno = annoMax ?? annoOggi + 2;

  const [testo, setTesto] = useState(() => daIso(value));
  const [aperto, setAperto] = useState(false);
  const [posizione, setPosizione] = useState<{ top: number; left: number; sopra: boolean } | null>(null);

  // Mese mostrato dal calendario: parte dalla data scritta, se c'è.
  const scelta = pezzi(value);
  const [vistaAnno, setVistaAnno] = useState(scelta?.anno ?? annoOggi);
  const [vistaMese, setVistaMese] = useState(scelta?.mese ?? oggi.getMonth());

  const campoRef = useRef<HTMLDivElement>(null);
  const pannelloRef = useRef<HTMLDivElement>(null);

  // Se la data cambia da fuori (si apre la scheda di un'altra cliente) il testo
  // deve seguirla — ma non mentre si sta scrivendo, o cancellerebbe la digitazione.
  useEffect(() => {
    setTesto(prev => (testoAIso(prev) === value ? prev : daIso(value)));
  }, [value]);

  const collocaPannello = useCallback(() => {
    const r = campoRef.current?.getBoundingClientRect();
    if (!r) return;
    const ALTEZZA = 340;
    // Sotto se ci sta, sopra se no: dentro una scheda lunga il campo finisce in
    // fondo allo schermo e il calendario resterebbe mezzo fuori.
    const sopra = r.bottom + ALTEZZA > window.innerHeight && r.top > ALTEZZA;
    setPosizione({
      top: sopra ? r.top - 8 : r.bottom + 8,
      // Mai piu' a sinistra di 8px e mai oltre il bordo destro: su uno schermo
      // sotto i 300px il vecchio calcolo (innerWidth - 300) diventava negativo
      // e il calendario partiva fuori dallo schermo.
      left: Math.max(8, Math.min(r.left, window.innerWidth - 288)),
      sopra,
    });
  }, []);

  useLayoutEffect(() => {
    if (!aperto) return;
    collocaPannello();
    // Il campo può stare in un pannello che scorre: il calendario deve seguirlo.
    window.addEventListener('scroll', collocaPannello, true);
    window.addEventListener('resize', collocaPannello);
    return () => {
      window.removeEventListener('scroll', collocaPannello, true);
      window.removeEventListener('resize', collocaPannello);
    };
  }, [aperto, collocaPannello]);

  useEffect(() => {
    if (!aperto) return;
    const fuori = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!campoRef.current?.contains(t) && !pannelloRef.current?.contains(t)) setAperto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('mousedown', fuori);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuori);
      document.removeEventListener('keydown', esc);
    };
  }, [aperto]);

  const apri = () => {
    if (disabled) return;
    const p = pezzi(value);
    if (p) { setVistaAnno(p.anno); setVistaMese(p.mese); }
    setAperto(v => !v);
  };

  /**
   * Uscendo dal campo si sistema quello che si puo' e si dice cosa non va.
   *
   * Completare l'anno mentre si scrive sarebbe peggio del problema: chi sta
   * battendo «31/08/1989» al sesto carattere si vedrebbe riscrivere il campo
   * sotto le dita.
   */
  const [toccato, setToccato] = useState(false);
  const esci = () => {
    setToccato(true);
    const completo = completaAnno(testo);
    if (completo !== testo) {
      setTesto(completo);
      const nuovo = testoAIso(completo);
      if (nuovo) {
        onChange(nuovo);
        const p = pezzi(nuovo)!;
        setVistaAnno(p.anno);
        setVistaMese(p.mese);
      }
    }
  };

  const scriviTesto = (grezzo: string) => {
    const t = mascheraTesto(grezzo);
    setTesto(t);
    const nuovo = testoAIso(t);
    if (nuovo) {
      onChange(nuovo);
      const p = pezzi(nuovo)!;
      setVistaAnno(p.anno);
      setVistaMese(p.mese);
    } else if (t === '') {
      onChange('');
    }
  };

  const scegli = (anno: number, mese: number, giorno: number) => {
    const v = iso(anno, mese, giorno);
    onChange(v);
    setTesto(daIso(v));
    setAperto(false);
  };

  const cambiaMese = (delta: number) => {
    const d = new Date(vistaAnno, vistaMese + delta, 1);
    setVistaAnno(d.getFullYear());
    setVistaMese(d.getMonth());
  };

  // Sei righe fisse: se cambiassero da mese a mese il calendario ballerebbe.
  const celle = useMemo(() => {
    const offset = offsetPrimoGiorno(vistaAnno, vistaMese);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(vistaAnno, vistaMese, i - offset + 1);
      return { anno: d.getFullYear(), mese: d.getMonth(), giorno: d.getDate() };
    });
  }, [vistaAnno, vistaMese]);

  const anni = useMemo(
    () => Array.from({ length: ultimoAnno - primoAnno + 1 }, (_, i) => ultimoAnno - i),
    [primoAnno, ultimoAnno]
  );

  const isoOggi = iso(annoOggi, oggi.getMonth(), oggi.getDate());
  const cifre = testo.replace(/\D/g, '').length;
  // Rosso solo quando c'e' qualcosa che non va davvero: una data impossibile,
  // o una lasciata a meta' dopo essere usciti dal campo.
  const incompleto = (cifre === 8 && !testoAIso(testo)) || (toccato && cifre > 0 && cifre < 8 && !testoAIso(completaAnno(testo)));

  return (
    <div ref={campoRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={testo}
        disabled={disabled}
        placeholder="gg/mm/aaaa"
        onChange={e => { setToccato(false); scriviTesto(e.target.value); }}
        onBlur={esci}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); esci(); setAperto(false); } }}
        className={`${className} pr-10 ${incompleto ? 'border-error/60' : ''}`}
      />
      {incompleto && (
        <p className="mt-1 text-[11px] font-medium text-error">Data non completa: scrivila come 31/08/1989.</p>
      )}
      <button
        type="button"
        onClick={apri}
        disabled={disabled}
        title="Apri il calendario"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover transition-colors disabled:opacity-40"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {aperto && posizione && createPortal(
        <div
          ref={pannelloRef}
          style={{
            position: 'fixed',
            top: posizione.top,
            left: posizione.left,
            transform: posizione.sopra ? 'translateY(-100%)' : undefined,
          }}
          // Sopra al velo delle schede (z-60/61), o resterebbe sotto.
          className="z-[80] w-[280px] max-w-[calc(100vw-1rem)] rounded-2xl bg-bg-secondary border border-border shadow-2xl p-3 animate-scale-in"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <button type="button" onClick={() => cambiaMese(-1)} title="Mese precedente"
              className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary">
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Mese e anno si scelgono, non si scorrono: è la differenza fra
                due clic e trenta per una data di nascita. */}
            <select value={vistaMese} onChange={e => setVistaMese(Number(e.target.value))}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs font-medium text-text-primary capitalize focus:outline-none focus:border-accent/50">
              {MESI.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={vistaAnno} onChange={e => setVistaAnno(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs font-medium text-text-primary focus:outline-none focus:border-accent/50">
              {anni.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            <button type="button" onClick={() => cambiaMese(1)} title="Mese successivo"
              className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {GIORNI.map(g => (
              <span key={g} className="text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted py-1">{g}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {celle.map(c => {
              const v = iso(c.anno, c.mese, c.giorno);
              const altroMese = c.mese !== vistaMese;
              const selezionato = v === value;
              const eOggi = v === isoOggi;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => scegli(c.anno, c.mese, c.giorno)}
                  className={`h-8 rounded-lg text-xs transition-colors ${
                    selezionato
                      ? 'bg-accent text-white font-semibold'
                      : altroMese
                        ? 'text-text-muted/40 hover:bg-bg-hover hover:text-text-secondary'
                        : 'text-text-primary hover:bg-bg-hover'
                  } ${eOggi && !selezionato ? 'ring-1 ring-accent/50 font-semibold text-accent' : ''}`}
                >
                  {c.giorno}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
            <button type="button" onClick={() => { onChange(''); setTesto(''); setAperto(false); }}
              className="text-[11px] text-text-muted hover:text-error px-1.5 py-1 rounded">
              Cancella
            </button>
            <button type="button" onClick={() => scegli(annoOggi, oggi.getMonth(), oggi.getDate())}
              className="text-[11px] font-medium text-accent hover:underline px-1.5 py-1 rounded">
              Oggi
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
