'use client';

/**
 * Quanto si deve a ciascuna, mese per mese.
 *
 * La classifica diceva chi aveva lavorato di piu'; questa dice quanto pagarla.
 * Ogni riga si apre e mostra da dove esce il numero — trattamento per
 * trattamento, prodotto per prodotto — perche' un compenso che non si puo'
 * spiegare alla diretta interessata non serve a niente.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Coins, Loader2, Percent, Save, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { compensiDelMese, salvaRegoleCompenso, type CompensiDelMese, type CompensoOperatrice } from '@/app/actions/compensi';

function meseCorrente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nomeMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function meseSpostato(mese: string, quanti: number): string {
  const [a, m] = mese.split('-').map(Number);
  const d = new Date(a, m - 1 + quanti, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Le regole di una ragazza: si scrivono qui e valgono da subito. */
function Regole({ riga, onSalvato }: { riga: CompensoOperatrice; onSalvato: () => void }) {
  const [v, setV] = useState({
    commission: String(riga.percentuale),
    commissionProdotti: String(riga.percentualeProdotti),
    commissionSoglia: String(riga.soglia),
    commissionOltre: String(riga.percentualeOltre),
    compensoFisso: String(riga.fisso),
  });
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);

  const salva = async () => {
    setSalvando(true);
    try {
      await salvaRegoleCompenso(riga.operatorId, {
        commission: Number(v.commission.replace(',', '.')) || 0,
        commissionProdotti: Number(v.commissionProdotti.replace(',', '.')) || 0,
        commissionSoglia: Number(v.commissionSoglia.replace(',', '.')) || 0,
        commissionOltre: Number(v.commissionOltre.replace(',', '.')) || 0,
        compensoFisso: Number(v.compensoFisso.replace(',', '.')) || 0,
      });
      setFatto(true);
      setTimeout(() => setFatto(false), 2000);
      onSalvato();
    } finally { setSalvando(false); }
  };

  const campo = (chiave: keyof typeof v, etichetta: string, suffisso: string, aiuto?: string) => (
    <div>
      <label className="block text-[11px] font-medium text-text-secondary mb-1">{etichetta}</label>
      <div className="relative">
        <input type="text" inputMode="decimal" value={v[chiave]}
          onChange={e => setV(p => ({ ...p, [chiave]: e.target.value }))}
          className="w-full pl-2.5 pr-7 py-2 rounded-lg bg-bg-secondary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{suffisso}</span>
      </div>
      {aiuto && <p className="text-[10px] text-text-muted mt-1 leading-tight">{aiuto}</p>}
    </div>
  );

  return (
    <div className="p-3.5 rounded-xl bg-bg-tertiary/40 border border-border space-y-3">
      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
        <Percent className="w-3.5 h-3.5 text-accent" /> Come si calcola il suo compenso
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {campo('commission', 'Sui trattamenti', '%')}
        {campo('commissionProdotti', 'Sui prodotti', '%', 'di solito piu’ alta: il prodotto si vende solo se lo proponi')}
        {campo('compensoFisso', 'Fisso mensile', '€', 'quello che prende comunque, lordo')}
        {campo('commissionSoglia', 'Soglia premio', '€', 'da quanto fatturato in su scatta la percentuale maggiorata')}
        {campo('commissionOltre', 'Oltre la soglia', '%', 'vale solo sulla parte sopra, come gli scaglioni')}
      </div>
      <button onClick={salva} disabled={salvando}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg gradient-accent text-white text-xs font-semibold disabled:opacity-50">
        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {fatto ? 'Salvato' : 'Salva le regole'}
      </button>
    </div>
  );
}

