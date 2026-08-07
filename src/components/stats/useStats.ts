'use client';

/**
 * Dati delle Statistiche, caricati una volta sola per tutta la sezione.
 *
 * Le pagine sono otto ma i conti sono sempre gli stessi: se ogni scheda
 * rifacesse le query, cambiare pagina costerebbe due secondi di attesa ogni
 * volta. Qui la promessa viene tenuta in memoria e riusata; `ricarica()` la
 * butta via quando si vuole il dato fresco.
 */

import { useEffect, useState } from 'react';
import { getBusinessKPIs, type KpiGroup, type Kpi } from '@/app/actions/businessStats';
import { getTrends, type Trends } from '@/app/actions/statsTrends';

let cacheKpi: Promise<KpiGroup[]> | null = null;
let cacheTrend: Promise<Trends> | null = null;

export function ricaricaStatistiche() {
  cacheKpi = null;
  cacheTrend = null;
}

export function useKpiGroups() {
  const [groups, setGroups] = useState<KpiGroup[] | null>(null);
  const [errore, setErrore] = useState('');
  useEffect(() => {
    let vivo = true;
    cacheKpi = cacheKpi || getBusinessKPIs();
    cacheKpi
      .then(g => { if (vivo) setGroups(g); })
      .catch(e => { console.error(e); cacheKpi = null; if (vivo) setErrore('Impossibile caricare le statistiche.'); });
    return () => { vivo = false; };
  }, []);
  return { groups, errore };
}

export function useTrends() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [errore, setErrore] = useState('');
  useEffect(() => {
    let vivo = true;
    cacheTrend = cacheTrend || getTrends();
    cacheTrend
      .then(t => { if (vivo) setTrends(t); })
      .catch(e => { console.error(e); cacheTrend = null; if (vivo) setErrore('Impossibile caricare l’andamento.'); });
    return () => { vivo = false; };
  }, []);
  return { trends, errore };
}

/** I KPI di un gruppo, per titolo: ogni pagina mostra solo i suoi. */
export function kpiDelGruppo(groups: KpiGroup[] | null, titolo: string): Kpi[] {
  return groups?.find(g => g.title === titolo)?.kpis ?? [];
}

/** Poche schede scelte a mano, per la panoramica. */
export function kpiScelti(groups: KpiGroup[] | null, chiavi: string[]): Kpi[] {
  if (!groups) return [];
  const tutte = groups.flatMap(g => g.kpis);
  return chiavi.map(k => tutte.find(x => x.key === k)).filter(Boolean) as Kpi[];
}
