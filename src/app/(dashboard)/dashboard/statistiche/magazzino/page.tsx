'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StatsHeader, KpiGrid, Card, Caricamento, Classifica, eur } from '@/components/stats/StatsUI';
import DettaglioProdotto from '@/components/stats/DettaglioProdotto';
import { useKpiGroups, useTrends, kpiDelGruppo } from '@/components/stats/useStats';

export default function MagazzinoStatsPage() {
  const { groups, errore } = useKpiGroups();
  /* Si preme un prodotto e si vede quando è stato venduto, e a chi. */
  const [dettaglio, setDettaglio] = useState<string | null>(null);
  const { trends } = useTrends();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Magazzino e rivendita"
        sottotitolo="La merce a scaffale sono soldi fermi: qui si vede quanti e quanto girano." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      {groups ? <KpiGrid kpis={kpiDelGruppo(groups, 'Magazzino')} /> : <Caricamento />}

      <Card titolo="Prodotti più venduti"
        spiega="Fatturato e pezzi usciti dalla cassa negli ultimi 12 mesi. Chi sta in fondo alla lista occupa scaffale e soldi senza restituirli: o lo si spinge, o lo si smette di riordinare. Premi una riga per vedere ogni vendita: giorno, cliente, pezzi.">
        {trends
          ? <Classifica righe={trends.topProdotti} formato={eur} onScegli={setDettaglio} etichettaExtra={n => `${n} pz`} />
          : <Caricamento />}
      </Card>

      {dettaglio && <DettaglioProdotto nome={dettaglio} onClose={() => setDettaglio(null)} />}
    </motion.div>
  );
}
