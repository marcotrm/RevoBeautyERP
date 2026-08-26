'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StatsHeader, KpiGrid, Caricamento, Card, Classifica, eur } from '@/components/stats/StatsUI';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';
import DettaglioPacchetto from '@/components/stats/DettaglioPacchetto';

export default function PacchettiStatsPage() {
  const { groups, errore } = useKpiGroups();
  const { trends } = useTrends();
  /* Si preme un pacchetto e si vede chi l'ha comprato e a che punto è. */
  const [dettaglio, setDettaglio] = useState<string | null>(null);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Pacchetti, crediti e buoni"
        sottotitolo="Soldi già incassati a fronte di lavoro ancora da fare — e soldi ancora da incassare." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Pacchetti, crediti e buoni')} /> : <Caricamento />}

      <Card titolo="Pacchetti più venduti"
        spiega="Quanti ne sono stati venduti negli ultimi 12 mesi e quanto è entrato davvero (le rate non saldate non ci sono). Premi una riga per vedere chi l'ha comprato, quante sedute ha fatto e chi deve ancora pagare.">
        {trends
          ? <Classifica righe={trends.topPacchetti} formato={eur} onScegli={setDettaglio}
              etichettaExtra={n => `${n} ${n === 1 ? 'venduto' : 'venduti'}`} />
          : <Caricamento />}
      </Card>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Come leggere questi numeri</h3>
        <ul className="mt-3 space-y-2 text-sm text-text-secondary leading-relaxed list-disc pl-5">
          <li><b className="text-text-primary">Sedute pagate da erogare</b> è un debito, non un incasso: quei soldi sono già in cassa ma il lavoro è ancora tutto da fare.</li>
          <li><b className="text-text-primary">Utilizzo pacchetti</b> basso significa clienti che hanno pagato e non tornano: prima o poi arriva la richiesta di rimborso, o il passaparola storto.</li>
          <li><b className="text-text-primary">Da incassare</b> sono rate non saldate. Vanno sollecitate finché la cliente frequenta ancora il centro: dopo diventa quasi impossibile.</li>
          <li><b className="text-text-primary">Pacchetti in scadenza</b> è la lista di chiamate più redditizia che hai: recuperi la cliente ed eviti il reclamo.</li>
        </ul>
      </div>

      {dettaglio && <DettaglioPacchetto nome={dettaglio} onClose={() => setDettaglio(null)} />}
    </motion.div>
  );
}
