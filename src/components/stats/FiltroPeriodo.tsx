'use client';

/**
 * Filtro date condiviso dalle schede che ragionano su un periodo.
 *
 * I preset coprono il 90% dei casi ("questo mese", "ultimi 3 mesi"); le due
 * caselle restano sempre modificabili per gli intervalli strani, e toccarle
 * porta automaticamente su "Personalizzato".
 */

import React from 'react';

export interface Periodo { from: string; to: string }

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Intervalli pronti, calcolati sul giorno di oggi. */
export function periodoPreset(chiave: string): Periodo {
  const o = new Date();
  const a = o.getFullYear(), m = o.getMonth();
  switch (chiave) {
    case 'mese': return { from: fmt(new Date(a, m, 1)), to: fmt(o) };
    case 'meseScorso': return { from: fmt(new Date(a, m - 1, 1)), to: fmt(new Date(a, m, 0)) };
    case 'tre': return { from: fmt(new Date(a, m - 2, 1)), to: fmt(o) };
    case 'dodici': return { from: fmt(new Date(a, m - 11, 1)), to: fmt(o) };
    case 'anno': return { from: `${a}-01-01`, to: fmt(o) };
    default: return { from: '2000-01-01', to: fmt(o) }; // sempre
  }
}

const PRESET = [
  { key: 'mese', label: 'Questo mese' },
  { key: 'meseScorso', label: 'Mese scorso' },
  { key: 'tre', label: 'Ultimi 3 mesi' },
  { key: 'dodici', label: 'Ultimi 12 mesi' },
  { key: 'anno', label: 'Quest’anno' },
  { key: 'sempre', label: 'Sempre' },
];

export default function FiltroPeriodo({ valore, onChange, attivo, onPreset }: {
  valore: Periodo;
  onChange: (p: Periodo) => void;
  attivo: string;
  onPreset: (chiave: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap p-3 rounded-2xl bg-bg-secondary border border-border">
      <div className="flex flex-wrap gap-1">
        {PRESET.map(p => (
          <button key={p.key} onClick={() => onPreset(p.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              attivo === p.key ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        Dal
        <input type="date" value={valore.from} max={valore.to}
          onChange={e => e.target.value && onChange({ ...valore, from: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
      </label>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        Al
        <input type="date" value={valore.to} min={valore.from}
          onChange={e => e.target.value && onChange({ ...valore, to: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
      </label>
    </div>
  );
}
