'use client';

/**
 * Pannello "App Clienti".
 *
 * Da qui si governa tutto quello che l'app fa: quali funzioni sono accese,
 * quanto vale un punto, chi entra in quale livello, quali posti liberi finire
 * in vetrina, quali sfide e quali premi. Nessuno di questi numeri sta nel
 * codice — se cambiare una promozione richiedesse un rilascio, la promozione
 * non si cambierebbe mai.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Smartphone, Settings2, Trophy, Zap, Gift, Users, BarChart3,
  Loader2, Plus, Trash2, Save, RefreshCw, CheckCircle, CalendarClock,
} from 'lucide-react';
import {
  getConfigApp, setConfigApp, getLivelli, salvaLivello, eliminaLivello, ripristinaLivelli,
  getFlashSlot, buchiInAgenda, creaFlashSlot, chiudiFlashSlot,
  getSfide, salvaSfida, eliminaSfida, getPremi, salvaPremio, eliminaPremio,
  getReferral, getStatisticheApp, type LivelloRiga, type SlotRiga,
} from '@/app/actions/appClienti';
import type { ConfigApp } from '@/lib/appSettings';
import type { StatisticheApp } from '@/lib/appAnalytics';
import { getTreatments } from '@/app/actions/treatments';
import { formatCurrency } from '@/lib/helpers';
import SchedaPrenotazione from './SchedaPrenotazione';

type Scheda = 'funzioni' | 'prenotazione' | 'club' | 'flash' | 'sfide' | 'premi' | 'referral' | 'statistiche';

const SCHEDE: { id: Scheda; label: string; icon: React.ElementType }[] = [
  { id: 'funzioni', label: 'Regole e funzioni', icon: Settings2 },
  { id: 'prenotazione', label: 'Prenotazione', icon: CalendarClock },
  { id: 'club', label: 'Beauty Club', icon: Trophy },
  { id: 'flash', label: 'Flash Slot', icon: Zap },
  { id: 'sfide', label: 'Sfide', icon: Trophy },
  { id: 'premi', label: 'Premi', icon: Gift },
  { id: 'referral', label: 'Inviti', icon: Users },
  { id: 'statistiche', label: 'Rendimento', icon: BarChart3 },
];

const NOMI_FUNZIONI: Record<string, string> = {
  wallet: 'Beauty Wallet', club: 'Beauty Club', flashSlot: 'Flash Slot',
  referral: 'Porta un\'amica', challenge: 'Sfide', beautyBox: 'Beauty Box',
  percorsi: 'I miei percorsi', assistente: 'Assistente', giftCard: 'Gift Card',
  prenotaConAmica: 'Prenota con un\'amica',
};

function Campo({ label, valore, onChange, suffisso, aiuto }: {
  label: string; valore: number; onChange: (n: number) => void; suffisso?: string; aiuto?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" value={valore} onChange={e => onChange(Number(e.target.value))}
          className="w-28 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        {suffisso && <span className="text-xs text-text-muted">{suffisso}</span>}
      </div>
      {aiuto && <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{aiuto}</p>}
    </div>
  );
}

export default function AppClientiPage() {
  const [scheda, setScheda] = useState<Scheda>('funzioni');
  const [config, setConfig] = useState<ConfigApp | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { getConfigApp().then(setConfig); }, []);

  const salva = async (parziale: Partial<ConfigApp>) => {
    setSalvando(true);
    try {
      setConfig(await setConfigApp(parziale));
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2500);
    } finally { setSalvando(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">App Clienti</h2>
          <p className="text-sm text-text-secondary">
            Tutto quello che l&apos;app propone alle clienti si decide qui: nessuna promozione richiede di toccare il codice.
          </p>
        </div>
        <a
          href="/dashboard/app-clienti/bacheca"
          className="ml-auto rounded-lg border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black hover:text-white transition-colors"
        >
          ✨ Bacheca e promo
        </a>
        <a
          href="/dashboard/app-clienti/reclami"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black hover:text-white transition-colors"
        >
          🕊️ Reclami anonimi
        </a>
        <a
          href="/dashboard/app-clienti/regali"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black hover:text-white transition-colors"
        >
          🎁 Regali coi punti
        </a>
        <a
          href="/dashboard/app-clienti/percorsi-estetici"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black hover:text-white transition-colors"
        >
          🌿 Percorsi estetici
        </a>
        <a
          href="/dashboard/app-clienti/preparazioni"
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black hover:text-white transition-colors"
        >
          📋 Preparazioni
        </a>
        {salvato && (
          <span className="flex items-center gap-1.5 text-xs text-success font-semibold">
            <CheckCircle className="w-4 h-4" /> Salvato
          </span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto hide-scrollbar p-1 rounded-2xl bg-bg-secondary border border-border">
        {SCHEDE.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setScheda(s.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                scheda === s.id ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'
              }`}>
              <Icon className="w-4 h-4" /> {s.label}
            </button>
          );
        })}
      </div>

      {!config ? (
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carico la configurazione…
        </div>
      ) : (
        <>
          {scheda === 'funzioni' && <SchedaFunzioni config={config} salva={salva} salvando={salvando} />}
          {scheda === 'prenotazione' && <SchedaPrenotazione config={config} salva={salva} salvando={salvando} />}
          {scheda === 'club' && <SchedaClub />}
          {scheda === 'flash' && <SchedaFlash />}
          {scheda === 'sfide' && <SchedaSfide />}
          {scheda === 'premi' && <SchedaPremi />}
          {scheda === 'referral' && <SchedaReferral />}
          {scheda === 'statistiche' && <SchedaStatistiche />}
        </>
      )}
    </motion.div>
  );
}

/* ================= REGOLE E FUNZIONI ================= */

