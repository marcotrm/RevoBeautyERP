'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import {
  StatsHeader, KpiGrid, Card, Caricamento, Imbuto, GraficoTorta, Classifica, Vuoto, eur,
} from '@/components/stats/StatsUI';
import FiltroPeriodo, { periodoPreset, type Periodo } from '@/components/stats/FiltroPeriodo';
import { useKpiGroups, kpiDelGruppo } from '@/components/stats/useStats';
import { getMarketingStats, type MarketingStats } from '@/app/actions/clientStats';

const GRUPPO = 'Inaugurazione — dal coupon al cliente pagante';
const numero = (n: number) => String(n);

function Numeri({ dati }: { dati: { l: string; v: string; s?: string; tono?: string }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {dati.map(d => (
        <div key={d.l} className="bg-bg-secondary border border-border rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{d.l}</p>
          <p className={`text-2xl font-display font-bold mt-1.5 ${d.tono || 'text-text-primary'}`}>{d.v}</p>
          {d.s && <p className="text-xs text-text-muted mt-0.5">{d.s}</p>}
        </div>
      ))}
    </div>
  );
}

/** La lista delle telefonate: chi manca da un po', dalla più preziosa. */
function DaRiattivare({ righe }: { righe: MarketingStats['daRiattivare'] }) {
  if (!righe.length) return <Vuoto testo="Nessuna cliente ferma da più di 60 giorni. Ottimo segno." />;
  return (
    <div className="divide-y divide-border/30 -mx-1">
      {righe.map((r, i) => (
        <div key={r.nome + i} className="flex items-center gap-3 px-1 py-2.5">
          <span className="text-[11px] text-text-muted w-5 text-right">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary truncate">{r.nome}</p>
            <p className="text-[11px] text-text-muted">{r.telefono || 'nessun telefono'}</p>
          </div>
          <span className="text-sm font-semibold text-text-primary">{eur(r.spesaStorica)}</span>
          <span className={`text-xs w-24 text-right ${r.giorni > 120 ? 'text-error' : 'text-warning'}`}>{r.giorni} gg fa</span>
          {r.telefono && (
            <a href={`tel:${r.telefono}`} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-bg-hover transition-colors">
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MarketingStatsPage() {
  const { groups, errore } = useKpiGroups();
  const kpis = kpiDelGruppo(groups, GRUPPO);

  const [preset, setPreset] = useState('tre');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoPreset('tre'));
  const [m, setM] = useState<MarketingStats | null>(null);

  useEffect(() => {
    let vivo = true;
    setM(null);
    getMarketingStats(periodo.from, periodo.to)
      .then(r => { if (vivo) setM(r); })
      .catch(() => { if (vivo) setM(null); });
    return () => { vivo = false; };
  }, [periodo.from, periodo.to]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <StatsHeader titolo="Marketing e campagne"
        sottotitolo="Da dove arrivano le clienti, quanto costa farle entrare e quante restano." />
      {errore && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{errore}</div>}

      <FiltroPeriodo valore={periodo} attivo={preset}
        onPreset={k => { setPreset(k); setPeriodo(periodoPreset(k)); }}
        onChange={p => { setPreset('personalizzato'); setPeriodo(p); }} />

      {!m ? <Caricamento testo="Calcolo i dati di marketing…" /> : (
        <>
          <Numeri dati={[
            { l: 'Nuove clienti nel periodo', v: String(m.nuoveClienti), s: 'schede create in anagrafica' },
            {
              l: 'Poi sono tornate a pagare', v: `${m.ritornoNuove.percentuale}%`,
              s: `${m.ritornoNuove.tornate} su ${m.ritornoNuove.nuove}`,
              tono: m.ritornoNuove.percentuale >= 40 ? 'text-success' : m.ritornoNuove.percentuale >= 20 ? 'text-warning' : 'text-error',
            },
            { l: 'Raggiungibili con campagne', v: String(m.consensoMarketing), s: `${m.senzaConsenso} senza consenso` },
            { l: 'Compleanni questo mese', v: String(m.compleanniMese), s: 'la promo più facile da fare' },
          ]} />

          <div className="grid lg:grid-cols-2 gap-4">
            <Card titolo="Da dove arrivano le nuove clienti"
              spiega="Etichette assegnate in anagrafica alle schede create nel periodo. Se “Senza etichetta” è la fetta più grande, non stai tracciando la provenienza: è il primo dato da sistemare, altrimenti non saprai mai quale campagna funziona.">
              <GraficoTorta dati={m.provenienza} formato={numero} />
            </Card>

            <Card titolo="Rubrica utilizzabile"
              spiega="Con quanti contatti puoi davvero fare una campagna. Il telefono serve per WhatsApp e SMS, l'email per il resto: i numeri mancanti sono clienti irraggiungibili.">
              <Classifica formato={numero}
                righe={[
                  { nome: 'Con numero di telefono', valore: m.conTelefono },
                  { nome: 'Con email', valore: m.conEmail },
                  { nome: 'Con consenso marketing', valore: m.consensoMarketing },
                ]} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card titolo="Affiliazione"
              spiega="Registrazioni arrivate dai QR dei partner nel periodo. “Verificate” sono quelle che hanno confermato il codice; “omaggi usati” quelle davvero entrate in negozio.">
              <Classifica formato={numero}
                righe={[
                  { nome: 'Registrazioni', valore: m.affiliazione.registrazioni },
                  { nome: 'Verificate', valore: m.affiliazione.verificate },
                  { nome: 'Omaggi usati in negozio', valore: m.affiliazione.omaggiUsati },
                  { nome: 'Diventate clienti', valore: m.affiliazione.diventateClienti },
                ]} />
              {m.affiliazione.perAffiliato.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/60">
                  <p className="text-xs font-semibold text-text-secondary mb-2">Chi porta più gente</p>
                  <Classifica righe={m.affiliazione.perAffiliato} formato={numero} />
                </div>
              )}
            </Card>

            <Card titolo="Buoni regalo"
              spiega="Venduti nel periodo e valore ancora da scalare. I buoni non usati sono soldi già incassati a fronte di servizi ancora dovuti: prima o poi tornano indietro come lavoro.">
              <Classifica formato={numero}
                righe={[
                  { nome: 'Buoni venduti', valore: m.buoni.venduti },
                  { nome: 'Già usati (anche in parte)', valore: m.buoni.usati },
                ]} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg-tertiary/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Valore venduto</p>
                  <p className="text-lg font-display font-bold text-text-primary mt-1">{eur(m.buoni.valoreVenduto)}</p>
                </div>
                <div className="rounded-xl bg-bg-tertiary/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Ancora da scalare</p>
                  <p className="text-lg font-display font-bold text-warning mt-1">{eur(m.buoni.valoreResiduo)}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card titolo="Chi richiamare, in ordine di valore"
            spiega="Clienti ferme da più di 60 giorni, ordinate per quanto hanno speso in passato. Partire da qui rende molto più che cercare contatti nuovi: queste persone ti conoscono già.">
            <DaRiattivare righe={m.daRiattivare} />
          </Card>
        </>
      )}

      {/* ===== Campagna inaugurazione (dati complessivi, non filtrati) ===== */}
      <div className="space-y-4 pt-2">
        <div>
          <h3 className="text-base font-display font-semibold text-text-primary">Campagna inaugurazione</h3>
          <p className="text-xs text-text-secondary">Il percorso dal coupon alla cliente pagante. Questi numeri sono complessivi, non seguono il filtro qui sopra.</p>
        </div>
        {groups ? (
          <>
            <Imbuto kpis={kpis} />
            <KpiGrid kpis={kpis} />
          </>
        ) : <Caricamento />}
      </div>
    </motion.div>
  );
}
