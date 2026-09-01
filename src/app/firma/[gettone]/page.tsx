'use client';

/**
 * Il consenso laser, da firmare sul tablet.
 *
 * Sostituisce tre fogli fotocopiati che finivano in un raccoglitore: qui la
 * cliente legge lo stesso identico testo, risponde alle domande sullo storico
 * — sono su di lei, ed e' lei che firmando se ne assume la responsabilita' —
 * e firma col dito. Quello che resta e' nella sua scheda, con data e ora.
 *
 * Sta fuori dal gestionale apposta: e' una pagina che si mette in mano a una
 * cliente, e da qui non si deve poter arrivare all'agenda, alla cassa o alle
 * altre schede. Si apre solo con un gettone firmato che dura tre giorni.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apriModuloLaser, salvaConsensoLaser, type ModuloLaser } from '@/app/actions/consensoLaser';
import { CONSENSO_LASER, DICHIARAZIONE_FINALE, TESTO_FOTO, DOMANDE_STORICO } from '@/lib/consensoLaserTesto';

/** Il riquadro della firma: dito o pennino, niente mouse necessario. */
function Firma({ onChange }: { onChange: (dato: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const giu = useRef(false);
  const scritto = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // La tela si disegna alla risoluzione vera dello schermo, se no la firma
    // esce sgranata proprio sul tablet, che e' l'unico posto dove si usa.
    const scala = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * scala;
    c.height = r.height * scala;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(scala, scala);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const punto = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          giu.current = true; scritto.current = true;
          const ctx = ref.current!.getContext('2d')!;
          const p = punto(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={e => {
          if (!giu.current) return;
          const ctx = ref.current!.getContext('2d')!;
          const p = punto(e); ctx.lineTo(p.x, p.y); ctx.stroke();
        }}
        onPointerUp={() => {
          if (!giu.current) return;
          giu.current = false;
          if (scritto.current) onChange(ref.current!.toDataURL('image/png'));
        }}
        onPointerLeave={() => { giu.current = false; }}
        className="w-full h-44 rounded-2xl bg-white border-2 border-dashed border-gray-300 touch-none"
        style={{ touchAction: 'none' }}
      />
      <button
        type="button"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          scritto.current = false;
          onChange(null);
        }}
        className="mt-2 text-sm font-medium text-gray-500 underline"
      >
        Cancella e rifai la firma
      </button>
    </div>
  );
}

