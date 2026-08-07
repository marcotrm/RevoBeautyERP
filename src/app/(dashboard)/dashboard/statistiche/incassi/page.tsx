'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  StatsHeader, KpiGrid, Card, Caricamento, GraficoAndamento, GraficoTorta, Classifica, eur,
} from '@/components/stats/StatsUI';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';

export default function IncassiPage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Incassi" sottotitolo="Quanto entra, da dove entra e quando entra." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Incassi')} /> : <Caricamento />}

      <Card titolo="Incasso e scontrino medio, mese per mese"
        spiega="Se l'incasso sale ma lo scontrino medio scende, stai lavorando di più per gli stessi soldi: servono abbinamenti, prodotti o pacchetti, non altre clienti.">
        {trends
          ? <GraficoAndamento dati={trends.months} x="label" altezza={280}
              serie={[{ key: 'incasso', nome: 'Incasso' }, { key: 'scontrinoMedio', nome: 'Scontrino medio', colore: '#f59e0b' }]} />
          : <Caricamento />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="Quanto rende ogni giorno della settimana"
          spiega="Media di incasso per giornata di apertura, non totale: dice quanto vale davvero un martedì rispetto a un sabato. I giorni bassi sono quelli da riempire con le promozioni.">
          {trends
            ? <GraficoAndamento dati={trends.perGiornoSettimana} x="nome" tipo="bar" altezza={260}
                serie={[{ key: 'valore', nome: 'Media incasso' }]} />
            : <Caricamento />}
        </Card>

        <Card titolo="Come pagano le clienti"
          spiega="Divisione dell'incasso per metodo di pagamento. Serve per la gestione del cassetto e per capire quanto girano contanti.">
          {trends ? <GraficoTorta dati={trends.metodiPagamento} /> : <Caricamento />}
        </Card>
      </div>

      <Card titolo="Le clienti che spendono di più"
        spiega="Top 10 per incasso in cassa negli ultimi 12 mesi. Sono le persone da trattare meglio di tutte: perderne una pesa come perderne dieci normali.">
        {trends
          ? <Classifica righe={trends.topClienti} formato={eur} etichettaExtra={n => `${n} ${n === 1 ? 'volta' : 'volte'}`} />
          : <Caricamento />}
      </Card>
    </motion.div>
  );
}
