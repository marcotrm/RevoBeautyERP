'use client';

/**
 * Email e SMS: le chiavi e la prova.
 *
 * Le chiavi si incollano qui e non tornano piu' indietro: a schermo resta
 * scritto solo se ci sono. Il tasto "prova" e' la parte importante — un
 * canale che nessuno ha mai provato e' un canale che non funziona, e lo si
 * scopre il giorno in cui serve.
 */

import React, { useEffect, useState } from 'react';
import { AtSign, Check, Loader2, MessageSquare, Save, Send } from 'lucide-react';
import { provaCanale, raggiungibili, salvaConfigCanali, statoCanali, type RaggiungibiliCanale, type StatoCanali } from '@/app/actions/canali';

export function CanaliConfig() {
  const [stato, setStato] = useState<StatoCanali | null>(null);
  const [conti, setConti] = useState<RaggiungibiliCanale | null>(null);
  const [chiaveEmail, setChiaveEmail] = useState('');
  const [passwordSms, setPasswordSms] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fatto, setFatto] = useState(false);
  const [prova, setProva] = useState({ email: '', sms: '' });
  const [esito, setEsito] = useState<Record<string, string>>({});
  const [provando, setProvando] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([statoCanali(), raggiungibili()])
      .then(([s, r]) => { if (vivo) { setStato(s); setConti(r); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!stato) {
    return (
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Carico…
      </div>
    );
  }

  const salva = async () => {
    setSalvando(true);
    try {
      await salvaConfigCanali({
        emailAttiva: stato.emailAttiva,
        emailMittente: stato.emailMittente,
        emailRispostaA: stato.emailRispostaA,
        smsAttivo: stato.smsAttivo,
        smsMittente: stato.smsMittente,
        skebbyUser: stato.skebbyUser,
        ...(chiaveEmail.trim() ? { resendApiKey: chiaveEmail.trim() } : {}),
        ...(passwordSms.trim() ? { skebbyPassword: passwordSms.trim() } : {}),
      });
      setChiaveEmail(''); setPasswordSms('');
      const s = await statoCanali();
      setStato(s);
      setFatto(true);
      setTimeout(() => setFatto(false), 2500);
    } finally { setSalvando(false); }
  };

  const faiProva = async (canale: 'email' | 'sms') => {
    const dove = canale === 'email' ? prova.email.trim() : prova.sms.trim();
    if (!dove) return;
    setProvando(canale);
    try {
      const r = await provaCanale(canale, dove);
      setEsito(p => ({ ...p, [canale]: r.ok ? 'Partito: controlla se è arrivato.' : (r.error || 'Non è partito') }));
    } finally { setProvando(''); }
  };

  const campo = (etichetta: string, valore: string, onChange: (v: string) => void, placeholder?: string, aiuto?: string) => (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{etichetta}</label>
      <input type="text" value={valore} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
      {aiuto && <p className="text-[10px] text-text-muted mt-1">{aiuto}</p>}
    </div>
  );

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="text-lg font-display font-semibold text-text-primary">Email e SMS</h3>
        <p className="text-xs text-text-muted">
          La seconda strada per chi su WhatsApp non arriva. Non sostituiscono WhatsApp: lo coprono.
        </p>
      </div>

      {conti && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Con email', conti.conEmail, conti.raggiungibiliEmail],
            ['Con telefono', conti.conTelefono, conti.raggiungibiliSms],
            ['Con consenso', conti.conConsenso, conti.conConsenso],
          ].map(([label, quante, raggiungibili]) => (
            <div key={String(label)} className="p-3 rounded-xl bg-bg-tertiary/50 border border-border">
              <p className="text-[11px] text-text-muted">{label}</p>
              <p className="text-lg font-display font-bold text-text-primary">{quante as number}</p>
              <p className="text-[10px] text-text-muted">{raggiungibili as number} scrivibili</p>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- EMAIL ---------------- */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-text-primary">Email</p>
            {stato.chiaveEmailPresente && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">chiave salvata</span>}
          </div>
          <button onClick={() => setStato(s => s && ({ ...s, emailAttiva: !s.emailAttiva }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${stato.emailAttiva ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${stato.emailAttiva ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campo('Mittente', stato.emailMittente, v => setStato(s => s && ({ ...s, emailMittente: v })), 'RevoBeauty <ciao@revobeauty.it>', 'il dominio va verificato su Resend, una volta sola')}
          {campo('Rispondono a', stato.emailRispostaA, v => setStato(s => s && ({ ...s, emailRispostaA: v })), 'info@revobeauty.it')}
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Chiave Resend</label>
          <input type="password" value={chiaveEmail} onChange={e => setChiaveEmail(e.target.value)}
            placeholder={stato.chiaveEmailPresente ? '•••••••• (già salvata, scrivi solo per cambiarla)' : 're_…'}
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
          <p className="text-[10px] text-text-muted mt-1">Si crea gratis su resend.com — 3.000 email al mese incluse.</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={prova.email} onChange={e => setProva(p => ({ ...p, email: e.target.value }))}
            placeholder="mandala a te stesso per provare"
            className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
          <button onClick={() => faiProva('email')} disabled={provando === 'email' || !prova.email.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40">
            {provando === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Prova
          </button>
        </div>
        {esito.email && <p className="text-[11px] text-text-secondary">{esito.email}</p>}
      </div>

      {/* ---------------- SMS ---------------- */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-text-primary">SMS</p>
            {stato.passwordSmsPresente && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">password salvata</span>}
          </div>
          <button onClick={() => setStato(s => s && ({ ...s, smsAttivo: !s.smsAttivo }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${stato.smsAttivo ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${stato.smsAttivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campo('Utente Skebby', stato.skebbyUser, v => setStato(s => s && ({ ...s, skebbyUser: v })), 'la tua email Skebby')}
          {campo('Mittente', stato.smsMittente, v => setStato(s => s && ({ ...s, smsMittente: v.slice(0, 11) })), 'RevoBeauty', 'massimo 11 caratteri: è il nome che legge la cliente')}
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Password Skebby</label>
          <input type="password" value={passwordSms} onChange={e => setPasswordSms(e.target.value)}
            placeholder={stato.passwordSmsPresente ? '•••••••• (già salvata)' : 'la tua password'}
            className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
          <p className="text-[10px] text-text-muted mt-1">Gli SMS si pagano a consumo, pochi centesimi l’uno: tienili per le cose che devono arrivare.</p>
        </div>
        <div className="flex gap-2">
          <input type="text" value={prova.sms} onChange={e => setProva(p => ({ ...p, sms: e.target.value }))}
            placeholder="il tuo numero, per provare"
            className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
          <button onClick={() => faiProva('sms')} disabled={provando === 'sms' || !prova.sms.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-bg-hover disabled:opacity-40">
            {provando === 'sms' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Prova
          </button>
        </div>
        {esito.sms && <p className="text-[11px] text-text-secondary">{esito.sms}</p>}
      </div>

      <button onClick={salva} disabled={salvando}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold disabled:opacity-50">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : fatto ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {fatto ? 'Salvato' : 'Salva'}
      </button>
    </div>
  );
}
