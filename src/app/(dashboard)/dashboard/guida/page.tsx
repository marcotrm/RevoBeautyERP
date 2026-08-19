'use client';

/**
 * La guida: tutte le funzioni del gestionale, spiegate.
 *
 * Non è un manuale da leggere dall'inizio alla fine — nessuno lo farebbe. È
 * fatta per essere CERCATA mentre si ha una cliente davanti: si scrive
 * "sconto" o "disdetta" e si trova il pezzo, con i passi e la trappola.
 *
 * Le voci col fulmine sono quelle che il gestionale fa da solo: sono le più
 * importanti da conoscere proprio perché nessuno le preme, e quindi nessuno
 * scopre che esistono.
 */

import React, { useMemo, useState } from 'react';
import { BookOpen, Search, X, Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { GUIDA, testoCercabile, type VoceGuida } from '@/lib/guida';

function Voce({ v, aperta, onApri }: { v: VoceGuida; aperta: boolean; onApri: () => void }) {
  return (
    <div className={`rounded-2xl border transition-colors ${aperta ? 'border-accent/40 bg-bg-secondary' : 'border-border bg-bg-secondary/60 hover:border-border-light'}`}>
      <button onClick={onApri} className="w-full flex items-start gap-3 text-left p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary flex items-center gap-2 flex-wrap">
            {v.titolo}
            {v.automatico && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent"
                title="Succede da solo: nessuno deve premere niente">
                <Zap className="w-2.5 h-2.5" /> DA SOLO
              </span>
            )}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">{v.dove}</p>
          {!aperta && <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{v.aCosaServe}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 mt-0.5 transition-transform ${aperta ? 'rotate-180' : ''}`} />
      </button>

      {aperta && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-text-secondary">{v.aCosaServe}</p>

          {v.comeSiFa.length > 0 && (
            <ol className="space-y-1.5">
              {v.comeSiFa.map((passo, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-text-primary">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bg-tertiary text-text-muted text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{passo}</span>
                </li>
              ))}
            </ol>
          )}

          {v.attenzione && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/30">
              <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary">{v.attenzione}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GuidaPage() {
  const [cerca, setCerca] = useState('');
  const [aperta, setAperta] = useState<string | null>(null);
  const [soloAutomatiche, setSoloAutomatiche] = useState(false);

  const aree = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return GUIDA
      .map(a => ({
        ...a,
        voci: a.voci.filter(v =>
          (!soloAutomatiche || v.automatico) && (!q || testoCercabile(v).includes(q)),
        ),
      }))
      .filter(a => a.voci.length > 0);
  }, [cerca, soloAutomatiche]);

  const quante = aree.reduce((s, a) => s + a.voci.length, 0);
  const totali = GUIDA.reduce((s, a) => s + a.voci.length, 0);
  const automatiche = GUIDA.reduce((s, a) => s + a.voci.filter(v => v.automatico).length, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-accent" /> Guida
        </h2>
        <p className="text-text-secondary mt-1">
          {totali} funzioni del gestionale, con i passi per usarle. {automatiche} il gestionale le fa da solo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={cerca} onChange={e => setCerca(e.target.value)} autoFocus
            placeholder="Cerca: sconto, disdetta, recensione, pacchetto…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
          {cerca && (
            <button onClick={() => setCerca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={() => setSoloAutomatiche(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
            soloAutomatiche ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover'}`}>
          <Zap className="w-3.5 h-3.5" /> Solo quelle automatiche
        </button>
      </div>

      {cerca && (
        <p className="text-xs text-text-muted">
          {quante === 0 ? 'Niente con questa parola. Prova con una parola sola, tipo “acconto”.' : `${quante} risultat${quante === 1 ? 'o' : 'i'}`}
        </p>
      )}

      {aree.map(area => (
        <section key={area.id} className="space-y-2.5">
          <div className="pt-1">
            <h3 className="text-base font-display font-semibold text-text-primary">{area.titolo}</h3>
            <p className="text-[11px] text-text-muted">{area.sottotitolo}</p>
          </div>
          {area.voci.map((v, i) => {
            const chiave = `${area.id}:${i}:${v.titolo}`;
            return (
              <Voce key={chiave} v={v} aperta={aperta === chiave}
                onApri={() => setAperta(aperta === chiave ? null : chiave)} />
            );
          })}
        </section>
      ))}

      {GUIDA.length === 0 && (
        <p className="text-sm text-text-muted">La guida è in preparazione.</p>
      )}
    </div>
  );
}
