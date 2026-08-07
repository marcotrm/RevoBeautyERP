'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { StatsHeader, KpiGrid, Caricamento } from '@/components/stats/StatsUI';
import { useKpiGroups, kpiDelGruppo } from '@/components/stats/useStats';

export default function PacchettiStatsPage() {
  const { groups, errore } = useKpiGroups();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Pacchetti, crediti e buoni"
        sottotitolo="Soldi già incassati a fronte di lavoro ancora da fare — e soldi ancora da incassare." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Pacchetti, crediti e buoni')} /> : <Caricamento />}

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Come leggere questi numeri</h3>
        <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed list-disc pl-5">
          <li><b className="text-text-primary">Sedute pagate da erogare</b> è un debito, non un incasso: quei soldi sono già in cassa ma il lavoro è ancora tutto da fare.</li>
          <li><b className="text-text-primary">Utilizzo pacchetti</b> basso significa clienti che hanno pagato e non tornano: prima o poi arriva la richiesta di rimborso, o il passaparola storto.</li>
          <li><b className="text-text-primary">Da incassare</b> sono rate non saldate. Vanno sollecitate finché la cliente frequenta ancora il centro: dopo diventa quasi impossibile.</li>
          <li><b className="text-text-primary">Pacchetti in scadenza</b> è la lista di chiamate più redditizia che hai: recuperi la cliente ed eviti il reclamo.</li>
        </ul>
      </div>
    </motion.div>
  );
}
