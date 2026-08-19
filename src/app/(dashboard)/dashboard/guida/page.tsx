'use client';

/**
 * La guida: tutte le funzioni del gestionale, spiegate.
 *
 * Prima versione: 220 riquadri identici uno sotto l'altro. Sbagliata — davanti
 * a un muro così non si cerca, si scappa. Qui si entra da sette porte grandi
 * (una per area), dentro c'è l'elenco corto dei titoli a sinistra e la
 * spiegazione a destra, come in un manuale vero.
 *
 * La ricerca resta sopra a tutto e scavalca le porte: chi sa già cosa cerca
 * scrive "acconto" e va dritto.
 *
 * Le voci col fulmine sono quelle che il gestionale fa da solo: sono le più
 * importanti da conoscere proprio perché nessuno le preme, e quindi nessuno
 * scopre che esistono.
 */

import React, { useMemo, useState } from 'react';
import {
  BookOpen, Search, X, Zap, AlertTriangle, ChevronRight, ArrowLeft,
  Calendar, Users, ShoppingBag, Package, MessageSquare, Megaphone, UserCog,
} from 'lucide-react';
import { GUIDA, testoCercabile, type VoceGuida } from '@/lib/guida';

/**
 * Ogni area ha la sua faccia. Le classi sono scritte per intero e non
 * composte a pezzi: Tailwind le tiene solo se le legge così com'è.
 */
const STILE: Record<string, { icona: typeof Calendar; chip: string; punto: string; bordo: string }> = {
  agenda: { icona: Calendar, chip: 'bg-accent/10 text-accent', punto: 'bg-accent', bordo: 'hover:border-accent/50' },
  clienti: { icona: Users, chip: 'bg-pink-500/10 text-pink-400', punto: 'bg-pink-500', bordo: 'hover:border-pink-500/50' },
  cassa: { icona: ShoppingBag, chip: 'bg-success/10 text-success', punto: 'bg-success', bordo: 'hover:border-success/50' },
  magazzino: { icona: Package, chip: 'bg-warning/10 text-warning', punto: 'bg-warning', bordo: 'hover:border-warning/50' },
  whatsapp: { icona: MessageSquare, chip: 'bg-green-500/10 text-green-400', punto: 'bg-green-500', bordo: 'hover:border-green-500/50' },
  marketing: { icona: Megaphone, chip: 'bg-blue-500/10 text-blue-400', punto: 'bg-blue-500', bordo: 'hover:border-blue-500/50' },
  gestione: { icona: UserCog, chip: 'bg-indigo-500/10 text-indigo-400', punto: 'bg-indigo-500', bordo: 'hover:border-indigo-500/50' },
};

const stileDi = (id: string) => STILE[id] ?? STILE.gestione;