export default function Compensi() {
  const [mese, setMese] = useState(meseCorrente());
  const [dati, setDati] = useState<CompensiDelMese | null>(null);
  const [caricando, setCaricando] = useState(false);
  const [aperta, setAperta] = useState<string | null>(null);

  /*
    Il caricamento parte dal mese e da un contatore: cambiare mese o salvare le
    regole di una ragazza fa ripartire il conto. La rotellina si accende nel
    gesto che l'ha chiesto, non dentro l'effetto.
  */
  const [versione, setVersione] = useState(0);
  useEffect(() => {
    let vivo = true;
    compensiDelMese(mese)
      .then(d => { if (vivo) { setDati(d); setCaricando(false); } })
      .catch(() => { if (vivo) { setDati(null); setCaricando(false); } });
    return () => { vivo = false; };
  }, [mese, versione]);

  const ricarica = useCallback(() => { setCaricando(true); setVersione(v => v + 1); }, []);
  const vaiAlMese = (m: string) => { setCaricando(true); setMese(m); };

  const righe = (dati?.righe || []).filter(r => r.attiva || r.totale > 0 || r.incassoTrattamenti > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => vaiAlMese(meseSpostato(mese, -1))}
            className="px-3 py-2 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover">←</button>
          <span className="text-sm font-semibold text-text-primary capitalize min-w-[10rem] text-center">{nomeMese(mese)}</span>
          <button onClick={() => vaiAlMese(meseSpostato(mese, 1))} disabled={mese >= meseCorrente()}
            className="px-3 py-2 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-30">→</button>
        </div>
        {caricando && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
      </div>

      {dati && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-bg-secondary border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Da pagare in tutto</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(dati.totaleDaPagare)}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Incassato nel mese</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(dati.incassoTotale)}</p>
          </div>
          <div className="bg-bg-secondary border border-border rounded-2xl p-4">
            <p className="text-xs text-text-secondary">Quanto pesa il personale</p>
            <p className={`text-2xl font-display font-bold mt-1 ${dati.incidenza > 50 ? 'text-error' : dati.incidenza > 40 ? 'text-warning' : 'text-success'}`}>
              {dati.incidenza.toFixed(1)}%
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">sopra il 50% il mese non regge</p>
          </div>
        </div>
      )}

      {dati && righe.length === 0 && (
        <p className="text-sm text-text-muted text-center py-8">Nessun trattamento chiuso in questo mese.</p>
      )}

      <div className="space-y-2">
        {righe.map(r => {
          const apertaQui = aperta === r.operatorId;
          return (
            <div key={r.operatorId} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <button onClick={() => setAperta(apertaQui ? null : r.operatorId)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-hover/50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {r.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {r.nome}
                    {!r.attiva && <span className="text-text-muted font-normal"> · non piu’ in servizio</span>}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    {r.numeroTrattamenti} trattamenti · {formatCurrency(r.incassoTrattamenti)}
                    {r.numeroProdotti > 0 ? ` · ${r.numeroProdotti} prodotti · ${formatCurrency(r.incassoProdotti)}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-display font-bold text-text-primary">{formatCurrency(r.totale)}</p>
                  <p className="text-[10px] text-text-muted">
                    {r.percentuale}% {r.fisso > 0 ? `+ ${formatCurrency(r.fisso)} fisso` : ''}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${apertaQui ? 'rotate-180' : ''}`} />
              </button>

              {apertaQui && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {/* Il conto, voce per voce: e' quello che si mostra a lei */}
                  <div className="rounded-xl bg-bg-tertiary/40 border border-border p-3.5 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Trattamenti · {r.percentuale}% su {formatCurrency(r.incassoTrattamenti - (r.premioSoglia > 0 ? r.incassoTrattamenti - r.soglia : 0))}</span>
                      <span className="text-text-primary font-semibold">{formatCurrency(r.provvigioneTrattamenti)}</span>
                    </div>
                    {r.premioSoglia > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                          Premio · {r.percentualeOltre}% oltre {formatCurrency(r.soglia)}
                        </span>
                        <span className="text-success font-semibold">{formatCurrency(r.premioSoglia)}</span>
                      </div>
                    )}
                    {r.incassoProdotti > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Prodotti · {r.percentualeProdotti}% su {formatCurrency(r.incassoProdotti)}</span>
                        <span className="text-text-primary font-semibold">{formatCurrency(r.provvigioneProdotti)}</span>
                      </div>
                    )}
                    {r.fisso > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Fisso mensile</span>
                        <span className="text-text-primary font-semibold">{formatCurrency(r.fisso)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-sm font-semibold text-text-primary">Totale</span>
                      <span className="text-lg font-display font-bold text-accent">{formatCurrency(r.totale)}</span>
                    </div>
                  </div>

                  <Regole riga={r} onSalvato={ricarica} />

                  {r.voci.length > 0 && (
                    <details className="rounded-xl border border-border">
                      <summary className="px-3.5 py-2.5 cursor-pointer text-xs font-medium text-text-secondary select-none">
                        Le {r.voci.length} righe da cui esce il numero
                      </summary>
                      <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                        {r.voci.map((v, i) => (
                          <div key={i} className="flex items-center gap-3 px-3.5 py-2">
                            <span className="text-sm flex-shrink-0">{v.tipo === 'prodotto' ? '🧴' : '💅'}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-text-primary truncate">{v.cosa}</p>
                              <p className="text-[10px] text-text-muted truncate">
                                {v.data.split('-').reverse().join('/')} · {v.cliente}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-text-primary flex-shrink-0">{formatCurrency(v.importo)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dati && dati.incassoRisorse > 0 && (
        <p className="text-[11px] text-text-muted text-center">
          Altri {formatCurrency(dati.incassoRisorse)} sono stati fatti dalle cabine automatiche: lavoro che non ha un compenso.
        </p>
      )}

      <div className="flex items-start gap-2 p-3 rounded-xl bg-bg-tertiary/40 border border-border">
        <Coins className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-muted leading-relaxed">
          Si contano solo le sedute <strong className="text-text-secondary">chiuse</strong> del mese, al prezzo davvero
          concordato: se hai fatto uno sconto, la provvigione scende con lui. Le sedute scalate da un pacchetto valgono
          zero qui, perché sono già state pagate quando il pacchetto è stato venduto. I prodotti vanno a chi risulta
          sulla vendita in cassa.
        </p>
      </div>
    </div>
  );
}