export default function PaginaFirma() {
  const { gettone } = useParams<{ gettone: string }>();
  const [modulo, setModulo] = useState<ModuloLaser | null>(null);
  const [storico, setStorico] = useState<Record<string, string>>({});
  const [zone, setZone] = useState('');
  const [foto, setFoto] = useState(false);
  const [letto, setLetto] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    apriModuloLaser(String(gettone))
      .then(m => { if (!vivo) return; setModulo(m); setZone(m.zone || ''); })
      .catch(() => { if (vivo) setModulo({ ok: false, errore: 'Non riesco ad aprire il modulo.' }); });
    return () => { vivo = false; };
  }, [gettone]);

  const rispondi = (id: string, valore: string) => setStorico(s => ({ ...s, [id]: valore }));

  const mancano = (() => {
    const m: string[] = [];
    for (const d of DOMANDE_STORICO) {
      if (d.tipo === 'conferma') { if (storico[d.id] !== 'si') m.push(d.testo); continue; }
      if (!storico[d.id]) m.push(d.testo);
    }
    if (!letto) m.push('la spunta di aver letto');
    if (!firma) m.push('la firma');
    return m;
  })();

  const salva = async () => {
    if (mancano.length > 0 || salvando || !firma) return;
    setSalvando(true);
    setErrore(null);
    const r = await salvaConsensoLaser(String(gettone), { storico, zone, consensoFoto: foto, firma })
      .catch(() => ({ ok: false, errore: 'Salvataggio non riuscito. Riprova.' }));
    setSalvando(false);
    if (r.ok) setFatto(true);
    else setErrore(r.errore || 'Salvataggio non riuscito.');
  };

  if (!modulo) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Un attimo…</div>;
  }

  if (!modulo.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-gray-900">Non si può aprire questo modulo</p>
          <p className="mt-2 text-gray-600">{modulo.errore}</p>
        </div>
      </div>
    );
  }

  if (fatto) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">✓</div>
          <p className="mt-4 text-xl font-semibold text-gray-900">Grazie, è tutto a posto</p>
          <p className="mt-2 text-gray-600">
            Il consenso è firmato e resta nella tua scheda. Puoi restituire il tablet all&apos;operatrice.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <header className="mb-6">
          <p className="text-sm tracking-[0.2em] text-amber-700 font-semibold">REVOBEAUTY</p>
          <h1 className="mt-1 text-2xl font-bold">Consenso informato</h1>
          <p className="text-gray-600">Epilazione con laser diodo defocalizzato</p>
          <div className="mt-4 rounded-2xl bg-white border border-gray-200 p-4">
            <p className="font-semibold">{modulo.nome}</p>
            {modulo.quando ? (
              <p className="text-sm text-gray-600">
                Seduta del {modulo.quando}{modulo.operatrice ? ` · ${modulo.operatrice}` : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-600">Consenso per i trattamenti di epilazione laser</p>
            )}
            {modulo.giaFirmato && (
              <p className="mt-2 text-sm text-amber-700">
                Risulta già un consenso firmato il{' '}
                {new Date(modulo.giaFirmato.quando).toLocaleDateString('it-IT')}. Firmandone uno nuovo, resta il più recente.
              </p>
            )}
          </div>
        </header>

        {/* Il testo, per intero. Si scorre: non si riassume un consenso. */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5 max-h-[50vh] overflow-y-auto">
          {CONSENSO_LASER.map((s, i) => (
            <section key={i} className={i > 0 ? 'mt-5' : ''}>
              {s.titolo && <h2 className="font-bold text-gray-900 mb-1.5">{s.titolo}</h2>}
              {s.testo?.map((t, j) => <p key={j} className="text-[15px] leading-relaxed text-gray-700 mb-2">{t}</p>)}
              {s.punti && (
                <ul className="list-disc pl-5 space-y-1.5">
                  {s.punti.map((t, j) => <li key={j} className="text-[15px] leading-relaxed text-gray-700">{t}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <h2 className="mt-8 mb-1 text-lg font-bold">Qualche domanda su di te</h2>
        <p className="text-sm text-gray-600 mb-3">Servono a capire se oggi si può fare la seduta in sicurezza.</p>

        <div className="space-y-3">
          {DOMANDE_STORICO.map(d => (
            <div key={d.id} className="rounded-2xl bg-white border border-gray-200 p-4">
              <p className="font-medium mb-3">{d.testo}</p>

              {d.tipo === 'sino' && (
                <div className="flex gap-3">
                  {['si', 'no'].map(v => (
                    <button key={v} type="button" onClick={() => rispondi(d.id, v)}
                      className={`flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-colors ${
                        storico[d.id] === v ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600'}`}>
                      {v === 'si' ? 'Sì' : 'No'}
                    </button>
                  ))}
                </div>
              )}

              {d.tipo === 'scelta' && (
                <div className="grid grid-cols-2 gap-2">
                  {d.opzioni?.map(o => (
                    <button key={o} type="button" onClick={() => rispondi(d.id, o)}
                      className={`py-3 rounded-xl border-2 text-base font-semibold transition-colors ${
                        storico[d.id] === o ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {d.tipo === 'testo' && (
                <input type="text" value={storico[d.id] || ''} onChange={e => rispondi(d.id, e.target.value)}
                  placeholder="Scrivi qui"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-base focus:outline-none focus:border-amber-600" />
              )}

              {d.tipo === 'conferma' && (
                <button type="button" onClick={() => rispondi(d.id, storico[d.id] === 'si' ? '' : 'si')}
                  className={`w-full py-3 rounded-xl border-2 text-base font-semibold transition-colors ${
                    storico[d.id] === 'si' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-600'}`}>
                  {storico[d.id] === 'si' ? '✓ Confermo' : 'Tocca per confermare'}
                </button>
              )}

              {d.dettaglioSe && storico[d.id] === d.dettaglioSe && (
                <input type="text" value={storico[`${d.id}_dettaglio`] || ''}
                  onChange={e => rispondi(`${d.id}_dettaglio`, e.target.value)}
                  placeholder={d.dettaglioEtichetta || 'Dettagli'}
                  className="mt-3 w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-base focus:outline-none focus:border-amber-600" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-white border border-gray-200 p-4">
          <p className="font-medium mb-2">Zone da trattare, concordate con l&apos;operatrice</p>
          <textarea value={zone} onChange={e => setZone(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-base focus:outline-none focus:border-amber-600" />
        </div>

        <h2 className="mt-8 mb-3 text-lg font-bold">Firma</h2>
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          {DICHIARAZIONE_FINALE.map((t, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-gray-700 mb-2">{t}</p>
          ))}

          <label className="mt-3 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={letto} onChange={e => setLetto(e.target.checked)}
              className="mt-1 w-6 h-6 accent-amber-600 flex-shrink-0" />
            <span className="text-[15px] text-gray-800">
              Ho letto e compreso tutto quanto sopra, ho potuto fare domande e <strong>acconsento</strong> al trattamento
              di fotoepilazione progressiva.
            </span>
          </label>

          {/* Le foto sono un consenso a parte: si puo' dire di no a queste e sì al trattamento. */}
          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={foto} onChange={e => setFoto(e.target.checked)}
              className="mt-1 w-6 h-6 accent-amber-600 flex-shrink-0" />
            <span className="text-[15px] text-gray-600">{TESTO_FOTO}</span>
          </label>

          <p className="mt-5 mb-2 font-medium">Firma qui sotto col dito</p>
          <Firma onChange={setFirma} />
        </div>

        {errore && <p className="mt-4 text-center font-medium text-red-600">{errore}</p>}

        {mancano.length > 0 && (
          <p className="mt-4 text-center text-sm text-amber-700">
            Manca ancora: {mancano.slice(0, 3).join(', ')}{mancano.length > 3 ? '…' : ''}
          </p>
        )}

        <button type="button" onClick={salva} disabled={mancano.length > 0 || salvando}
          className="mt-3 mb-10 w-full py-4 rounded-2xl bg-amber-600 text-white text-lg font-bold disabled:opacity-40">
          {salvando ? 'Salvo…' : 'Firma e invia'}
        </button>
      </div>
    </div>
  );
}
