'use client';

/**
 * Cerca buchi: la finestra che risponde a "quando posso metterla?".
 *
 * Due domande e basta — cosa deve fare e con chi — perché si compila con la
 * cliente al telefono che aspetta. Poi escono i primi posti liberi, e da lì si
 * prenota con un tocco: la finestra dell'appuntamento si apre già col giorno,
 * l'ora, l'operatrice e i trattamenti dentro.
 *
 * I posti li calcola lo stesso motore del bot di WhatsApp: turni, pause,
 * blocchi, chi sa fare cosa e quanto ci mette. Così quello che si dice al
 * telefono e quello che il bot propone alle clienti sono la stessa cosa.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Sparkles, Clock, Euro, Loader2, CalendarPlus, Users } from 'lucide-react';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { cercaBuchi, type BucoTrovato } from '@/app/actions/cercaBuchi';
import { formatCurrency } from '@/lib/helpers';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import type { Treatment } from '@/types';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "giovedì 21 agosto", e "oggi"/"domani" quando lo sono: si legge più in fretta. */
function giornoInParole(iso: string, oggi: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const domani = new Date(`${oggi}T12:00:00`);
  domani.setDate(domani.getDate() + 1);
  if (iso === oggi) return 'oggi';
  if (iso === domani.toISOString().slice(0, 10)) return 'domani';
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

interface Props {
  onClose: () => void;
  /** Prenota: giorno, ora, chi fa il primo trattamento e la lista dei trattamenti. */
  onPrenota: (b: BucoTrovato, treatmentIds: string[]) => void;
}

export default function CercaBuchiModal({ onClose, onPrenota }: Props) {
  const treatments = useTreatmentStore(s => s.treatments);
  const operators = useOperatorStore(s => s.operators);

  /*
    I trattamenti scelti, ognuno con la sua operatrice.

    Serve perché il caso vero è proprio questo: il refill lo fa Michela e
    subito dopo il massaggio lo fa Rosaria. Vuoto = chiunque sia libera.
  */
  const [scelti, setScelti] = useState<{ t: Treatment; operatorId: string }[]>([]);
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [fascia, setFascia] = useState<'tutto' | 'mattina' | 'pomeriggio'>('tutto');
  const [dal, setDal] = useState(() => new Date().toISOString().slice(0, 10));

  const [cercando, setCercando] = useState(false);
  const [buchi, setBuchi] = useState<BucoTrovato[] | null>(null);

  const oggi = new Date().toISOString().slice(0, 10);

  const risultati = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return treatments
      .filter(t => t.isActive !== false && t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, treatments]);

  /*
    Chi può fare QUEL trattamento: la tendina di ogni riga mostra solo loro,
    perché proporre chi non lo sa fare vuol dire cercare un buco che non esiste.
    Le cabine automatiche restano dentro: la lampada non la fa una persona.
  */
  const attive = useMemo(() => operators.filter(o => o.isActive !== false), [operators]);
  const chiPuoFare = (t: Treatment) => {
    const abili = (t.operatorSkills || []).map(k => k.operatorId);
    return attive.filter(o => abili.length === 0 || abili.includes(o.id));
  };

  const cerca = async () => {
    if (scelti.length === 0) return;
    setCercando(true);
    setBuchi(null);
    try {
      const esito = await cercaBuchi({
        richieste: scelti.map(s => ({ treatmentId: s.t.id, operatorId: s.operatorId || null })),
        dal,
        giorni: 21,
        gender,
        oraDa: fascia === 'pomeriggio' ? '13:00' : null,
        oraA: fascia === 'mattina' ? '13:00' : null,
        quanti: 9,
      });
      setBuchi(esito.buchi);
    } finally {
      setCercando(false);
    }
  };

  // Il tempo mostrato qui è quello che occupa in agenda: preparazione compresa.
  const durataTotale = scelti.reduce((s, x) => s
    + (gender === 'male' ? (x.t.durationMale ?? x.t.duration) : (x.t.durationFemale ?? x.t.duration))
    + (x.t.preparazione || 0), 0);
  const prezzoTotale = scelti.reduce((s, x) => s + (gender === 'male' ? (x.t.priceMale ?? x.t.price) : (x.t.priceFemale ?? x.t.price)), 0);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Cerca buchi
              </h3>
              <p className="text-xs text-text-muted">Dimmi cosa deve fare e con chi: ti dico quando c&apos;è posto.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* 1. Cosa deve fare */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Cosa deve fare</label>
              {scelti.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {scelti.map((x, i) => {
                    const minuti = (gender === 'male' ? (x.t.durationMale ?? x.t.duration) : (x.t.durationFemale ?? x.t.duration))
                      + (x.t.preparazione || 0);
                    const fanno = chiPuoFare(x.t);
                    return (
                      <div key={`${x.t.id}-${i}`} className="px-3 py-2 rounded-xl bg-accent/5 border border-accent/20 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{x.t.name}</span>
                          <span className="text-xs text-text-muted flex-shrink-0">
                            {minuti} min{x.t.preparazione ? ` (${minuti - x.t.preparazione}+${x.t.preparazione} prep)` : ''}
                          </span>
                          <button onClick={() => { setScelti(prev => prev.filter((_, k) => k !== i)); setBuchi(null); }}
                            className="p-1 rounded-lg text-text-muted hover:text-error flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        {/* Ognuno con la sua: è il senso di tutto — il refill
                            lo fa una e subito dopo il massaggio lo fa un'altra. */}
                        <select value={x.operatorId}
                          onChange={e => {
                            const v = e.target.value;
                            setScelti(prev => prev.map((y, k) => k === i ? { ...y, operatorId: v } : y));
                            setBuchi(null);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary focus:outline-none focus:border-accent/50">
                          <option value="">Chiunque sia libera</option>
                          {fanno.map(o => (
                            <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input value={query} onChange={e => setQuery(e.target.value)} {...NO_AUTOFILL} autoFocus
                  placeholder={scelti.length ? 'Aggiungi un altro trattamento…' : 'Cerca il trattamento…'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50" />
              </div>
              {risultati.length > 0 && (
                <div className="mt-1 rounded-xl border border-border bg-bg-tertiary overflow-hidden max-h-44 overflow-y-auto">
                  {risultati.map(t => (
                    <button key={t.id} onClick={() => { setScelti(prev => [...prev, { t, operatorId: '' }]); setQuery(''); setBuchi(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover">
                      <span className="text-sm text-text-primary flex-1 min-w-0 truncate">{t.name}</span>
                      <span className="text-xs text-text-muted flex-shrink-0">{t.duration} min · {formatCurrency(t.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scelti.length > 1 && (
              <p className="text-[11px] text-text-muted flex items-start gap-1.5">
                <Users className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>
                  Puoi mettere un&apos;operatrice diversa su ogni riga: cerco due orari attaccati, il secondo
                  trattamento comincia quando finisce il primo.
                </span>
              </p>
            )}

            {/* 3. Quando (facoltativo, ma è la domanda che fanno sempre) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">A partire dal</label>
                <input type="date" value={dal} min={oggi} onChange={e => { setDal(e.target.value); setBuchi(null); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Quando le va bene</label>
                <div className="flex rounded-xl border border-border overflow-hidden text-xs">
                  {([['tutto', 'Indifferente'], ['mattina', 'Mattina'], ['pomeriggio', 'Pomeriggio']] as const).map(([val, lab]) => (
                    <button key={val} onClick={() => { setFascia(val); setBuchi(null); }}
                      className={`flex-1 py-2.5 transition-colors ${fascia === val ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                      {lab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {([['female', '♀ Donna'], ['male', '♂ Uomo']] as const).map(([val, lab]) => (
                  <button key={val} onClick={() => { setGender(val); setBuchi(null); }}
                    className={`px-3 py-1.5 transition-colors ${gender === val ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>
                    {lab}
                  </button>
                ))}
              </div>
              {scelti.length > 0 && (
                <span className="text-xs text-text-muted ml-auto flex items-center gap-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {durataTotale} min</span>
                  <span className="flex items-center gap-1"><Euro className="w-3.5 h-3.5" /> {formatCurrency(prezzoTotale)}</span>
                </span>
              )}
            </div>

            <button onClick={cerca} disabled={scelti.length === 0 || cercando}
              className="w-full py-3 rounded-xl gradient-accent text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
              {cercando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {cercando ? 'Sto guardando l’agenda…' : 'Trova posto'}
            </button>

            {/* I posti trovati */}
            {buchi && buchi.length === 0 && (
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/30">
                <p className="text-sm font-semibold text-text-primary">Nelle prossime tre settimane non c&apos;è posto</p>
                <p className="text-xs text-text-secondary mt-1">
                  Con questi trattamenti{scelti.some(x => x.operatorId) ? ' e queste operatrici' : ''} non entra da nessuna parte.
                  Prova a mettere &laquo;chiunque sia libera&raquo; su qualche riga, o sposta la fascia oraria.
                </p>
              </div>
            )}

            {buchi && buchi.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  I primi posti liberi
                </p>
                {buchi.map((b, i) => {
                  const operatrici = [...new Set(b.chiFaCosa.map(c => c.operatorName))];
                  // Con più mani in ballo si scrive chi prende in mano cosa e
                  // quando: è l'unica cosa che si vuole sapere prima di dire sì.
                  const staffetta = operatrici.length > 1 || b.chiFaCosa.length > 1;
                  return (
                    <button key={`${b.date}-${b.time}-${i}`} onClick={() => onPrenota(b, scelti.map(x => x.t.id))}
                      className="w-full flex items-start gap-3 p-3 rounded-xl bg-bg-tertiary/60 border border-border hover:border-accent/50 hover:bg-bg-hover transition-all text-left group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary first-letter:uppercase flex items-center gap-2 flex-wrap">
                          {giornoInParole(b.date, oggi)} alle {b.time}
                          {/* Il posto che si incastra senza lasciare cabina vuota:
                              è quello che conviene dare, e va detto. */}
                          {b.attaccato && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success"
                              title="Comincia appena si libera l'operatrice: non lascia buchi in agenda">
                              SENZA BUCHI
                            </span>
                          )}
                        </p>
                        {staffetta ? (
                          <div className="mt-1 space-y-0.5">
                            {b.chiFaCosa.map((c, k) => (
                              <p key={k} className="text-[11px] text-text-muted truncate">
                                <span className="text-text-secondary font-medium">{c.startTime}</span> {c.treatmentName} — {c.operatorName}
                              </p>
                            ))}
                            <p className="text-[10px] text-text-muted/70">finisce alle {b.endTime}</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-text-muted truncate">
                            fino alle {b.endTime} · {operatrici.join(' e ')}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <CalendarPlus className="w-3.5 h-3.5" /> Prenota
                      </span>
                    </button>
                  );
                })}
                <p className="text-[10px] text-text-muted/70">
                  Toccane uno: la finestra dell&apos;appuntamento si apre già col giorno, l&apos;ora e i trattamenti dentro.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
