'use client';

/**
 * Panoramica: la pagina che si apre per prima.
 *
 * Deve rispondere in dieci secondi a tre domande — come sta andando il mese,
 * dove sto crescendo o calando, cosa richiede attenzione oggi. Il dettaglio
 * (sessanta numeri) sta nelle altre schede, non qui.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  StatsHeader, KpiGrid, Card, Caricamento, GraficoAndamento, eur,
} from '@/components/stats/StatsUI';
import { useKpiGroups, useTrends, kpiScelti } from '@/components/stats/useStats';
import type { Kpi } from '@/app/actions/businessStats';

/** Le cose che, se vanno storte, vuoi vedere subito senza cercarle. */
function Allarmi({ kpis }: { kpis: Kpi[] }) {
  const brutti = kpis.filter(k => k.tone === 'bad' || k.tone === 'warn');
  if (!brutti.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="w-4 h-4" /> Nessun campanello d&apos;allarme: tutti gli indicatori sono in verde.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {brutti.slice(0, 8).map(k => (
        <div key={k.key} className="flex items-start gap-3 p-3 rounded-xl bg-bg-tertiary/40">
          <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${k.tone === 'bad' ? 'text-error' : 'text-warning'}`} />
          <div className="min-w-0">
            <p className="text-sm text-text-primary">
              <b>{k.label}:</b> <span className={k.tone === 'bad' ? 'text-error' : 'text-warning'}>{k.value}</span>
              {k.sub && <span className="text-text-muted"> · {k.sub}</span>}
            </p>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{k.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatistichePage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();

  const principali = kpiScelti(groups, [
    'revMonth', 'growth', 'avgTicket', 'occupancy',
    'active60', 'returnRate', 'noShowRate', 'expected',
  ]);
  const tutti = groups?.flatMap(g => g.kpis) ?? [];

  const p = trends?.proiezioneMese;
  const versoMeseScorso = p && p.meseScorso > 0 ? ((p.proiezione - p.meseScorso) / p.meseScorso) * 100 : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader
        titolo="Statistiche"
        sottotitolo="Come sta andando il centro. Ogni scheda è un argomento: qui sotto solo l'essenziale, il dettaglio nelle altre pagine."
      />

      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {/* Proiezione: il numero che interessa davvero a metà mese */}
      {p && (
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Incassato questo mese</p>
              <p className="text-3xl font-display font-bold text-text-primary mt-1">{eur(p.incassoAdOggi)}</p>
              <p className="text-xs text-text-muted mt-0.5">in {p.giorniPassati} giorni su {p.giorniMese}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Proiezione a fine mese</p>
              <p className="text-3xl font-display font-bold text-accent mt-1">{eur(p.proiezione)}</p>
              <p className="text-xs text-text-muted mt-0.5">se si continua con questo ritmo</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Mese scorso</p>
              <p className="text-3xl font-display font-bold text-text-secondary mt-1">{eur(p.meseScorso)}</p>
              {versoMeseScorso !== null && (
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${versoMeseScorso >= 0 ? 'text-success' : 'text-error'}`}>
                  {versoMeseScorso >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {versoMeseScorso >= 0 ? '+' : ''}{Math.round(versoMeseScorso)}% previsto
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!groups && !errore && <Caricamento />}

      {groups && <KpiGrid kpis={principali} />}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="Incasso mese per mese" spiega="Ultimi 12 mesi. La forma della curva conta più del singolo mese: due mesi in calo di fila sono una tendenza, uno solo è stagionalità.">
          {trends
            ? <GraficoAndamento dati={trends.months} x="label" serie={[{ key: 'incasso', nome: 'Incasso' }]} />
            : <Caricamento testo="Carico l'andamento…" />}
        </Card>

        <Card titolo="Nuove clienti e clienti di ritorno" spiega="Quante persone diverse sono venute ogni mese, divise fra prima volta e già cliente. Se le nuove salgono ma i ritorni no, il problema non è l'acquisizione: è la fidelizzazione.">
          {trends
            ? <GraficoAndamento dati={trends.nuoveVsRitorno} x="label" tipo="bar"
                formato={(n) => String(n)}
                serie={[{ key: 'ritorno', nome: 'Di ritorno' }, { key: 'nuove', nome: 'Nuove', colore: '#22c55e' }]} />
            : <Caricamento testo="Carico l'andamento…" />}
        </Card>
      </div>

      <Card titolo="Da tenere d'occhio" spiega="Gli indicatori fuori soglia, presi da tutte le schede. Se è vuoto, va tutto bene.">
        {groups ? <Allarmi kpis={tutti} /> : <Caricamento testo="Controllo gli indicatori…" />}
      </Card>
    </motion.div>
  );
}
