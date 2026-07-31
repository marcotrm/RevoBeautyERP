'use client';

/**
 * Gestione cabine: numero e nome.
 *
 * Il numero è quello che l'operatrice preme al check-in e resta scritto
 * sull'appuntamento; il nome è solo un'etichetta, e se c'è viene usato a
 * schermo e nell'annuncio vocale a fine trattamento.
 */

import React, { useEffect, useState } from 'react';
import { DoorOpen, Plus, Trash2, Save, Loader2, CheckCircle, Volume2 } from 'lucide-react';
import { loadCabins, saveCabinsAction } from '@/app/actions/cabins';
import type { Cabin } from '@/lib/cabins';

export default function CabinsSection() {
  const [cabins, setCabins] = useState<Cabin[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadCabins().then(setCabins).catch(() => setCabins([])); }, []);

  const update = (i: number, campo: keyof Cabin, valore: string) => {
    setCabins(prev => (prev ?? []).map((c, idx) => (idx === i ? { ...c, [campo]: valore } : c)));
    setSaved(false);
  };

  const aggiungi = () => {
    setCabins(prev => {
      const list = prev ?? [];
      // Propone il primo numero libero, così di solito non c'è niente da scrivere
      const numeri = list.map(c => Number(c.numero)).filter(n => Number.isFinite(n));
      const prossimo = numeri.length ? Math.max(...numeri) + 1 : 1;
      return [...list, { numero: String(prossimo), nome: '' }];
    });
    setSaved(false);
  };

  const rimuovi = (i: number) => {
    setCabins(prev => (prev ?? []).filter((_, idx) => idx !== i));
    setSaved(false);
  };

  const salva = async () => {
    if (!cabins) return;
    setSaving(true);
    try {
      await saveCabinsAction(cabins);
      setCabins(await loadCabins());
      setSaved(true);
    } finally { setSaving(false); }
  };

  if (!cabins) {
    return <div className="flex items-center gap-2 text-text-muted py-8"><Loader2 className="w-4 h-4 animate-spin" /> Carico le cabine…</div>;
  }

  const duplicati = cabins
    .map(c => c.numero.trim())
    .filter((n, i, arr) => n !== '' && arr.indexOf(n) !== i);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-display font-semibold text-text-primary flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-accent" /> Cabine
        </h3>
        <p className="text-sm text-text-secondary mt-0.5">
          Il numero è quello che si sceglie al check-in. Il nome è facoltativo: se c&apos;è, viene usato
          al posto di &quot;Cabina N&quot; sia in agenda che nell&apos;annuncio vocale.
        </p>
      </div>

      <div className="space-y-2">
        <div className="hidden sm:flex items-center gap-3 px-1">
          <span className="w-24 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Numero</span>
          <span className="flex-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Nome (facoltativo)</span>
          <span className="w-32 text-[11px] font-semibold text-text-muted uppercase tracking-wider">La voce dirà</span>
          <span className="w-9" />
        </div>

        {cabins.map((c, i) => {
          const etichetta = c.nome?.trim()
            ? c.nome.trim()
            : /^\d+$/.test(c.numero.trim()) ? `Cabina ${c.numero.trim()}` : c.numero.trim();
          return (
            <div key={i} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <input value={c.numero} onChange={e => update(i, 'numero', e.target.value)} placeholder="1"
                className="w-24 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary text-center font-bold focus:outline-none focus:border-accent/50" />
              <input value={c.nome ?? ''} onChange={e => update(i, 'nome', e.target.value)} placeholder="es. Sala Laser"
                className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
              <span className="w-32 flex items-center gap-1.5 text-xs text-text-muted truncate" title={`"${etichetta} ha finito il trattamento"`}>
                <Volume2 className="w-3.5 h-3.5 flex-shrink-0" /> {etichetta || '—'}
              </span>
              <button onClick={() => rimuovi(i)} title="Elimina cabina"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {cabins.length === 0 && (
          <p className="text-sm text-text-muted py-4">Nessuna cabina configurata: al check-in si potrà comunque scrivere il numero a mano.</p>
        )}
      </div>

      {duplicati.length > 0 && (
        <p className="text-xs text-error">
          Numero ripetuto ({[...new Set(duplicati)].join(', ')}): due cabine non possono avere lo stesso numero.
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={aggiungi}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors">
          <Plus className="w-4 h-4" /> Aggiungi cabina
        </button>
        <button onClick={salva} disabled={saving || duplicati.length > 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:opacity-90 disabled:opacity-50 transition-all">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salva cabine
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-success"><CheckCircle className="w-4 h-4" /> Salvato</span>
        )}
      </div>
    </div>
  );
}
