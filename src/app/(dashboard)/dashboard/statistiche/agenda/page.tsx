'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  StatsHeader, KpiGrid, Card, Caricamento, GraficoAndamento,
} from '@/components/stats/StatsUI';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';

const numero = (n: number) => String(n);

export default function AgendaStatsPage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Agenda e produttività" sottotitolo="Quanto è piena l'agenda, quanto se ne perde e quando si lavora davvero." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Agenda e produttività')} /> : <Caricamento />}

      <Card titolo="Trattamenti svolti e appuntamenti persi"
        spiega="Mese per mese: quanti trattamenti sono stati completati e quanti sono saltati fra disdette e assenze. Se la seconda barra cresce, prima di cercare clienti nuove conviene tappare il buco.">
        {trends
          ? <GraficoAndamento dati={trends.months} x="label" tipo="bar" formato={numero} altezza={280}
              serie={[{ key: 'appuntamenti', nome: 'Completati', colore: '#22c55e' }, { key: 'disdette', nome: 'Persi', colore: '#f43f5e' }]} />
          : <Caricamento />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card titolo="A che ora si lavora"
          spiega="Trattamenti completati per orario di inizio. Le fasce vuote sono ore già pagate allo staff: riempirle con promozioni mirate è il guadagno più a portata di mano.">
          {trends
            ? <GraficoAndamento dati={trends.perFasciaOraria} x="nome" tipo="bar" formato={numero} altezza={260}
                serie={[{ key: 'valore', nome: 'Trattamenti', colore: '#38bdf8' }]} />
            : <Caricamento />}
        </Card>

        <Card titolo="Quanto rende ogni giorno della settimana"
          spiega="Incasso medio per giornata di apertura. Incrocialo con i turni: nei giorni forti serve più personale, nei deboli conviene ridurre.">
          {trends
            ? <GraficoAndamento dati={trends.perGiornoSettimana} x="nome" tipo="bar" altezza={260}
                serie={[{ key: 'valore', nome: 'Media incasso' }]} />
            : <Caricamento />}
        </Card>
      </div>
    </motion.div>
  );
}
