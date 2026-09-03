'use client';

/**
 * Le campagne email e SMS, quelle vere.
 *
 * Al posto di quattro campagne finte scritte nel codice — che sembravano
 * partite e non erano mai esistite — qui si sceglie il gruppo, si scrive, si
 * vede quante persone lo riceveranno davvero, e si manda.
 *
 * Il numero che conta e' l'ultimo: "raggiungibili". Fra chi ha dato il
 * consenso e chi ha davvero un indirizzo, di duecento clienti ne restano
 * sempre molte meno — ed e' meglio saperlo prima di premere invia.
 */

import React, { useEffect, useState } from 'react';
import { AtSign, Check, Loader2, Mail, MessageSquare, Send, Users } from 'lucide-react';
import {
  campagna, campagneFatte, destinatariPer, statoCanali,
  type CampagnaFatta, type Destinatario, type StatoCanali,
} from '@/app/actions/canali';

const GRUPPI = [
  { id: 'dormienti', nome: 'Chi non si vede da due mesi', sotto: 'la lista che riporta più gente' },
  { id: 'tutte', nome: 'Tutte le clienti', sotto: 'solo chi ha dato il consenso' },
  { id: 'nuove', nome: 'Le nuove degli ultimi due mesi', sotto: 'per farle tornare la seconda volta' },
  { id: 'compleanno', nome: 'Chi compie gli anni questo mese', sotto: 'il messaggio che si legge sempre' },
] as const;

type Gruppo = typeof GRUPPI[number]['id'];

