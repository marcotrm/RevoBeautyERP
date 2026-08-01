'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Euro, Users, Calendar, Package, Gift, UserCog, Loader2, Info, BarChart3, Boxes, TrendingUp, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { getBusinessKPIs, type KpiGroup, type Kpi } from '@/app/actions/businessStats';
import { classificaUpsell, type RigaClassificaUpsell } from '@/app/actions/upsell';

const ICONS: Record<string, React.ElementType> = {
  euro: Euro, users: Users, calendar: Calendar, package: Package, gift: Gift, staff: UserCog, box: Boxes,
};

const TONE: Record<string, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-error',
  neutral: 'text-text-primary',
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative bg-bg-secondary border border-border rounded-2xl p-4 hover:border-accent/40 transition-all group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{kpi.label}</p>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="text-text-muted hover:text-accent transition-colors flex-shrink-0"
          aria-label="Cosa significa"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className={`text-2xl font-display font-bold mt-1.5 ${TONE[kpi.tone || 'neutral']}`}>{kpi.value}</p>
      {kpi.sub && <p className="text-xs text-text-muted mt-0.5">{kpi.sub}</p>}

      {/* Legenda / spiegazione */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 p-3 rounded-xl bg-bg-primary border border-border shadow-2xl">
          <p className="text-xs text-text-secondary leading-relaxed">{kpi.hint}</p>
        </div>
      )}
    </div>
  );
}

export default function StatistichePage() {
  const [groups, setGroups] = useState<KpiGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getBusinessKPIs()
      .then(setGroups)
      .catch(e => { console.error(e); setError('Impossibile caricare le statistiche.'); });
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Statistiche</h2>
          <p className="text-sm text-text-secondary">Tutti i numeri del centro, calcolati sui dati reali. Passa sopra una scheda (o tocca ⓘ) per la spiegazione.</p>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">{error}</div>}

      {!groups && !error && (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcolo delle statistiche...
        </div>
      )}

      {groups?.map(group => {
        const Icon = ICONS[group.icon] || BarChart3;
        return (
          <div key={group.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-accent" />
              <h3 className="text-base font-display font-semibold text-text-primary">{group.title}</h3>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {group.kpis.map(k => <KpiCard key={k.key} kpi={k} />)}
            </div>
          </div>
        );
      })}

      <ClassificaUpsell />
    </motion.div>
  );
}

// ============================================================
// Classifica upsell: chi vende trattamenti in più mentre la
// cliente è già in cabina. I dati nascono in agenda, dal
// "+ Aggiungi" del pannello appuntamento dopo il check-in.
// ============================================================

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const MEDAGLIE = ['🥇', '🥈', '🥉'];

function ClassificaUpsell() {
  // Mese mostrato: primo giorno del mese, in ora italiana
  const [mese, setMese] = useState(() => {
    const oggi = new Date();
    return new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  });
  const [dati, setDati] = useState<{ periodo: string; righe: RigaClassificaUpsell[] } | null>(null);
  const [aperta, setAperta] = useState('');

  const dal = `${mese.getFullYear()}-${String(mese.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoGiorno = new Date(mese.getFullYear(), mese.getMonth() + 1, 0).getDate();
  const al = `${mese.getFullYear()}-${String(mese.getMonth() + 1).padStart(2, '0')}-${String(ultimoGiorno).padStart(2, '0')}`;

  useEffect(() => {
    const periodo = dal;
    classificaUpsell(dal, al)
      .then(righe => setDati({ periodo, righe }))
      .catch(() => setDati({ periodo, righe: [] }));
  }, [dal, al]);

  // Dati del mese mostrato: se non sono ancora arrivati, si vede il caricamento
  const righe = dati?.periodo === dal ? dati.righe : null;

  const titoloMese = mese.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent" />
        <h3 className="text-base font-display font-semibold text-text-primary">Classifica Upsell</h3>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1">
          <button onClick={() => setMese(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-text-primary capitalize min-w-[130px] text-center">{titoloMese}</span>
          <button onClick={() => setMese(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="text-xs text-text-secondary -mt-1">
        Tutto quello che le estetiste vendono in più: trattamenti aggiunti quando la cliente era già in cabina
        (dall&apos;agenda, dopo il check-in) e prodotti battuti in cassa — creme, kit, cosmetici.
      </p>

      {righe === null ? (
        <div className="flex items-center py-8 text-text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calcolo…</div>
      ) : righe.length === 0 ? (
        <div className="p-5 rounded-2xl border border-border bg-bg-secondary text-sm text-text-secondary">
          Nessun upsell registrato in questo mese. Quando un&apos;estetista aggiunge un trattamento a una cliente già in cabina, compare qui.
        </div>
      ) : (
        <div className="space-y-2">
          {righe.map((r, i) => (
            <div key={r.operatorId} className="rounded-2xl border border-border bg-bg-secondary overflow-hidden">
              <button onClick={() => setAperta(a => a === r.operatorId ? '' : r.operatorId)}
                className="w-full flex items-center gap-3 p-4 hover:bg-bg-hover transition-colors text-left">
                <span className="text-xl w-8 text-center flex-shrink-0">{MEDAGLIE[i] || `${i + 1}°`}</span>
                <span className="flex-1 font-bold text-text-primary">{r.nome}</span>
                <span className="text-sm text-text-secondary"><b className="text-text-primary">{r.numero}</b> upsell</span>
                <span className="text-sm font-bold text-accent min-w-[90px] text-right">{eur(r.valore)}</span>
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${aperta === r.operatorId ? 'rotate-180' : ''}`} />
              </button>
              {aperta === r.operatorId && (
                <div className="px-4 pb-4 space-y-1.5">
                  {r.voci.map((v, j) => (
                    <div key={j} className="flex items-center gap-3 text-xs text-text-secondary rounded-lg bg-bg-tertiary/40 px-3 py-2">
                      <span className="text-text-muted">{new Date(v.data + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</span>
                      <span className="flex-shrink-0">{v.tipo === 'prodotto' ? '🧴' : '💆'}</span>
                      <span className="flex-1 truncate"><b className="text-text-primary">{v.cliente}</b> · {v.trattamento}</span>
                      <span className="font-semibold text-text-primary">{eur(v.prezzo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
