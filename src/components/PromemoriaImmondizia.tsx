'use client';

/**
 * "Stasera cosa si caccia?"
 *
 * La domanda di ogni sera alla chiusura. Qui c'è la risposta scritta grande,
 * col colore del sacco, e sotto il resto della settimana per chi vuole
 * portarsi avanti. Se per stasera non tocca niente, lo dice: "stasera niente"
 * è un'informazione, non un vuoto.
 */

import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { leggiCalendarioImmondizia } from '@/app/actions/immondizia';
import {
  CALENDARIO_VUOTO, GIORNI, cosaTocca, giornoSettimana, rifiuto,
  type CalendarioImmondizia,
} from '@/lib/immondizia';

export default function PromemoriaImmondizia({ compatto = false }: { compatto?: boolean }) {
  const [cal, setCal] = useState<CalendarioImmondizia>(CALENDARIO_VUOTO);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    leggiCalendarioImmondizia()
      .then(c => { if (vivo) { setCal(c); setCaricato(true); } })
      .catch(() => { if (vivo) setCaricato(true); });
    return () => { vivo = false; };
  }, []);

  // Finché non si è letto niente non si mostra un calendario vuoto che sembra
  // "non si butta mai niente".
  const scritto = Object.values(cal.giorni).some(v => (v || []).length > 0);
  if (!caricato || !scritto) return null;

  const tocca = cosaTocca(cal);
  const oggi = giornoSettimana();

  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trash2 className="w-4 h-4 text-text-muted" />
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Immondizia</p>
      </div>

      {tocca ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">
            {tocca.stasera ? 'Stasera si caccia' : 'Oggi si caccia'}
          </span>
          {tocca.tipi.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: t.colore }}>
              {t.nome}
            </span>
          ))}
          <span className="text-xs text-text-muted">
            (raccolta di {tocca.nomeGiorno.toLowerCase()})
          </span>
        </div>
      ) : (
        <p className="text-sm font-semibold text-text-primary">
          {cal.seraPrima ? 'Stasera niente da portare fuori.' : 'Oggi niente da portare fuori.'}
        </p>
      )}

      {!compatto && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-3 pt-3 border-t border-border/50">
          {GIORNI.map(g => {
            const tipi = (cal.giorni[String(g.n)] || []).map(rifiuto).filter(Boolean);
            const eOggi = g.n === oggi;
            return (
              <div key={g.n} className={`rounded-xl p-2 text-center ${eOggi ? 'bg-accent/10 border border-accent/25' : 'bg-bg-tertiary/50'}`}>
                <p className={`text-[10px] font-bold uppercase ${eOggi ? 'text-accent' : 'text-text-muted'}`}>{g.corto}</p>
                {tipi.length === 0 ? (
                  <p className="text-[10px] text-text-muted mt-1">—</p>
                ) : (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {tipi.map(t => (
                      <span key={t!.id} className="text-[9px] font-semibold leading-tight px-1 py-0.5 rounded"
                        style={{ backgroundColor: `${t!.colore}22`, color: t!.colore }}>
                        {t!.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