function SchedaFunzioni({ config, salva, salvando }: {
  config: ConfigApp; salva: (p: Partial<ConfigApp>) => Promise<void>; salvando: boolean;
}) {
  const [bozza, setBozza] = useState(config);
  useEffect(() => { setBozza(config); }, [config]);

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Funzioni attive</h3>
        <p className="text-xs text-text-secondary mt-0.5 mb-4">
          Spegnere una funzione la fa sparire dall&apos;app: le clienti non vedono voci vuote.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(bozza.funzioni).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border cursor-pointer hover:bg-bg-hover">
              <input type="checkbox" checked={v} className="accent-current w-4 h-4"
                onChange={e => setBozza({ ...bozza, funzioni: { ...bozza.funzioni, [k]: e.target.checked } })} />
              <span className="text-sm text-text-primary">{NOMI_FUNZIONI[k] ?? k}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-display font-semibold text-text-primary">Punti e cashback</h3>
          <Campo label="Punti per euro speso" valore={bozza.punti.perEuro} suffisso="punti / €"
            onChange={n => setBozza({ ...bozza, punti: { ...bozza.punti, perEuro: n } })} />
          <Campo label="Punti regalo per prenotazione dall'app" valore={bozza.punti.prenotazioneApp} suffisso="punti"
            aiuto="È il modo più diretto per spostare le prenotazioni dal telefono all'app."
            onChange={n => setBozza({ ...bozza, punti: { ...bozza.punti, prenotazioneApp: n } })} />
          <Campo label="Punti necessari per 1 € di credito" valore={bozza.punti.puntiPerEuro} suffisso="punti = 1 €"
            onChange={n => setBozza({ ...bozza, punti: { ...bozza.punti, puntiPerEuro: n } })} />
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={bozza.cashback.attivo} className="accent-current w-4 h-4"
              onChange={e => setBozza({ ...bozza, cashback: { ...bozza.cashback, attivo: e.target.checked } })} />
            <span className="text-sm text-text-primary">Cashback attivo</span>
          </label>
          <Campo label="Cashback base" valore={bozza.cashback.percentualeBase} suffisso="%"
            aiuto="I livelli del Club possono alzarla: vale per chi non ha ancora un livello."
            onChange={n => setBozza({ ...bozza, cashback: { ...bozza.cashback, percentualeBase: n } })} />
          <Campo label="Il cashback scade dopo" valore={bozza.cashback.validoGiorni} suffisso="giorni"
            onChange={n => setBozza({ ...bozza, cashback: { ...bozza.cashback, validoGiorni: n } })} />
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-display font-semibold text-text-primary">Flash Slot</h3>
          <Campo label="Sconto proposto" valore={bozza.flashSlot.scontoPercentuale} suffisso="%"
            onChange={n => setBozza({ ...bozza, flashSlot: { ...bozza.flashSlot, scontoPercentuale: n } })} />
          <Campo label="Resta in vetrina per" valore={bozza.flashSlot.durataMinuti} suffisso="minuti"
            aiuto="La vetrina si chiude comunque all'ora del trattamento."
            onChange={n => setBozza({ ...bozza, flashSlot: { ...bozza.flashSlot, durataMinuti: n } })} />
          <Campo label="Non pubblicare se manca meno di" valore={bozza.flashSlot.anticipoMinimoMinuti} suffisso="minuti"
            aiuto="Il tempo che serve a una cliente per arrivare in negozio."
            onChange={n => setBozza({ ...bozza, flashSlot: { ...bozza.flashSlot, anticipoMinimoMinuti: n } })} />

          <h3 className="text-base font-display font-semibold text-text-primary pt-2">Porta un&apos;amica</h3>
          <Campo label="Credito a chi invita" valore={bozza.referral.premioInvitante} suffisso="€"
            onChange={n => setBozza({ ...bozza, referral: { ...bozza.referral, premioInvitante: n } })} />
          <Campo label="Credito all'amica" valore={bozza.referral.premioInvitata} suffisso="€"
            onChange={n => setBozza({ ...bozza, referral: { ...bozza.referral, premioInvitata: n } })} />
          <Campo label="Massimo inviti per cliente" valore={bozza.referral.maxInviti} suffisso="inviti"
            aiuto="Un tetto serve: senza, il referral diventa una macchina per fabbricare credito."
            onChange={n => setBozza({ ...bozza, referral: { ...bozza.referral, maxInviti: n } })} />
        </div>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <label className="block text-xs font-medium text-text-secondary mb-1">Messaggio in Home</label>
        <input value={bozza.home.messaggio} onChange={e => setBozza({ ...bozza, home: { ...bozza.home, messaggio: e.target.value } })}
          placeholder="Es. Da lunedì siamo aperti anche il sabato pomeriggio"
          className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        <p className="text-[11px] text-text-muted mt-1">Compare sotto il saluto. Lascialo vuoto per non mostrare niente.</p>
      </div>

      <button onClick={() => salva(bozza)} disabled={salvando}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva le regole
      </button>
    </div>
  );
}

