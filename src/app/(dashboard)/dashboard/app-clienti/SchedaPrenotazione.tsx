'use client';

/**
 * App Clienti → Prenotazione.
 *
 * Tutto quello che decide cosa vede la cliente quando prenota dall'app (e
 * dalla pagina web): fin dove si può prenotare, e chi fa cosa.
 *
 * Prima era sparso: gli orari erano scritti nel codice, il collegamento
 * operatrice/categoria stava dentro la scheda di ogni operatrice in Staff.
 * Per capire perché una cliente vedeva un certo orario bisognava guardare in
 * tre posti. Ora si guarda qui.
 *
 * Resta fuori una cosa sola, e di proposito: i turni. Quelli sono
 * organizzazione del personale, non configurazione dell'app, e vivono in
 * Staff → Turni. Qui sotto c'è il collegamento.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Clock, Users, Loader2, Save, CheckCircle, ExternalLink, AlertTriangle, Check,
} from 'lucide-react';

import { getOperators, updateOperator } from '@/app/actions/operators';
import { getTreatments } from '@/app/actions/treatments';
import { compressImage } from '@/lib/imageCompress';
import { getInitials } from '@/lib/helpers';
import type { ConfigApp } from '@/lib/appSettings';
import type { Operator, TreatmentCategory } from '@/types';
import { CATEGORIE } from '../staff/CompetenzeEditor';

/* ============================ ORARI ============================ */

function Numero({ label, valore, onChange, suffisso, aiuto, min = 0, max = 999 }: {
  label: string; valore: number; onChange: (n: number) => void;
  suffisso?: string; aiuto?: string; min?: number; max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} max={max} value={valore}
          onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="w-24 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
        {suffisso && <span className="text-xs text-text-muted">{suffisso}</span>}
      </div>
      {aiuto && <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{aiuto}</p>}
    </div>
  );
}

function BloccoOrari({ config, salva, salvando }: {
  config: ConfigApp; salva: (p: Partial<ConfigApp>) => Promise<void>; salvando: boolean;
}) {
  // La bozza parte dai valori salvati e li segue solo al montaggio: dopo un
  // salvataggio i due coincidono già, e risincronizzare a ogni render
  // cancellerebbe quello che si sta scrivendo.
  const [bozza, setBozza] = useState(config.prenotazione);

  const cambia = <K extends keyof typeof bozza>(k: K, v: (typeof bozza)[K]) =>
    setBozza(p => ({ ...p, [k]: v }));

  const orariStorti = bozza.chiusura <= bozza.apertura;

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-accent" />
        <h3 className="text-base font-display font-semibold text-text-primary">Quando si può prenotare</h3>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        La cornice entro cui il sistema propone gli orari. Dentro questa cornice comandano
        i turni delle operatrici: se Rosaria stacca alle 14, alle 15 non compare comunque.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Apertura</label>
          <input type="time" value={bozza.apertura} onChange={e => cambia('apertura', e.target.value)}
            className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          <p className="text-[11px] text-text-muted mt-1">Nessun orario prima di quest&apos;ora.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Chiusura</label>
          <input type="time" value={bozza.chiusura} onChange={e => cambia('chiusura', e.target.value)}
            className="px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary" />
          <p className="text-[11px] text-text-muted mt-1">La seduta deve <b>finire</b> entro quest&apos;ora.</p>
        </div>
        <Numero label="Ogni quanto un orario" valore={bozza.passoMinuti} min={5} max={60} suffisso="minuti"
          onChange={n => cambia('passoMinuti', n)}
          aiuto="15 propone 9:00, 9:15, 9:30… 30 dimezza gli orari mostrati." />
        <Numero label="Preavviso minimo" valore={bozza.preavvisoMinuti} min={0} max={1440} suffisso="minuti"
          onChange={n => cambia('preavvisoMinuti', n)}
          aiuto="Per oggi: quanto tempo deve mancare. A 60, alle 16 il primo orario è le 17." />
        <Numero label="Quanto avanti si prenota" valore={bozza.giorniAvanti} min={1} max={90} suffisso="giorni"
          onChange={n => cambia('giorniAvanti', n)}
          aiuto="Fin dove la cliente può spingersi cercando un posto." />
      </div>

      {orariStorti && (
        <p className="flex items-center gap-1.5 text-[11px] text-error mt-3">
          <AlertTriangle className="w-3.5 h-3.5" /> La chiusura deve venire dopo l&apos;apertura.
        </p>
      )}

      <div className="flex justify-end mt-4">
        <button onClick={() => salva({ prenotazione: bozza })} disabled={salvando || orariStorti}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva
        </button>
      </div>
    </div>
  );
}

