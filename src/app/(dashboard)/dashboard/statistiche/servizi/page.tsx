'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  StatsHeader, KpiGrid, Card, Caricamento, Classifica, GraficoTorta, Vuoto, eur,
} from '@/components/stats/StatsUI';
import ClassificaUpsell from '@/components/stats/ClassificaUpsell';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';
import type { OperatorPerf } from '@/app/actions/statsTrends';

const numero = (n: number) => String(n);

/** Chi ha fatto cosa: una riga per operatrice, ordinata per valore prodotto. */
function TabellaOperatrici({ righe }: { righe: OperatorPerf[] }) {
  if (!righe.length) return <Vuoto testo="Nessun trattamento completato nel periodo." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border/60">
            <th className="py-2 pr-3 font-semibold">Operatrice</th>
            <th className="py-2 px-3 font-semibold text-right">Trattamenti</th>
            <th className="py-2 px-3 font-semibold text-right">Ore in cabina</th>
            <th className="py-2 px-3 font-semibold text-right">Clienti seguite</th>
            <th className="py-2 px-3 font-semibold text-right">Valore medio</th>
            <th className="py-2 pl-3 font-semibold text-right">Valore prodotto</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.nome} className="border-b border-border/30">
              <td className="py-2.5 pr-3 text-text-primary font-medium">{r.nome}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-primary">{r.trattamenti}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.ore.toLocaleString('it-IT')} h</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.clientiSeguite}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{eur(r.ticketMedio)}</td>
              <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-accent">{eur(r.incasso)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ServiziPage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Servizi e staff" sottotitolo="Cosa vende davvero il centro e chi lo produce." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="Trattamenti che fatturano di più"
          spiega="Valore dei trattamenti completati negli ultimi 12 mesi. Non è la stessa classifica del numero: un servizio fatto poco ma caro può valere più di uno fatto sempre.">
          {trends
            ? <Classifica righe={trends.topTrattamentiFatturato} formato={eur} etichettaExtra={n => `${n} volte`} />
            : <Caricamento />}
        </Card>

        <Card titolo="Trattamenti più richiesti"
          spiega="Gli stessi servizi contati per numero di volte. Quelli in alto qui ma non nella classifica a fianco sono i candidati a un ritocco di prezzo.">
          {trends
            ? <Classifica righe={trends.topTrattamentiNumero} formato={numero} etichettaExtra={n => eur(n)} />
            : <Caricamento />}
        </Card>
      </div>

      <Card titolo="Da dove arriva il fatturato dei servizi"
        spiega="Peso di ogni categoria di trattamento. Se una sola categoria fa quasi tutto, il centro è fragile: basta una moda che cambia.">
        {trends ? <GraficoTorta dati={trends.topCategorie} altezza={300} /> : <Caricamento />}
      </Card>

      <Card titolo="Rendimento per operatrice"
        spiega="Trattamenti completati negli ultimi 12 mesi, ore effettive e valore prodotto. Il valore medio dice chi lavora sui servizi più alti — utile per capire chi affiancare a chi.">
        {trends ? <TabellaOperatrici righe={trends.operatrici} /> : <Caricamento />}
      </Card>

      <ClassificaUpsell />

      <div className="space-y-3">
        <h3 className="text-base font-display font-semibold text-text-primary">Costi e redditività</h3>
        {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Costi e redditività')} /> : <Caricamento />}
      </div>
    </motion.div>
  );
}
