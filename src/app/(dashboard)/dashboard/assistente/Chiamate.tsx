'use client';

/**
 * Le telefonate dell'assistente, nel gestionale.
 *
 * Le chiamate si registravano già — una riga per telefonata, con trascrizione
 * ed esito — ma non le vedeva nessuno: `caricaChiamate` esisteva e non la
 * chiamava nessuna schermata. Un registro che nessuno apre è un registro che
 * non c'è, e la domanda che conta («la voce sta rispondendo bene?») restava
 * senza risposta finché non arrivava una lamentela.
 *
 * Sopra all'elenco c'è il riepilogo, perché è quello che si guarda per primo:
 * quante chiamate, quante sono diventate un appuntamento, e — la cifra che
 * conta davvero — quante sono state passate a una persona. Se quella cresce,
 * la voce non sta reggendo e va guardata prima che se ne accorgano le clienti.
 */

import React, { useEffect, useState } from 'react';
import {
  Phone, Loader2, RefreshCw, ChevronDown, CalendarPlus, CalendarClock,
  CalendarX, UserRound, Info, PhoneOff,
} from 'lucide-react';
import { caricaChiamate } from '@/app/actions/assistente';
import type { Chiamata, EsitoChiamata } from '@/lib/voceChiamate';

/** Come si chiama, e di che colore è, ogni modo di finire una telefonata. */
const ESITI: Record<EsitoChiamata, { etichetta: string; icona: typeof Phone; classe: string }> = {
  prenotato: { etichetta: 'Appuntamento preso', icona: CalendarPlus, classe: 'text-success' },
  spostato: { etichetta: 'Spostato', icona: CalendarClock, classe: 'text-accent' },
  disdetto: { etichetta: 'Disdetto', icona: CalendarX, classe: 'text-warning' },
  trasferito: { etichetta: 'Passata a una persona', icona: UserRound, classe: 'text-warning' },
  info: { etichetta: 'Informazioni', icona: Info, classe: 'text-text-secondary' },
  nessuno: { etichetta: 'Riattaccato senza concludere', icona: PhoneOff, classe: 'text-error' },
};

function durataParlata(secondi: number): string {
  if (secondi < 60) return `${Math.max(0, Math.round(secondi))}s`;
  const m = Math.floor(secondi / 60);
  const s = Math.round(secondi % 60);
  return s === 0 ? `${m} min` : `${m} min ${s}s`;
}

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function Chiamate() {
  const [chiamate, setChiamate] = useState<Chiamata[] | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const carica = async () => {
    setInCorso(true);
    try {
      setChiamate(await caricaChiamate(50));
    } finally {
      setInCorso(false);
    }
  };

  useEffect(() => {
    void (async () => { setChiamate(await caricaChiamate(50)); })();
  }, []);

  if (!chiamate) {
    return (
      <p className="text-xs text-text-muted flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Carico…
      </p>
    );
  }

  /*
    Il riepilogo si conta su quello che c'è, non su una finestra fissa.

    Dire «oggi 3 chiamate» quando l'assistente ha risposto tre volte in una
    settimana fa sembrare un numero un andamento. Qui si dice apertamente su
    quante chiamate è calcolato.
  */
  const perEsito = chiamate.reduce((acc, c) => {
    acc[c.esito] = (acc[c.esito] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const appuntamenti = (perEsito.prenotato || 0) + (perEsito.spostato || 0) + (perEsito.disdetto || 0);
  const passate = perEsito.trasferito || 0;
  const durataMedia = chiamate.length > 0
    ? chiamate.reduce((s, c) => s + (c.durata || 0), 0) / chiamate.length
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted leading-relaxed max-w-2xl">
          Una riga per telefonata, con quello che si sono detti. Il numero da tenere d&apos;occhio è
          quante <b>passa a una persona</b>: se cresce, la voce non sta reggendo — e conviene saperlo
          prima che ve lo dica una cliente.
        </p>
        <button onClick={carica} disabled={inCorso}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-50 flex-shrink-0">
          {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Aggiorna
        </button>
      </div>

      {chiamate.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nessuna telefonata registrata. Compaiono qui da sole appena il numero del centro è deviato
          sull&apos;assistente: non c&apos;è niente da accendere in questa pagina.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Numero valore={chiamate.length} etichetta="telefonate" />
            <Numero valore={appuntamenti} etichetta="hanno toccato l'agenda" />
            <Numero valore={passate} etichetta="passate a una persona"
              allarme={chiamate.length > 0 && passate / chiamate.length > 0.3} />
            <Numero valore={durataParlata(durataMedia)} etichetta="durata media" />
          </div>

          <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden">
            {chiamate.map(c => {
              const e = ESITI[c.esito] || ESITI.nessuno;
              const Icona = e.icona;
              const apertaQui = aperta === c.callId;
              return (
                <div key={c.callId}>
                  <button
                    onClick={() => setAperta(apertaQui ? null : c.callId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-hover transition-colors">
                    <Icona className={`w-4 h-4 flex-shrink-0 ${e.classe}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate">
                        {c.clientName || `+${c.phone}`}
                        <span className="text-text-muted"> · {e.etichetta}</span>
                      </p>
                      <p className="text-[10px] text-text-muted/80">
                        {quando(c.iniziata)} · {durataParlata(c.durata || 0)}
                        {c.note ? ` · ${c.note}` : ''}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-text-muted flex-shrink-0 transition-transform ${apertaQui ? 'rotate-180' : ''}`} />
                  </button>

                  {apertaQui && (
                    <div className="px-3 pb-3 space-y-1.5 bg-bg-tertiary/40">
                      {(c.trascrizione || []).length === 0 ? (
                        <p className="text-[11px] text-text-muted pt-2">
                          Nessuna trascrizione per questa chiamata.
                        </p>
                      ) : (
                        c.trascrizione.map((b, i) => (
                          <p key={i} className="text-[11px] leading-relaxed">
                            <span className={b.chi === 'cliente' ? 'text-accent font-medium' : 'text-text-muted font-medium'}>
                              {b.chi === 'cliente' ? 'Cliente' : 'Assistente'}:{' '}
                            </span>
                            <span className="text-text-secondary">{b.testo}</span>
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-text-muted/70">
            Le ultime {chiamate.length} telefonate. Il riepilogo qui sopra è calcolato su queste, non
            sulla giornata.
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ valore, etichetta, allarme }: {
  valore: number | string; etichetta: string; allarme?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${allarme ? 'border-warning/40 bg-warning/10' : 'border-border bg-bg-tertiary'}`}>
      <p className={`text-lg font-semibold leading-none ${allarme ? 'text-warning' : 'text-text-primary'}`}>{valore}</p>
      <p className="text-[10px] text-text-muted mt-1">{etichetta}</p>
    </div>
  );
}