/* ========================= CHI FA COSA ========================= */

function Cerchio({ op, size = 40 }: { op: Operator; size?: number }) {
  return (
    <span className="rounded-full overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ backgroundColor: op.color, width: size, height: size, fontSize: size / 3 }}>
      {op.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={op.avatar} alt="" className="w-full h-full object-cover" />
        : getInitials(op.firstName, op.lastName)}
    </span>
  );
}

function BloccoChiFaCosa() {
  const [operatrici, setOperatrici] = useState<Operator[] | null>(null);
  const [categorieUsate, setCategorieUsate] = useState<string[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  // Si rilegge tutto alzando questo contatore: serve solo se un salvataggio
  // fallisce e la griglia ottimistica va rimessa in pari col database.
  const [versione, setVersione] = useState(0);
  const ricarica = useCallback(() => setVersione(v => v + 1), []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [ops, tratt] = await Promise.all([getOperators(), getTreatments()]);
      if (!vivo) return;
      setOperatrici(ops.filter(o => o.isActive && !o.isResource));
      setCategorieUsate([...new Set(tratt.filter(t => t.isActive).map(t => t.category))]);
    })();
    return () => { vivo = false; };
  }, [versione]);

  /** Solo le categorie che hanno davvero dei trattamenti: le altre sono rumore. */
  const colonne = useMemo(
    () => CATEGORIE.filter(c => categorieUsate.includes(c.value)),
    [categorieUsate],
  );

  /** Chi finisce a fare una categoria, con la regola del motore. */
  const chiLaFa = useCallback((cat: string) => {
    const ops = operatrici || [];
    const spuntata = ops.filter(o => (o.specializations || []).includes(cat as TreatmentCategory));
    return spuntata.length > 0 ? spuntata : ops;
  }, [operatrici]);

  const aggiorna = async (op: Operator, patch: Partial<Operator>) => {
    setSalvando(op.id);
    try {
      // Ottimistico: la griglia deve rispondere al tocco, non al viaggio in rete
      setOperatrici(prev => (prev || []).map(o => o.id === op.id ? { ...o, ...patch } : o));
      await updateOperator(op.id, patch);
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2000);
    } catch {
      ricarica();
    } finally { setSalvando(null); }
  };

  const spunta = (op: Operator, cat: TreatmentCategory) => {
    const attuali = op.specializations || [];
    aggiorna(op, {
      specializations: attuali.includes(cat) ? attuali.filter(c => c !== cat) : [...attuali, cat],
    });
  };

  const caricaFoto = async (op: Operator, file: File | undefined) => {
    if (!file) return;
    // Piccola apposta: viaggia dentro la scheda operatrice a ogni caricamento.
    aggiorna(op, { avatar: await compressImage(file, 256, 0.78) });
  };

  if (!operatrici) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 flex items-center gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Carico le operatrici…
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-accent" />
        <h3 className="text-base font-display font-semibold text-text-primary">Chi fa cosa</h3>
        {salvato && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-success font-semibold">
            <CheckCircle className="w-4 h-4" /> Salvato
          </span>
        )}
      </div>
      <p className="text-xs text-text-secondary mb-1 leading-relaxed">
        Spunta cosa sa fare ognuna: quando la cliente sceglie una categoria, nell&apos;app le compaiono
        solo le operatrici giuste.
      </p>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        <b className="text-text-primary">La regola:</b> una categoria spuntata da qualcuno diventa sua e la fanno
        solo loro. Una categoria che <b>nessuno</b> ha spuntato resta di tutte — così non sei costretto
        a elencare a ognuna tutto quello che sa fare.
      </p>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full border-separate border-spacing-0 min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-text-muted pb-3 pr-3 sticky left-0 bg-bg-secondary">
                Operatrice
              </th>
              {colonne.map(c => (
                <th key={c.value} className="pb-3 px-1 align-bottom">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-base leading-none">{c.emoji}</span>
                    <span className="text-[11px] font-semibold text-text-secondary text-center leading-tight">
                      {c.label.split(' / ')[0]}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operatrici.map(op => (
              <tr key={op.id}>
                <td className="py-2 pr-3 border-t border-border sticky left-0 bg-bg-secondary">
                  <div className="flex items-center gap-2.5">
                    <label className="cursor-pointer relative group" title="Cambia la foto">
                      <Cerchio op={op} />
                      <span className="absolute inset-0 rounded-full bg-black/50 text-white text-[9px] font-bold
                        flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        foto
                      </span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { void caricaFoto(op, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{op.firstName} {op.lastName}</p>
                      <p className="text-[11px] text-text-muted">
                        {op.avatar ? 'foto caricata' : 'nessuna foto'}
                        {salvando === op.id && ' · salvo…'}
                      </p>
                    </div>
                  </div>
                </td>
                {colonne.map(c => {
                  const on = (op.specializations || []).includes(c.value);
                  return (
                    <td key={c.value} className="py-2 px-1 border-t border-border text-center">
                      <button onClick={() => spunta(op, c.value)} title={`${op.firstName} — ${c.label}`}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-all ${
                          on ? 'bg-accent border-accent' : 'border-border hover:border-accent/50'
                        }`}>
                        {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 pr-3 text-[11px] font-semibold text-text-muted sticky left-0 bg-bg-secondary align-top">
                Risultato
              </td>
              {colonne.map(c => {
                const nomi = chiLaFa(c.value).map(o => o.firstName);
                const diTutte = !(operatrici).some(o => (o.specializations || []).includes(c.value));
                return (
                  <td key={c.value} className="pt-3 px-1 text-center align-top">
                    <p className={`text-[10px] leading-tight ${diTutte ? 'text-text-muted' : 'text-accent font-semibold'}`}>
                      {diTutte ? 'tutte' : nomi.join(', ')}
                    </p>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-text-muted mt-4">
        La riga <b>Risultato</b> è esattamente quello che vedrà la cliente. La foto si cambia
        cliccando sul cerchio.
      </p>
    </div>
  );
}

/* ======================= COLLEGAMENTI ======================= */

function Altrove() {
  const voci = [
    {
      href: '/dashboard/staff',
      titolo: 'Turni e pause delle operatrici',
      testo: 'Chi lavora quando: è questo che decide gli orari liberi dentro la cornice qui sopra. Staff → Turni.',
    },
    {
      href: '/dashboard/packages',
      titolo: 'Trattamenti, durate e prezzi',
      testo: 'Il listino che la cliente sfoglia nell\'app: categoria, minuti, prezzo donna e uomo.',
    },
  ];
  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5">
      <h3 className="text-base font-display font-semibold text-text-primary mb-1">Il resto sta qui</h3>
      <p className="text-xs text-text-secondary mb-4">
        Due cose servono a tutto il gestionale, non solo all&apos;app: restano al loro posto.
      </p>
      <div className="space-y-2">
        {voci.map(v => (
          <Link key={v.href} href={v.href}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{v.titolo}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{v.testo}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SchedaPrenotazione({ config, salva, salvando }: {
  config: ConfigApp; salva: (p: Partial<ConfigApp>) => Promise<void>; salvando: boolean;
}) {
  return (
    <div className="space-y-4">
      <BloccoOrari config={config} salva={salva} salvando={salvando} />
      <BloccoChiFaCosa />
      <Altrove />
    </div>
  );
}
