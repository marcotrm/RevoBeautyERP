'use client';

/**
 * "Cosa sa fare" — il collegamento fra operatrice e categorie di trattamento.
 *
 * Serve alla prenotazione online: se la cliente sceglie l'onicotecnica non le
 * si devono proporre operatrici che le unghie non le fanno. La regola è la
 * stessa che applica il motore (competenzePerOperatrice in lib/bookingEngine):
 *
 *   una categoria spuntata da qualcuno diventa sua — la fanno solo le
 *   operatrici che l'hanno spuntata; le categorie che nessuno ha spuntato
 *   restano di tutte.
 *
 * Qui sotto la regola non si spiega soltanto: ogni riquadro dice già chi farà
 * quel lavoro dopo il salvataggio, così non c'è da indovinare.
 */

import { Check } from 'lucide-react';
import type { Operator, TreatmentCategory } from '@/types';

export const CATEGORIE: { value: TreatmentCategory; label: string; emoji: string }[] = [
  { value: 'nails', label: 'Unghie / Onicotecnica', emoji: '💅' },
  { value: 'laser', label: 'Laser / Epilazione', emoji: '✨' },
  { value: 'waxing', label: 'Ceretta', emoji: '🪒' },
  { value: 'facial', label: 'Viso', emoji: '🧖' },
  { value: 'body', label: 'Corpo', emoji: '🌿' },
  { value: 'massage', label: 'Massaggi', emoji: '💆' },
  { value: 'makeup', label: 'Trucco', emoji: '💄' },
  { value: 'consultation', label: 'Consulenza', emoji: '📋' },
];

export const etichettaCategoria = (c: string) =>
  CATEGORIE.find(x => x.value === c)?.label || c;

/**
 * Chi farà una certa categoria se si salva così: le spuntate, oppure tutte
 * quando nessuna l'ha spuntata.
 */
function chiLaFa(categoria: string, altre: Operator[], mie: TreatmentCategory[]): {
  nomi: string[];
  diTutte: boolean;
} {
  const conLaSpunta = altre.filter(o => (o.specializations || []).includes(categoria as TreatmentCategory));
  const ancheIo = mie.includes(categoria as TreatmentCategory);
  if (conLaSpunta.length === 0 && !ancheIo) {
    return { nomi: altre.map(o => o.firstName), diTutte: true };
  }
  return { nomi: conLaSpunta.map(o => o.firstName), diTutte: false };
}

export function CompetenzeEditor({ specs, onChange, altreOperatrici, nome }: {
  specs: TreatmentCategory[];
  onChange: (next: TreatmentCategory[]) => void;
  /** Le altre operatrici attive, per dire chi copre già una categoria. */
  altreOperatrici: Operator[];
  /** Nome di battesimo di chi si sta modificando. */
  nome: string;
}) {
  const toggle = (c: TreatmentCategory) =>
    onChange(specs.includes(c) ? specs.filter(x => x !== c) : [...specs, c]);

  return (
    <div>
      <label className="block text-sm font-semibold text-text-primary mb-1">Cosa sa fare</label>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        Spunta le categorie che {nome || 'questa operatrice'} sa fare: nella prenotazione online
        la cliente vedrà solo chi quel lavoro lo fa davvero.
        <br />
        Una categoria che <b>nessuno</b> ha spuntato resta di tutte.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {CATEGORIE.map(c => {
          const on = specs.includes(c.value);
          const { nomi, diTutte } = chiLaFa(c.value, altreOperatrici, specs);
          const altriNomi = nomi.filter(n => n !== nome);

          return (
            <button key={c.value} type="button" onClick={() => toggle(c.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                on ? 'bg-accent/10 border-accent/40' : 'bg-bg-tertiary border-border hover:border-border-light'
              }`}>
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{c.emoji}</span>
                <span className={`text-sm font-medium flex-1 ${on ? 'text-accent' : 'text-text-secondary'}`}>
                  {c.label}
                </span>
                <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                  on ? 'bg-accent border-accent' : 'border-border'
                }`}>
                  {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5 leading-snug">
                {on
                  ? altriNomi.length > 0
                    ? `Insieme a ${altriNomi.join(', ')}`
                    : 'Solo lei'
                  : diTutte
                    ? 'Nessuno l’ha spuntata: la fanno tutte'
                    : `Riservata a ${altriNomi.join(', ')}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Foto tonda dell'operatrice. La cliente, quando sceglie con chi prenotare,
 * riconosce prima una faccia che un nome.
 */
export function FotoOperatrice({ avatar, onChange, color, iniziali }: {
  avatar: string;
  onChange: (dataUrl: string) => void;
  color: string;
  iniziali: string;
}) {
  const scegli = async (file: File | undefined) => {
    if (!file) return;
    // Piccola apposta: la foto viaggia dentro la scheda operatrice, che il
    // gestionale carica a ogni apertura. Tonda e da 256px basta e avanza.
    const { compressImage } = await import('@/lib/imageCompress');
    onChange(await compressImage(file, 256, 0.78));
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold shrink-0 border-2 border-border"
        style={{ backgroundColor: color }}>
        {avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatar} alt="" className="w-full h-full object-cover" />
          : iniziali}
      </div>
      <div className="min-w-0">
        <label className="inline-block px-3 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover cursor-pointer transition-colors">
          {avatar ? 'Cambia foto' : 'Carica foto'}
          <input type="file" accept="image/*" className="hidden"
            onChange={e => { void scegli(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {avatar && (
          <button type="button" onClick={() => onChange('')}
            className="ml-2 px-3 py-2 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-colors">
            Togli
          </button>
        )}
        <p className="text-xs text-text-muted mt-1.5">Si vede nell&apos;app quando la cliente sceglie con chi prenotare.</p>
      </div>
    </div>
  );
}