export default function CampagneEmailSms() {
  const [canale, setCanale] = useState<'email' | 'sms'>('email');
  const [gruppo, setGruppo] = useState<Gruppo>('dormienti');
  const [persone, setPersone] = useState<Destinatario[] | null>(null);
  const [oggetto, setOggetto] = useState('');
  const [testo, setTesto] = useState('');
  const [stato, setStato] = useState<StatoCanali | null>(null);
  const [storico, setStorico] = useState<CampagnaFatta[]>([]);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<string>('');
  const [conferma, setConferma] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([statoCanali(), campagneFatte(10)])
      .then(([s, c]) => { if (vivo) { setStato(s); setStorico(c); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    setPersone(null);
    destinatariPer(gruppo).then(p => { if (vivo) setPersone(p); }).catch(() => { if (vivo) setPersone([]); });
    return () => { vivo = false; };
  }, [gruppo]);

  const raggiungibili = (persone || []).filter(p => p.consenso && (canale === 'email' ? !!p.email : !!p.telefono));
  const senzaConsenso = (persone || []).filter(p => !p.consenso).length;
  const senzaIndirizzo = (persone || []).filter(p => p.consenso && (canale === 'email' ? !p.email : !p.telefono)).length;
  const canaleAcceso = canale === 'email' ? stato?.emailAttiva && stato?.chiaveEmailPresente : stato?.smsAttivo && stato?.passwordSmsPresente;

  const manda = async () => {
    if (!testo.trim() || raggiungibili.length === 0) return;
    setInviando(true);
    setEsito('');
    try {
      const r = await campagna({
        canale,
        clientIds: raggiungibili.map(p => p.id),
        oggetto: oggetto.trim() || undefined,
        testo: testo.trim(),
      });
      setEsito(
        `Partiti ${r.mandati}${r.falliti ? `, non riusciti ${r.falliti}` : ''}${r.saltati ? `, saltati ${r.saltati}` : ''}.`
        + (r.errori.length ? ` Primo errore: ${r.errori[0]}` : ''),
      );
      setConferma(false);
      setTesto('');
      setStorico(await campagneFatte(10));
    } catch {
      setEsito('Invio non riuscito.');
    } finally { setInviando(false); }
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary">Campagne email e SMS</h3>
        <p className="text-xs text-text-muted">
          Per chi su WhatsApp non arriva. Il consenso al marketing è obbligatorio: chi non l’ha dato resta fuori da solo.
        </p>
      </div>

      <div className="flex rounded-xl border border-border overflow-hidden w-fit">
        {([['email', 'Email', AtSign], ['sms', 'SMS', MessageSquare]] as const).map(([id, label, Icona]) => (
          <button key={id} onClick={() => setCanale(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${canale === id ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'}`}>
            <Icona className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {!canaleAcceso && (
        <p className="text-[11px] text-warning">
          {canale === 'email' ? 'L’email non è ancora configurata' : 'Gli SMS non sono ancora configurati'}: si accende in
          Impostazioni → Integrazioni. Fin qui puoi preparare il messaggio, ma non parte.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {GRUPPI.map(g => (
          <button key={g.id} onClick={() => setGruppo(g.id)}
            className={`p-3 rounded-xl border text-left transition-colors ${gruppo === g.id ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-hover'}`}>
            <p className="text-sm font-medium text-text-primary">{g.nome}</p>
            <p className="text-[11px] text-text-muted">{g.sotto}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border">
        <Users className="w-4 h-4 text-accent flex-shrink-0" />
        {persone === null ? (
          <span className="text-sm text-text-muted">Conto quante sono…</span>
        ) : (
          <span className="text-sm text-text-secondary">
            <strong className="text-text-primary">{raggiungibili.length}</strong> lo riceveranno
            <span className="text-text-muted">
              {' '}· {persone.length} nel gruppo
              {senzaConsenso > 0 ? `, ${senzaConsenso} senza consenso` : ''}
              {senzaIndirizzo > 0 ? `, ${senzaIndirizzo} senza ${canale === 'email' ? 'email' : 'numero'}` : ''}
            </span>
          </span>
        )}
      </div>

      {canale === 'email' && (
        <input type="text" value={oggetto} onChange={e => setOggetto(e.target.value)}
          placeholder="Oggetto dell’email"
          className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
      )}

      <div>
        <textarea rows={canale === 'sms' ? 3 : 6} value={testo} onChange={e => setTesto(e.target.value)}
          placeholder={canale === 'sms'
            ? 'Ciao {nome}, ti aspettiamo da RevoBeauty…'
            : 'Ciao {nome},\n\nè un po’ che non ci vediamo…'}
          className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60 resize-none" />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-text-muted">{'{nome}'} diventa il nome di battesimo di ognuna.</p>
          {canale === 'sms' && (
            <p className={`text-[10px] ${testo.length > 160 ? 'text-warning' : 'text-text-muted'}`}>
              {testo.length}/160 {testo.length > 160 ? `· sono ${Math.ceil(testo.length / 153)} SMS a testa` : ''}
            </p>
          )}
        </div>
      </div>

      {!conferma ? (
        <button onClick={() => setConferma(true)}
          disabled={!testo.trim() || raggiungibili.length === 0 || !canaleAcceso}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-40">
          <Send className="w-4 h-4" /> Manda a {raggiungibili.length} {raggiungibili.length === 1 ? 'persona' : 'persone'}
        </button>
      ) : (
        <div className="p-3.5 rounded-xl border-2 border-warning/40 bg-warning/5 space-y-2.5">
          <p className="text-sm text-text-primary">
            Sto per mandare <strong>{raggiungibili.length}</strong> {canale === 'email' ? 'email' : 'SMS'}.
            {canale === 'sms' && ' Gli SMS si pagano.'} Confermi?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConferma(false)} disabled={inviando}
              className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-bg-hover">
              No, aspetta
            </button>
            <button onClick={manda} disabled={inviando}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg gradient-accent text-white text-xs font-bold disabled:opacity-50">
              {inviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Manda davvero
            </button>
          </div>
        </div>
      )}

      {esito && <p className="text-sm text-text-secondary">{esito}</p>}

      {storico.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Quelle già mandate</p>
          <div className="space-y-1.5">
            {storico.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-bg-tertiary/40">
                {c.canale === 'email' ? <Mail className="w-3.5 h-3.5 text-text-muted flex-shrink-0" /> : <MessageSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary truncate">{c.oggetto || c.testo.slice(0, 60)}</p>
                  <p className="text-[10px] text-text-muted">
                    {new Date(c.quando).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-[11px] text-text-secondary flex-shrink-0">
                  {c.mandati} partiti{c.falliti > 0 ? ` · ${c.falliti} no` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