/* ================= BEAUTY CLUB ================= */

function SchedaClub() {
  const [righe, setRighe] = useState<LivelloRiga[] | null>(null);
  const carica = useCallback(() => { getLivelli().then(setRighe); }, []);
  useEffect(carica, [carica]);

  const aggiorna = (i: number, patch: Partial<LivelloRiga>) => {
    if (!righe) return;
    const copia = [...righe];
    copia[i] = { ...copia[i], ...patch };
    setRighe(copia);
  };

  if (!righe) return <div className="py-16 text-center text-text-muted text-sm">Carico i livelli…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={async () => { await salvaLivello({ name: 'Nuovo livello', sortOrder: righe.length + 1 }); carica(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
          <Plus className="w-3.5 h-3.5" /> Aggiungi livello
        </button>
        <button onClick={async () => { if (confirm('Ricreare i quattro livelli di partenza? Quelli attuali verranno cancellati.')) { await ripristinaLivelli(); carica(); } }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
          <RefreshCw className="w-3.5 h-3.5" /> Ripristina i predefiniti
        </button>
      </div>

      {righe.map((l, i) => (
        <div key={l.id} className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="color" value={l.color} onChange={e => aggiorna(i, { color: e.target.value })}
              className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
            <input value={l.name} onChange={e => aggiorna(i, { name: e.target.value })}
              className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary" />
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={l.isActive} onChange={e => aggiorna(i, { isActive: e.target.checked })} className="accent-current w-4 h-4" />
              attivo
            </label>
            <div className="flex-1" />
            <button onClick={async () => { await salvaLivello(l); carica(); }}
              className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold">Salva</button>
            <button onClick={async () => { if (confirm(`Eliminare il livello ${l.name}?`)) { await eliminaLivello(l.id); carica(); } }}
              className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error/10"><Trash2 className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Campo label="Da spesa" valore={l.minSpent} suffisso="€" onChange={n => aggiorna(i, { minSpent: n })} />
            <Campo label="oppure da visite" valore={l.minVisits} suffisso="visite" onChange={n => aggiorna(i, { minVisits: n })} />
            <Campo label="Cashback" valore={l.cashbackPct} suffisso="%" onChange={n => aggiorna(i, { cashbackPct: n })} />
            <Campo label="Punti moltiplicati" valore={l.pointsFactor} suffisso="×" onChange={n => aggiorna(i, { pointsFactor: n })} />
            <Campo label="Anticipo Flash Slot" valore={l.flashHeadMin} suffisso="min" onChange={n => aggiorna(i, { flashHeadMin: n })} />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Vantaggi mostrati nell&apos;app (uno per riga)</label>
            <textarea value={l.perks.join('\n')} rows={3}
              onChange={e => aggiorna(i, { perks: e.target.value.split('\n').filter(x => x.trim()) })}
              className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary resize-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= FLASH SLOT ================= */

function SchedaFlash() {
  const [slot, setSlot] = useState<SlotRiga[] | null>(null);
  const [buchi, setBuchi] = useState<Awaited<ReturnType<typeof buchiInAgenda>> | null>(null);
  const [trattamenti, setTrattamenti] = useState<{ id: string; name: string }[]>([]);
  const [scelto, setScelto] = useState('');
  const [occupato, setOccupato] = useState('');

  const carica = useCallback(() => {
    getFlashSlot().then(setSlot);
    buchiInAgenda().then(setBuchi);
    getTreatments().then(t => setTrattamenti(t.map(x => ({ id: x.id, name: x.name }))));
  }, []);
  useEffect(carica, [carica]);

  const pubblica = async (b: NonNullable<typeof buchi>[number]) => {
    if (!scelto) { alert('Scegli prima quale trattamento offrire in quella fascia.'); return; }
    setOccupato(b.date + b.startTime);
    try {
      await creaFlashSlot({
        date: b.date, startTime: b.startTime, endTime: b.endTime,
        treatmentId: scelto, operatorId: b.operatorId, operatorName: b.operatorName,
      });
      carica();
    } finally { setOccupato(''); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Buchi in agenda</h3>
        <p className="text-xs text-text-secondary mt-0.5 mb-3">
          Fasce libere fra due appuntamenti nei prossimi giorni: sono quelle che non si riempiono da sole.
          Scegli il trattamento da offrire e mandale in vetrina nell&apos;app.
        </p>
        <select value={scelto} onChange={e => setScelto(e.target.value)}
          className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary mb-3">
          <option value="">Trattamento da offrire…</option>
          {trattamenti.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {!buchi ? <p className="text-sm text-text-muted">Cerco…</p>
          : buchi.length === 0 ? <p className="text-sm text-text-muted">Nessun buco: l&apos;agenda è compatta.</p>
          : (
            <div className="space-y-2">
              {buchi.map(b => (
                <div key={b.date + b.startTime + b.operatorId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      {new Date(b.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · {b.startTime}–{b.endTime}
                    </p>
                    <p className="text-[11px] text-text-muted">{b.operatorName} · {b.minuti} minuti liberi</p>
                  </div>
                  <button onClick={() => pubblica(b)} disabled={occupato === b.date + b.startTime}
                    className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold disabled:opacity-50">
                    {occupato === b.date + b.startTime ? '…' : 'Metti in vetrina'}
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Slot pubblicati</h3>
        {!slot ? <p className="text-sm text-text-muted mt-2">Carico…</p>
          : slot.length === 0 ? <p className="text-sm text-text-muted mt-2">Ancora nessuno.</p>
          : (
            <div className="mt-3 space-y-2">
              {slot.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{s.treatmentName} · {s.date.slice(8)}/{s.date.slice(5, 7)} {s.startTime}</p>
                    <p className="text-[11px] text-text-muted">
                      {s.operatorName} · {formatCurrency(s.fullPrice)} → <b>{formatCurrency(s.price)}</b>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                    s.status === 'taken' ? 'bg-success/15 text-success'
                      : s.status === 'open' ? 'bg-warning/15 text-warning'
                      : 'bg-bg-tertiary text-text-muted'
                  }`}>
                    {s.status === 'taken' ? 'preso' : s.status === 'open' ? 'in vetrina' : s.status === 'expired' ? 'scaduto' : 'chiuso'}
                  </span>
                  {s.status === 'open' && (
                    <button onClick={async () => { await chiudiFlashSlot(s.id); getFlashSlot().then(setSlot); }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

/* ================= SFIDE ================= */

const TIPI_OBIETTIVO: { v: string; l: string }[] = [
  { v: 'appointments', l: 'Appuntamenti completati' },
  { v: 'bookings_app', l: 'Prenotazioni dall\'app' },
  { v: 'referrals', l: 'Amiche portate' },
  { v: 'spend', l: 'Euro spesi' },
];

function SchedaSfide() {
  const [righe, setRighe] = useState<Awaited<ReturnType<typeof getSfide>> | null>(null);
  const carica = useCallback(() => { getSfide().then(setRighe); }, []);
  useEffect(carica, [carica]);

  const nuova = async () => {
    const oggi = new Date().toISOString().slice(0, 10);
    const fra60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    await salvaSfida({
      title: 'Nuova sfida', description: 'Descrivi cosa deve fare la cliente',
      goalType: 'appointments', goalCount: 3,
      rewardType: 'credit', rewardValue: 10, rewardLabel: '10 € di credito',
      startsAt: oggi, endsAt: fra60, isActive: false,
    });
    carica();
  };

  if (!righe) return <div className="py-16 text-center text-text-muted text-sm">Carico le sfide…</div>;

  return (
    <div className="space-y-3">
      <button onClick={nuova} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
        <Plus className="w-3.5 h-3.5" /> Nuova sfida
      </button>

      {righe.length === 0 && <p className="text-sm text-text-muted py-6">Nessuna sfida. Creane una per dare alle clienti un motivo per tornare.</p>}

      {righe.map(c => <RigaSfida key={c.id} c={c} onSalvata={carica} />)}
    </div>
  );
}

function RigaSfida({ c, onSalvata }: { c: Awaited<ReturnType<typeof getSfide>>[number]; onSalvata: () => void }) {
  const [b, setB] = useState(c);
  useEffect(() => { setB(c); }, [c]);

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={b.title} onChange={e => setB({ ...b, title: e.target.value })}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary" />
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={b.isActive} onChange={e => setB({ ...b, isActive: e.target.checked })} className="accent-current w-4 h-4" /> attiva
        </label>
        <span className="text-[11px] text-text-muted">{b.partecipanti} partecipanti</span>
        <button onClick={async () => { await salvaSfida(b); onSalvata(); }} className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold">Salva</button>
        <button onClick={async () => { if (confirm(`Eliminare "${b.title}"?`)) { await eliminaSfida(b.id); onSalvata(); } }}
          className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error/10"><Trash2 className="w-4 h-4" /></button>
      </div>

      <input value={b.description} onChange={e => setB({ ...b, description: e.target.value })}
        placeholder="Descrizione mostrata nell'app"
        className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Obiettivo</label>
          <select value={b.goalType} onChange={e => setB({ ...b, goalType: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
            {TIPI_OBIETTIVO.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <Campo label="Quanti" valore={b.goalCount} onChange={n => setB({ ...b, goalCount: n })} />
        <Campo label="Valore premio" valore={b.rewardValue} suffisso={b.rewardType === 'credit' ? '€' : 'punti'}
          onChange={n => setB({ ...b, rewardValue: n })} />
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Tipo premio</label>
          <select value={b.rewardType} onChange={e => setB({ ...b, rewardType: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
            <option value="credit">Credito</option>
            <option value="points">Punti</option>
            <option value="prize">Beauty Box</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Dal</label>
          <input type="date" value={b.startsAt} onChange={e => setB({ ...b, startsAt: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Al</label>
          <input type="date" value={b.endsAt} onChange={e => setB({ ...b, endsAt: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Premio scritto nell&apos;app</label>
          <input value={b.rewardLabel} onChange={e => setB({ ...b, rewardLabel: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        </div>
      </div>
    </div>
  );
}

/* ================= PREMI ================= */

function SchedaPremi() {
  const [righe, setRighe] = useState<Awaited<ReturnType<typeof getPremi>> | null>(null);
  const carica = useCallback(() => { getPremi().then(setRighe); }, []);
  useEffect(carica, [carica]);

  if (!righe) return <div className="py-16 text-center text-text-muted text-sm">Carico i premi…</div>;

  return (
    <div className="space-y-3">
      <button onClick={async () => { await salvaPremio({ name: 'Nuovo premio', kind: 'credit', value: 5, weight: 10, stock: null, validDays: 30, isActive: false }); carica(); }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
        <Plus className="w-3.5 h-3.5" /> Nuovo premio
      </button>

      <p className="text-xs text-text-secondary">
        Il peso non è una percentuale: è quanto quel premio &quot;pesa&quot; nell&apos;estrazione rispetto agli altri.
        Aggiungerne uno non obbliga a ribilanciare tutto. La probabilità reale è calcolata a fianco.
      </p>

      {righe.map(p => <RigaPremio key={p.id} p={p} onSalvato={carica} />)}
    </div>
  );
}

function RigaPremio({ p, onSalvato }: { p: Awaited<ReturnType<typeof getPremi>>[number]; onSalvato: () => void }) {
  const [b, setB] = useState(p);
  useEffect(() => { setB(p); }, [p]);

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input value={b.name} onChange={e => setB({ ...b, name: e.target.value })}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary" />
        <span className="text-xs font-bold text-accent">{b.probabilita}% di uscire</span>
        <span className="text-[11px] text-text-muted">{b.vinti} vinti</span>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={b.isActive} onChange={e => setB({ ...b, isActive: e.target.checked })} className="accent-current w-4 h-4" /> attivo
        </label>
        <button onClick={async () => { await salvaPremio(b); onSalvato(); }} className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold">Salva</button>
        <button onClick={async () => { if (confirm(`Eliminare "${b.name}"?`)) { await eliminaPremio(b.id); onSalvato(); } }}
          className="p-2 rounded-xl text-text-muted hover:text-error hover:bg-error/10"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
          <select value={b.kind} onChange={e => setB({ ...b, kind: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary">
            <option value="credit">Credito</option>
            <option value="points">Punti</option>
            <option value="free_treatment">Trattamento omaggio</option>
            <option value="discount">Sconto</option>
          </select>
        </div>
        <Campo label="Valore" valore={b.value} onChange={n => setB({ ...b, value: n })} />
        <Campo label="Peso" valore={b.weight} onChange={n => setB({ ...b, weight: n })} />
        <Campo label="Pezzi (0 = illimitati)" valore={b.stock ?? 0} onChange={n => setB({ ...b, stock: n === 0 ? null : n })} />
        <Campo label="Valido per" valore={b.validDays} suffisso="giorni" onChange={n => setB({ ...b, validDays: n })} />
      </div>
    </div>
  );
}

/* ================= INVITI ================= */

function SchedaReferral() {
  const [righe, setRighe] = useState<Awaited<ReturnType<typeof getReferral>> | null>(null);
  useEffect(() => { getReferral().then(setRighe); }, []);

  if (!righe) return <div className="py-16 text-center text-text-muted text-sm">Carico gli inviti…</div>;
  if (!righe.length) return <p className="text-sm text-text-muted py-6">Ancora nessun invito.</p>;

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
            <th className="px-5 py-3 font-semibold">Chi ha invitato</th>
            <th className="px-3 py-3 font-semibold">Amica</th>
            <th className="px-3 py-3 font-semibold">Telefono</th>
            <th className="px-3 py-3 font-semibold">Stato</th>
            <th className="px-5 py-3 font-semibold">Quando</th>
          </tr>
        </thead>
        <tbody>
          {righe.map(r => (
            <tr key={r.id} className="border-b border-border/30">
              <td className="px-5 py-2.5 text-text-primary">{r.invitante}</td>
              <td className="px-3 py-2.5 text-text-secondary">{r.invitata}</td>
              <td className="px-3 py-2.5 text-text-muted font-mono text-xs">{r.telefono}</td>
              <td className="px-3 py-2.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                  r.stato === 'converted' ? 'bg-success/15 text-success' : 'bg-bg-tertiary text-text-muted'
                }`}>{r.stato === 'converted' ? 'diventata cliente' : r.stato === 'registered' ? 'registrata' : 'invitata'}</span>
              </td>
              <td className="px-5 py-2.5 text-text-muted text-xs">{r.quando.slice(0, 10).split('-').reverse().join('/')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= RENDIMENTO ================= */

function SchedaStatistiche() {
  const [s, setS] = useState<StatisticheApp | null>(null);
  useEffect(() => { getStatisticheApp(30).then(setS); }, []);

  if (!s) return <div className="py-16 text-center text-text-muted text-sm">Calcolo…</div>;

  const numeri = [
    { l: 'Clienti attive oggi', v: String(s.attiviOggi) },
    { l: `Attive negli ultimi ${s.giorni} giorni`, v: String(s.attiviPeriodo) },
    { l: 'Hanno l\'app', v: `${s.conAccount} su ${s.clientiTotali}`, s: `${s.copertura}% della rubrica` },
    { l: 'Prenotazioni dall\'app', v: String(s.prenotazioniApp) },
    { l: 'Fatturato attribuito', v: formatCurrency(s.fatturatoApp), s: 'incassi veri di cassa' },
    { l: 'Credito in circolazione', v: formatCurrency(s.wallet.inCircolazione), s: `${formatCurrency(s.wallet.inScadenza30)} scade entro 30 gg` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {numeri.map(n => (
          <div key={n.l} className="bg-bg-secondary border border-border rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold leading-tight">{n.l}</p>
            <p className="text-2xl font-display font-bold text-text-primary mt-1.5">{n.v}</p>
            {n.s && <p className="text-xs text-text-muted mt-0.5">{n.s}</p>}
          </div>
        ))}
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary">Dall&apos;occhiata alla prenotazione</h3>
        <p className="text-xs text-text-secondary mt-0.5 mb-3">
          Quante volte ogni parte dell&apos;app viene vista, toccata e quante volte porta a una prenotazione.
          Una funzione molto vista e mai toccata va riscritta; una molto toccata e mai conclusa va resa più facile.
        </p>
        {s.imbuto.length === 0 ? (
          <p className="text-sm text-text-muted">Ancora nessun dato: si riempie appena le clienti iniziano a usare l&apos;app.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border/60">
                  <th className="py-2 pr-3 font-semibold">Sezione</th>
                  <th className="py-2 px-3 font-semibold text-right">Viste</th>
                  <th className="py-2 px-3 font-semibold text-right">Tocchi</th>
                  <th className="py-2 px-3 font-semibold text-right">Prenotazioni</th>
                  <th className="py-2 px-3 font-semibold text-right">Vista → tocco</th>
                  <th className="py-2 pl-3 font-semibold text-right">Valore</th>
                </tr>
              </thead>
              <tbody>
                {s.imbuto.map(r => (
                  <tr key={r.superficie} className="border-b border-border/30">
                    <td className="py-2.5 pr-3 text-text-primary font-medium">{r.etichetta}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.viste}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.tocchi}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-primary font-semibold">{r.prenotazioni}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{r.tassoTocco}%</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-accent font-semibold">{formatCurrency(r.valore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary">Flash Slot</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex justify-between"><span className="text-text-secondary">Pubblicati</span><b className="text-text-primary">{s.flash.pubblicati}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Presi</span><b className="text-success">{s.flash.presi}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Scaduti senza risposta</span><b className="text-text-muted">{s.flash.scaduti}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Ore recuperate, in euro</span><b className="text-accent">{formatCurrency(s.flash.valore)}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Tasso di riempimento</span><b className="text-text-primary">{s.flash.tassoRiempimento}%</b></p>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-base font-display font-semibold text-text-primary">Inviti e livelli</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex justify-between"><span className="text-text-secondary">Amiche invitate</span><b className="text-text-primary">{s.referral.inviti}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Diventate clienti</span><b className="text-success">{s.referral.convertiti}</b></p>
            <p className="flex justify-between"><span className="text-text-secondary">Credito riconosciuto</span><b className="text-text-primary">{formatCurrency(s.referral.creditoPagato)}</b></p>
          </div>
          <div className="mt-4 space-y-1.5">
            {s.club.map(l => (
              <div key={l.nome} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.colore }} />
                <span className="text-sm text-text-secondary flex-1">{l.nome}</span>
                <b className="text-sm text-text-primary">{l.clienti}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
