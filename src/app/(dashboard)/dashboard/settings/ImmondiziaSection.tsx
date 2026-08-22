'use client';

/**
 * Dove si scrive il calendario dell'immondizia.
 *
 * Si compila una volta, guardando il calendario del Comune: per ogni giorno si
 * toccano i sacchi che passano a prendere. Sopra resta l'avviso di stasera,
 * così mentre si compila si vede subito l'effetto.
 */

import React, { useEffect, useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { leggiCalendarioImmondizia, salvaCalendarioImmondizia, immondiziaDiOggi, type ImmondiziaFatta } from '@/app/actions/immondizia';
import PromemoriaImmondizia from '@/components/PromemoriaImmondizia';
import {
  CALENDARIO_VUOTO, GIORNI, RIFIUTI, type CalendarioImmondizia, type TipoRifiuto,
} from '@/lib/immondizia';

export default function ImmondiziaSection() {
  const [cal, setCal] = useState<CalendarioImmondizia>(CALENDARIO_VUOTO);
  const [caricato, setCaricato] = useState(false);
  const [salvato, setSalvato] = useState(false);
  const [chiave, setChiave] = useState(0); // per rileggere l'avviso dopo il salvataggio
  const [fatta, setFatta] = useState<ImmondiziaFatta | null>(null);

  useEffect(() => {
    let vivo = true;
    const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    Promise.all([leggiCalendarioImmondizia(), immondiziaDiOggi(oggi)])
      .then(([c, f]) => { if (vivo) { setCal(c); setFatta(f); setCaricato(true); } })
      .catch(() => { if (vivo) setCaricato(true); });
    return () => { vivo = false; };
  }, []);

  const salva = async (prossimo: CalendarioImmondizia) => {
    setCal(prossimo);
    await salvaCalendarioImmondizia(prossimo).catch(() => {});
    setSalvato(true);
    setChiave(k => k + 1);
    setTimeout(() => setSalvato(false), 2000);
  };

  const cambia = (giorno: number, tipo: TipoRifiuto) => {
    const attuali = cal.giorni[String(giorno)] || [];
    const prossimi = attuali.includes(tipo) ? attuali.filter(t => t !== tipo) : [...attuali, tipo];
    salva({ ...cal, giorni: { ...cal.giorni, [String(giorno)]: prossimi } });
  };

  if (!caricato) return null;

  return (
    <div className="space-y-4">
      <PromemoriaImmondizia key={chiave} />

      <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-text-muted" /> Calendario immondizia
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Per ogni giorno, cosa passano a prendere. Si compila una volta guardando il calendario del Comune.
            </p>
          </div>
          {salvato && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-success flex-shrink-0">
              <Check className="w-3.5 h-3.5" /> Salvato
            </span>
          )}
        </div>

        {/* Quando si porta fuori: cambia tutto l'avviso della sera. */}
        <button type="button" onClick={() => salva({ ...cal, seraPrima: !cal.seraPrima })}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border text-left hover:bg-bg-hover transition-colors">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {cal.seraPrima ? 'Il sacco si porta fuori la sera prima' : 'Il sacco si porta fuori la mattina stessa'}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {cal.seraPrima
                ? 'L’avviso della sera parla della raccolta di domani.'
                : 'L’avviso parla della raccolta di oggi.'}
            </p>
          </div>
          <span className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${cal.seraPrima ? 'bg-success' : 'bg-bg-hover'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${cal.seraPrima ? 'left-6' : 'left-1'}`} />
          </span>
        </button>

        {/* A che ora bussa il promemoria. */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">Promemoria a schermo</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              A quest&apos;ora compare l&apos;avviso con i tasti &laquo;Immondizia buttata&raquo; e &laquo;La butto dopo&raquo;.
            </p>
          </div>
          <input type="time" value={cal.oraAvviso || '19:00'}
            onChange={e => salva({ ...cal, oraAvviso: e.target.value || '19:00' })}
            className="px-3 py-2 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 flex-shrink-0" />
        </div>

        {/* Chi l'ha portata fuori oggi: la mattina dopo è l'unica cosa che conta. */}
        {fatta && (
          <p className="text-[11px] text-success font-semibold">
            ✓ Oggi l&apos;ha già portata fuori {fatta.chi} alle{' '}
            {new Date(fatta.quando).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        <div className="space-y-2">
          {GIORNI.map(g => {
            const attuali = cal.giorni[String(g.n)] || [];
            return (
              <div key={g.n} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-border/60 bg-bg-tertiary/30">
                <span className="text-sm font-semibold text-text-primary w-24 flex-shrink-0">{g.nome}</span>
                <div className="flex flex-wrap gap-1.5">
                  {RIFIUTI.map(r => {
                    const scelto = attuali.includes(r.id);
                    return (
                      <button key={r.id} type="button" onClick={() => cambia(g.n, r.id)}
                        title={r.soprannome}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          scelto ? 'text-white border-transparent' : 'text-text-secondary border-border hover:bg-bg-hover'}`}
                        style={scelto ? { backgroundColor: r.colore } : undefined}>
                        {r.nome}
                      </button>
                    );
                  })}
                </div>
                {attuali.length === 0 && (
                  <span className="text-[11px] text-text-muted sm:ml-auto">niente</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-text-muted">
          La domenica non compare: non passa nessuno. Ogni tocco si salva da solo.
        </p>
      </div>
    </div>
  );
}
