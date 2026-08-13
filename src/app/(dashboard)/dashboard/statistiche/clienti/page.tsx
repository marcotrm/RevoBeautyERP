'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  StatsHeader, KpiGrid, Card, Caricamento, GraficoAndamento, GraficoTorta, eur,
} from '@/components/stats/StatsUI';
import FiltroPeriodo, { periodoPreset, type Periodo } from '@/components/stats/FiltroPeriodo';
import TabellaClienti from '@/components/stats/TabellaClienti';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';
import { getClientRanking, type ClientRow } from '@/app/actions/clientStats';

const numero = (n: number) => String(n);

/** Quattro numeri di sintesi del periodo scelto, sopra la classifica. */
function Riepilogo({ righe }: { righe: ClientRow[] }) {
  const spesa = righe.reduce((s, r) => s + r.spesa, 0);
  const visite = righe.reduce((s, r) => s + r.visite, 0);
  const disdette = righe.reduce((s, r) => s + r.disdette, 0);
  const nuove = righe.filter(r => r.nuova).length;
  const paganti = righe.filter(r => r.spesa > 0).length;
  const dati = [
    { l: 'Clienti attive nel periodo', v: String(righe.length), s: `${nuove} alla prima volta` },
    { l: 'Hanno speso', v: String(paganti), s: righe.length ? `${Math.round((paganti / Math.max(righe.length, 1)) * 100)}% di chi è passata` : '' },
    { l: 'Visite completate', v: String(visite), s: `${disdette} appuntamenti persi` },
    { l: 'Spesa media a cliente', v: eur(paganti ? spesa / paganti : 0), s: `${eur(spesa)} in totale` },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {dati.map(d => (
        <div key={d.l} className="bg-bg-secondary border border-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{d.l}</p>
          <p className="text-2xl font-display font-bold text-text-primary mt-1.5">{d.v}</p>
          {d.s && <p className="text-xs text-text-muted mt-0.5">{d.s}</p>}
        </div>
      ))}
    </div>
  );
}

export default function ClientiPage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();

  const [preset, setPreset] = useState('tre');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoPreset('tre'));
  const [righe, setRighe] = useState<ClientRow[] | null>(null);
  /** Le schede di casa tenute fuori dai conti: si dicono, non si nascondono. */
  const [escluse, setEscluse] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    setRighe(null);
    getClientRanking(periodo.from, periodo.to)
      .then(r => { if (vivo) { setRighe(r.righe); setEscluse(r.escluse); } })
      .catch(() => { if (vivo) setRighe([]); });
    return () => { vivo = false; };
  }, [periodo.from, periodo.to]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Clienti" sottotitolo="Chi viene, chi torna, chi spende e chi sta sparendo." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Clienti')} /> : <Caricamento />}

      {/* ===== Analisi per periodo ===== */}
      <div className="space-y-4 pt-2">
        <div>
          <h3 className="text-base font-display font-semibold text-text-primary">Analisi per periodo</h3>
          <p className="text-xs text-text-secondary">
            Tutto quello che sta sotto si riferisce alle date scelte qui. La “migliore cliente” di sempre e quella di questo mese sono spesso due persone diverse.
          </p>
        </div>
        <FiltroPeriodo valore={periodo} attivo={preset}
          onPreset={k => { setPreset(k); setPeriodo(periodoPreset(k)); }}
          onChange={p => { setPreset('personalizzato'); setPeriodo(p); }} />

        {righe && <Riepilogo righe={righe} />}
        <TabellaClienti righe={righe ?? []} caricando={righe === null} />

        {/* Chi è fuori dai conti va detto, altrimenti i numeri sembrano
            sbagliati e nessuno sa perché. */}
        {escluse.length > 0 && (
          <p className="text-[11px] text-text-muted">
            Fuori dai conti {escluse.length === 1 ? 'la scheda interna' : 'le schede interne'} di{' '}
            <strong className="text-text-secondary">{escluse.join(', ')}</strong>: sono prove, non clienti.
            Si toglie o si rimette dall&apos;etichetta <em>interno</em> nella scheda cliente.
          </p>
        )}
      </div>

      {/* ===== Andamento generale (ultimi 12 mesi) ===== */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="Nuove e di ritorno, mese per mese"
          spiega="Persone diverse venute ogni mese, ultimi 12. Un centro sano cresce sui ritorni: le nuove servono a sostituire chi esce, non a reggere il fatturato.">
          {trends
            ? <GraficoAndamento dati={trends.nuoveVsRitorno} x="label" tipo="bar" formato={numero} altezza={260}
                serie={[{ key: 'ritorno', nome: 'Di ritorno' }, { key: 'nuove', nome: 'Nuove', colore: '#22c55e' }]} />
            : <Caricamento />}
        </Card>

        <Card titolo="Nuove clienti registrate"
          spiega="Quante schede nuove entrano in anagrafica ogni mese: è il ritmo con cui il centro si allarga.">
          {trends
            ? <GraficoAndamento dati={trends.months} x="label" formato={numero} altezza={260}
                serie={[{ key: 'nuoveClienti', nome: 'Nuove clienti', colore: '#38bdf8' }]} />
            : <Caricamento />}
        </Card>

        <Card titolo="Quante volte tornano"
          spiega="Le clienti divise per numero di visite. La fetta “1 visita” è il bacino più grosso da recuperare: hanno già provato, sanno dove sei.">
          {trends ? <GraficoTorta dati={trends.frequenzaVisite} formato={numero} /> : <Caricamento />}
        </Card>

        <Card titolo="Rischio abbandono"
          spiega="Da quanto tempo non si vede ogni cliente. Le “tiepide” sono quelle su cui un messaggio funziona ancora: dopo i 120 giorni recuperarne una costa quanto trovarne una nuova.">
          {trends ? <GraficoTorta dati={trends.rischioAbbandono} formato={numero} /> : <Caricamento />}
        </Card>
      </div>
    </motion.div>
  );
}
