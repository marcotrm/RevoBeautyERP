'use client';

/**
 * Le regole della caparra.
 *
 * Il buco in agenda e' il costo piu' alto che c'e' e non si vede: l'ora resta
 * vuota, l'operatrice e' pagata lo stesso, e chi voleva quel posto ha gia'
 * prenotato altrove. Qui si decide a chi chiedere qualcosa in anticipo.
 *
 * Il consiglio, scritto anche a schermo: cominciare da chi ha gia' saltato.
 * Chiedere una caparra a tutte, dal primo giorno, allontana clienti che non
 * ti hanno mai dato problemi.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { regoleCaparra, salvaRegoleCaparra } from '@/app/actions/caparra';
import { REGOLE_CAPARRA_DEFAULT, type RegoleCaparra } from '@/lib/caparra';

const A_CHI: { valore: RegoleCaparra['aChi']; titolo: string; sotto: string }[] = [
  { valore: 'inaffidabili', titolo: 'Solo a chi ha già saltato', sotto: 'chi non si è mai presentato almeno una volta — è da qui che conviene partire' },
  { valore: 'nuove', titolo: 'Solo alle clienti nuove', sotto: 'chi non è mai venuta: non sai ancora se verrà' },
  { valore: 'categorie', titolo: 'Solo per certi trattamenti', sotto: 'quelli lunghi o con la macchina occupata, tipo il laser' },
  { valore: 'tutte', titolo: 'A tutte', sotto: 'sopra il conto minimo, sempre' },
];

const CATEGORIE = [
  ['laser', 'Laser'], ['face', 'Viso'], ['body', 'Corpo'],
  ['nails', 'Unghie'], ['hair', 'Capelli'], ['massage', 'Massaggi'],
] as const;

export function CaparraConfig() {
  const [r, setR] = useState<RegoleCaparra>(REGOLE_CAPARRA_DEFAULT);
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    let vivo = true;
    regoleCaparra()
      .then(x => { if (vivo) { setR(x); setCaricato(true); } })
      .catch(() => { if (vivo) setCaricato(true); });
    return () => { vivo = false; };
  }, []);

  const salva = async () => {
    setSalvando(true);
    try {
      await salvaRegoleCaparra(r);
      setFatto(true);
      setTimeout(() => setFatto(false), 2500);
    } finally { setSalvando(false); }
  };

  const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);

  if (!caricato) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Carico le regole…
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Caparra</h3>
            <p className="text-xs text-text-muted">Chi lascia qualcosa, viene. È l’unica cosa che riduce davvero i buchi.</p>
          </div>
        </div>
        <button onClick={() => setR(p => ({ ...p, attiva: !p.attiva }))}
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${r.attiva ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${r.attiva ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {!r.attiva && (
        <p className="text-xs text-text-muted">
          Spenta: nessuno si vede chiedere niente. Puoi comunque chiedere una caparra a mano su un singolo appuntamento.
        </p>
      )}

      {r.attiva && (
        <>
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">A chi si chiede</p>
            <div className="space-y-1.5">
              {A_CHI.map(o => (
                <button key={o.valore} onClick={() => setR(p => ({ ...p, aChi: o.valore }))}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                    r.aChi === o.valore ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-hover'}`}>
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${r.aChi === o.valore ? 'border-accent bg-accent' : 'border-border'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">{o.titolo}</span>
                    <span className="block text-[11px] text-text-muted">{o.sotto}</span>
                  </span>
                </button>
              ))}
            </div>
            {r.aChi === 'categorie' && (
              <div className="flex flex-wrap gap-2 mt-2.5 pl-3">
                {CATEGORIE.map(([k, label]) => {
                  const presa = r.categorie.includes(k);
                  return (
                    <button key={k}
                      onClick={() => setR(p => ({ ...p, categorie: presa ? p.categorie.filter(c => c !== k) : [...p.categorie, k] }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        presa ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Quanto</label>
              <div className="flex gap-2">
                <input type="text" inputMode="decimal" value={String(r.importo)}
                  onChange={e => setR(p => ({ ...p, importo: num(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <div className="flex rounded-xl border border-border overflow-hidden flex-shrink-0">
                  {(['fissa', 'percentuale'] as const).map(t => (
                    <button key={t} onClick={() => setR(p => ({ ...p, tipo: t }))}
                      className={`px-3 text-sm font-semibold ${r.tipo === t ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary'}`}>
                      {t === 'fissa' ? '€' : '%'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Solo da questo conto in su</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={String(r.minimoConto)}
                  onChange={e => setR(p => ({ ...p, minimoConto: num(e.target.value) }))}
                  className="w-full pl-3 pr-7 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">per una ceretta da 15 € chiederla è un’offesa</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Deve arrivare entro</label>
              <div className="relative">
                <input type="text" inputMode="numeric" value={String(r.oreValidita)}
                  onChange={e => setR(p => ({ ...p, oreValidita: num(e.target.value) }))}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">ore</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Si può disdire fino a</label>
              <div className="relative">
                <input type="text" inputMode="numeric" value={String(r.oreDisdetta)}
                  onChange={e => setR(p => ({ ...p, oreDisdetta: num(e.target.value) }))}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-semibold text-text-primary text-right focus:outline-none focus:border-accent/60" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">ore prima</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">più tardi di così, la caparra la puoi trattenere</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Il tuo link di pagamento</label>
            <input type="text" value={r.linkPagamento} placeholder="https://…  (Satispay, PayPal.me, il tuo link)"
              onChange={e => setR(p => ({ ...p, linkPagamento: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
              Nessuna carta passa dal gestionale: si manda il tuo link e chi è al banco segna quando i soldi arrivano.
              Il tuo profilo Satispay Business va benissimo — è quello che le clienti hanno già sul telefono.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Il messaggio (facoltativo)</label>
            <textarea rows={3} value={r.messaggio}
              onChange={e => setR(p => ({ ...p, messaggio: e.target.value }))}
              placeholder="Lascia vuoto per usare il testo standard"
              className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60 resize-none" />
            <p className="text-[10px] text-text-muted mt-1">
              Puoi usare {'{nome}'}, {'{importo}'}, {'{quando}'}, {'{link}'}, {'{ore}'}.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
            <p className="text-[11px] text-text-secondary leading-relaxed">
              <strong className="text-text-primary">Come vanno i conti.</strong> La caparra entra in cassa il giorno in cui
              arriva, non il giorno del trattamento: è quello il giorno in cui i soldi ci sono. Alla seduta si incassa solo
              il resto, e lo scontrino fiscale esce lì. Se la cliente non si presenta, decidi tu se trattenerla — dal
              pannello dell’appuntamento.
            </p>
          </div>
        </>
      )}

      <button onClick={salva} disabled={salvando}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {fatto ? 'Salvato' : 'Salva le regole'}
      </button>
    </div>
  );
}