/** La spiegazione aperta: quello per cui si è venuti qui. */
function Spiegazione({ v, areaId, senzaTitolo = false }: { v: VoceGuida; areaId: string; senzaTitolo?: boolean }) {
  const st = stileDi(areaId);
  return (
    <div className="space-y-4">
      {/* Nei risultati della ricerca il titolo è già sopra, nella riga che si
          è cliccata: ripeterlo fa sembrare che si sia aperta un'altra cosa. */}
      <div className={senzaTitolo ? 'hidden' : ''}>
        <p className="text-lg font-display font-semibold text-text-primary flex items-start gap-2 flex-wrap">
          {v.titolo}
          {v.automatico && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-full bg-accent/15 text-accent mt-1"
              title="Succede da solo: nessuno deve premere niente">
              <Zap className="w-2.5 h-2.5" /> LO FA DA SOLO
            </span>
          )}
        </p>
        <p className={`inline-block mt-2 text-[11px] px-2 py-1 rounded-lg ${st.chip}`}>{v.dove}</p>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">{v.aCosaServe}</p>

      {v.comeSiFa.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Come si fa</p>
          <ol className="space-y-2">
            {v.comeSiFa.map((passo, i) => (
              <li key={i} className="flex gap-3 text-sm text-text-primary">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-bg-tertiary text-text-muted text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="min-w-0 leading-relaxed">{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {v.attenzione && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">{v.attenzione}</p>
        </div>
      )}
    </div>
  );
}

export default function GuidaPage() {
  const [cerca, setCerca] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [voceId, setVoceId] = useState<number>(0);

  const totali = GUIDA.reduce((s, a) => s + a.voci.length, 0);
  const automatiche = GUIDA.reduce((s, a) => s + a.voci.filter(v => v.automatico).length, 0);

  const q = cerca.trim().toLowerCase();

  /** Risultati della ricerca, con l'area appiccicata: si cerca in tutto insieme. */
  const risultati = useMemo(() => {
    if (!q) return [];
    return GUIDA.flatMap(a => a.voci
      .filter(v => testoCercabile(v).includes(q))
      .map(v => ({ v, areaId: a.id, areaTitolo: a.titolo })));
  }, [q]);

  const area = GUIDA.find(a => a.id === areaId) || null;

  const apri = (id: string) => { setAreaId(id); setVoceId(0); setCerca(''); };

  return (
    <div className="space-y-5">
      {/* Intestazione + ricerca: la ricerca è il modo vero di usare la guida. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" /> Guida
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            Come si usa il gestionale, pezzo per pezzo. Se sai già cosa cerchi, scrivilo qui sotto.
          </p>
        </div>
        <div className="relative w-full sm:w-[26rem]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={cerca} onChange={e => { setCerca(e.target.value); setAreaId(null); }}
            placeholder="Cerca: sconto, acconto, disdetta, recensione…"
            className="w-full pl-9 pr-9 py-3 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
          {cerca && (
            <button onClick={() => setCerca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* --- RICERCA: si scavalca tutto e si arriva alla risposta --- */}
      {q && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            {risultati.length === 0
              ? 'Niente con questa parola. Prova con una parola sola, tipo “acconto”.'
              : `${risultati.length} risultat${risultati.length === 1 ? 'o' : 'i'}`}
          </p>
          {risultati.map(({ v, areaId: aid, areaTitolo }, i) => {
            const st = stileDi(aid);
            return (
              <details key={`${aid}-${i}`} className="rounded-2xl border border-border bg-bg-secondary overflow-hidden">
                <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-bg-hover">
                  <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${st.punto}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary">{v.titolo}</span>
                    <span className="block text-[11px] text-text-muted">{areaTitolo} · {v.dove}</span>
                  </span>
                  {v.automatico && <Zap className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                </summary>
                <div className="px-4 pb-4 pt-1 border-t border-border/40">
                  <Spiegazione v={v} areaId={aid} senzaTitolo />
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* --- LE SETTE PORTE --- */}
      {!q && !area && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {GUIDA.map(a => {
              const st = stileDi(a.id);
              const Icona = st.icona;
              return (
                <button key={a.id} onClick={() => apri(a.id)}
                  className={`text-left p-5 rounded-2xl bg-bg-secondary border border-border transition-all ${st.bordo} hover:shadow-lg group`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${st.chip}`}>
                      <Icona className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-display font-semibold text-text-primary">{a.titolo}</p>
                      <p className="text-[11px] text-text-muted">{a.sottotitolo}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-xs text-text-secondary mt-3 line-clamp-2">
                    {a.voci.slice(0, 3).map(v => v.titolo).join(' · ')}
                  </p>
                  <p className="text-[11px] text-text-muted mt-2">
                    {a.voci.length} cose
                    {a.voci.some(v => v.automatico) && ` · ${a.voci.filter(v => v.automatico).length} automatiche`}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-text-muted">
            In tutto {totali} funzioni. {automatiche} il gestionale le fa da solo: cercale col fulmine dentro le sezioni.
          </p>
        </>
      )}

      {/* --- DENTRO UN'AREA: elenco a sinistra, spiegazione a destra --- */}
      {!q && area && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setAreaId(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover">
              <ArrowLeft className="w-3.5 h-3.5" /> Tutte le sezioni
            </button>
            <div className="min-w-0">
              <p className="text-base font-display font-semibold text-text-primary">{area.titolo}</p>
              <p className="text-[11px] text-text-muted">{area.voci.length} cose · {area.sottotitolo}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4 items-start">
            {/* L'indice: titoli e basta, corto da scorrere. */}
            <div className="rounded-2xl border border-border bg-bg-secondary overflow-hidden lg:max-h-[70vh] lg:overflow-y-auto">
              {area.voci.map((v, i) => {
                const scelta = i === voceId;
                return (
                  <button key={i} onClick={() => setVoceId(i)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/30 last:border-b-0 flex items-center gap-2 transition-colors ${
                      scelta ? 'bg-accent/10' : 'hover:bg-bg-hover'}`}>
                    <span className={`text-sm min-w-0 flex-1 ${scelta ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                      {v.titolo}
                    </span>
                    {v.automatico && <Zap className="w-3 h-3 text-accent flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* La spiegazione, una alla volta: si legge, non si scansiona. */}
            <div className="rounded-2xl border border-border bg-bg-secondary p-5">
              {area.voci[voceId] && <Spiegazione v={area.voci[voceId]} areaId={area.id} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
