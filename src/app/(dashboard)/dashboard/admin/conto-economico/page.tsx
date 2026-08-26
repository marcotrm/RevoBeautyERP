'use client';

/**
 * Il conto economico: quanto è entrato, quanto è dello Stato, quanto resta.
 *
 * Le pagine Cash Flow e Report che c'erano prima mostravano numeri inventati
 * — un saldo scritto nel codice, quattro settimane finte. Qui non c'è un solo
 * numero che non venga dalla cassa, dai costi fissi dichiarati o dalle spese
 * dei soci.
 *
 * L'ordine delle cose è quello che serve a chi deve decidere: prima
 * l'incassato (la cifra che si vede), poi l'IVA da mettere da parte (che
 * sembra guadagno e non lo è), poi i costi, e per ultimo quello che resta.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Euro, Landmark, Wallet, TrendingUp, TrendingDown, Banknote, CreditCard, PiggyBank } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';
import { contoEconomico, type ContoEconomico } from '@/app/actions/contoEconomico';

const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function oggiRoma(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}
function piu(ymd: string, giorni: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}
function giornoIt(ymd: string): string {
  const [a, m, g] = ymd.split('-');
  return `${g}/${m}/${a}`;
}
function meseIt(chiave: string): string {
  const [a, m] = chiave.split('-');
  return `${MESI_IT[Number(m) - 1]} ${a.slice(2)}`;
}

type Scelta = 'mese' | 'scorso' | 'trimestre' | 'anno' | 'scelto';

export default function ContoEconomicoPage() {
  const [scelta, setScelta] = useState<Scelta>('mese');
  const [dal, setDal] = useState(() => `${oggiRoma().slice(0, 7)}-01`);
  const [al, setAl] = useState(oggiRoma);
  const [dati, setDati] = useState<ContoEconomico | null>(null);
  const [caricando, setCaricando] = useState(true);

  const periodo = (() => {
    const oggi = oggiRoma();
    const [anno, mese] = oggi.split('-').map(Number);
    switch (scelta) {
      case 'mese': return { dal: `${oggi.slice(0, 7)}-01`, al: oggi };
      case 'scorso': {
        const d = new Date(Date.UTC(anno, mese - 2, 1));
        const inizio = d.toISOString().slice(0, 10);
        const fine = new Date(Date.UTC(anno, mese - 1, 0)).toISOString().slice(0, 10);
        return { dal: inizio, al: fine };
      }
      case 'trimestre': return { dal: piu(oggi, -90), al: oggi };
      case 'anno': return { dal: `${anno}-01-01`, al: oggi };
      default: return { dal, al };
    }
  })();

  useEffect(() => {
    let vivo = true;
    const avvio = setTimeout(() => {
      setCaricando(true);
      contoEconomico(periodo)
        .then(d => { if (vivo) { setDati(d); setCaricando(false); } })
        .catch(() => { if (vivo) setCaricando(false); });
    }, 0);
    return () => { vivo = false; clearTimeout(avvio); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scelta, dal, al]);

  const PERIODI: { chiave: Scelta; label: string }[] = [
    { chiave: 'mese', label: 'Questo mese' },
    { chiave: 'scorso', label: 'Mese scorso' },
    { chiave: 'trimestre', label: 'Ultimi 3 mesi' },
    { chiave: 'anno', label: "Quest'anno" },
    { chiave: 'scelto', label: 'Da / a' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Conto economico</h2>
        <p className="text-sm text-text-secondary">
          Incassi, IVA da accantonare, costi e margine — dal {giornoIt(periodo.dal)} al {giornoIt(periodo.al)}
        </p>
      </div>

      {/* Periodo */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PERIODI.map(p => (
            <button key={p.chiave} onClick={() => setScelta(p.chiave)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                scelta === p.chiave ? 'bg-accent text-white border-accent'
                  : 'text-text-secondary border-border hover:bg-bg-hover hover:text-text-primary'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {scelta === 'scelto' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-secondary">Dal</span>
            <input type="date" value={dal} max={al} onChange={e => e.target.value && setDal(e.target.value)}
              className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
            <span className="text-xs text-text-secondary">al</span>
            <input type="date" value={al} min={dal} onChange={e => e.target.value && setAl(e.target.value)}
              className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
          </div>
        )}
      </div>

      {caricando || !dati ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Sto facendo i conti…</p>
        </div>
      ) : (
        <>
          {/* La riga che conta: incassato → IVA → resta */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Riquadro icona={Euro} titolo="Incassato (IVA compresa)" valore={formatCurrency(dati.ivato)}
              sotto={`${dati.incassi} incassi`} />
            <Riquadro icona={TrendingUp} titolo="Imponibile (senza IVA)" valore={formatCurrency(dati.imponibile)}
              sotto="il ricavo vero" colore="text-text-primary" />
            <Riquadro icona={Landmark} titolo={`IVA da mettere da parte (${dati.aliquota}%)`} valore={formatCurrency(dati.iva)}
              sotto="non è tuo: è dello Stato" colore="text-warning" />
            <Riquadro icona={dati.margine >= 0 ? TrendingUp : TrendingDown} titolo="Margine"
              valore={formatCurrency(dati.margine)}
              sotto={`${dati.marginePercento}% dell'imponibile`}
              colore={dati.margine >= 0 ? 'text-success' : 'text-error'} />
          </div>

          {/* Come è entrato */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Riquadro icona={Banknote} titolo="Contanti" valore={formatCurrency(dati.contanti)} sotto="entrati nel cassetto" />
            <Riquadro icona={CreditCard} titolo="Carta, POS, Satispay, bonifico" valore={formatCurrency(dati.tracciati)} sotto="arrivano sul conto" />
            <Riquadro icona={PiggyBank} titolo="In cassaforte oggi" valore={formatCurrency(dati.cassaforte)} sotto="contanti versati e non prelevati" />
          </div>

          {/* Costi e capitale */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-bg-tertiary/30">
                <h3 className="text-base font-display font-bold text-text-primary">Costi del periodo</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Costi fissi {formatCurrency(dati.costiFissi)} + spese {formatCurrency(dati.speseSoci)} = <strong>{formatCurrency(dati.costiTotali)}</strong>
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
                {dati.costiPerVoce.filter(v => v.tipo !== 'investimento').map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="text-sm text-text-primary truncate">{v.nome}</span>
                    <span className="text-sm font-semibold text-text-primary tabular-nums flex-shrink-0">{formatCurrency(v.importo)}</span>
                  </div>
                ))}
                {dati.costiPerVoce.filter(v => v.tipo !== 'investimento').length === 0 && (
                  <p className="px-5 py-6 text-sm text-text-muted text-center">Nessun costo registrato in questo periodo.</p>
                )}
              </div>
            </div>

            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-bg-tertiary/30">
                <h3 className="text-base font-display font-bold text-text-primary">Investimenti e capitale</h3>
                {/* Fuori dal margine apposta: un macchinario non è una spesa del mese. */}
                <p className="text-xs text-text-secondary mt-0.5">
                  Non entrano nel margine: restano al centro e si consumano negli anni.
                </p>
              </div>
              <div className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Investimenti pagati nel periodo</span>
                  <span className="text-sm font-bold text-text-primary tabular-nums">{formatCurrency(dati.investimenti)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Soldi messi dai soci</span>
                  <span className="text-sm font-bold text-success tabular-nums">{formatCurrency(dati.finanziamentiSoci)}</span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-border/40 pt-2">
                  {dati.costiPerVoce.filter(v => v.tipo === 'investimento').map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm text-text-primary truncate">{v.nome}</span>
                      <span className="text-sm text-text-secondary tabular-nums flex-shrink-0">{formatCurrency(v.importo)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mese per mese: la tendenza, che vale più del singolo numero */}
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-bg-tertiary/30">
              <h3 className="text-base font-display font-bold text-text-primary">Mese per mese</h3>
              <p className="text-xs text-text-secondary mt-0.5">Ultimi 12 mesi, sempre — non segue il periodo scelto.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase">Mese</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Incassato</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Imponibile</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">IVA</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Costi</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Margine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dati.mesi.map(m => (
                    <tr key={m.mese} className="hover:bg-bg-tertiary/40">
                      <td className="px-5 py-2.5 text-sm text-text-primary capitalize">{meseIt(m.mese)}</td>
                      <td className="px-5 py-2.5 text-sm text-text-secondary text-right tabular-nums">{formatCurrency(m.ivato)}</td>
                      <td className="px-5 py-2.5 text-sm text-text-primary text-right tabular-nums">{formatCurrency(m.imponibile)}</td>
                      <td className="px-5 py-2.5 text-sm text-warning text-right tabular-nums">{formatCurrency(m.iva)}</td>
                      <td className="px-5 py-2.5 text-sm text-text-secondary text-right tabular-nums">{formatCurrency(m.costi)}</td>
                      <td className={`px-5 py-2.5 text-sm font-bold text-right tabular-nums ${m.margine >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatCurrency(m.margine)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Giorno per giorno, per la fatturazione */}
          {dati.giorni.length > 0 && (
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-bg-tertiary/30">
                <h3 className="text-base font-display font-bold text-text-primary">Giorno per giorno</h3>
                <p className="text-xs text-text-secondary mt-0.5">Quanto è entrato ogni giorno del periodo, con lo scorporo dell&apos;IVA.</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-bg-secondary">
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase">Giorno</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Incassi</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Ivato</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">Imponibile</th>
                      <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase text-right">IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {dati.giorni.map(g => {
                      const imponibile = g.ivato / (1 + dati.aliquota / 100);
                      return (
                        <tr key={g.data} className="hover:bg-bg-tertiary/40">
                          <td className="px-5 py-2 text-sm text-text-primary">{giornoIt(g.data)}</td>
                          <td className="px-5 py-2 text-sm text-text-muted text-right tabular-nums">{g.incassi}</td>
                          <td className="px-5 py-2 text-sm text-text-primary text-right tabular-nums">{formatCurrency(g.ivato)}</td>
                          <td className="px-5 py-2 text-sm text-text-secondary text-right tabular-nums">{formatCurrency(imponibile)}</td>
                          <td className="px-5 py-2 text-sm text-warning text-right tabular-nums">{formatCurrency(g.ivato - imponibile)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-text-muted">
            L&apos;IVA è scorporata al {dati.aliquota}% dai prezzi incassati, che a listino sono già ivati.
            L&apos;aliquota si cambia in Impostazioni → Scontrino elettronico. Gli investimenti e i soldi messi
            dai soci restano fuori dal margine: non sono costi del periodo.
          </p>
        </>
      )}
    </motion.div>
  );
}

function Riquadro({ icona: Icona, titolo, valore, sotto, colore = 'text-text-primary' }: {
  icona: React.ComponentType<{ className?: string }>;
  titolo: string; valore: string; sotto?: string; colore?: string;
}) {
  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 flex items-start gap-3">
      <div className="p-2.5 rounded-xl bg-bg-tertiary text-text-secondary flex-shrink-0"><Icona className="w-4 h-4" /></div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider leading-tight">{titolo}</p>
        <p className={`text-xl font-display font-bold mt-1 tabular-nums ${colore}`}>{valore}</p>
        {sotto && <p className="text-[11px] text-text-muted mt-0.5">{sotto}</p>}
      </div>
    </div>
  );
}
