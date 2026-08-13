'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Client } from '@/types';
import { getInitials } from '@/lib/helpers';
import { useClientStore } from '@/stores/useClientStore';
import { maiuscoleNome } from '@/lib/nomiPropri';

/** Ultime 9 cifre: confronta i numeri ignorando prefisso, spazi e trattini. */
function codaTelefono(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(-9);
}

export default function AddClientModal({ 
  onClose, 
  onSave,
  initialData
}: { 
  onClose: () => void; 
  onSave: (data: any) => void;
  initialData?: Client;
}) {
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [lastName, setLastName] = useState(initialData?.lastName || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [birthDate, setBirthDate] = useState(initialData?.birthDate || '');
  const [gender, setGender] = useState<'F' | 'M' | 'other'>(initialData?.gender || 'F');
  const [address, setAddress] = useState(initialData?.address || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  /**
   * I consensi nascono già spuntati su una scheda nuova.
   *
   * Al banco si chiedono a voce mentre si compila, e ricordarsi di spuntarli
   * dopo non succede quasi mai: risultato, quasi nessuno riceveva auguri né
   * l'avviso di un posto libero. Restano due caselle che si possono togliere
   * in un clic quando la cliente dice di no — e vanno tolte, perché il
   * consenso è suo, non nostro.
   *
   * In modifica invece si rispetta quello che c'è già scritto in scheda.
   */
  const [gdprConsent, setGdprConsent] = useState(initialData ? Boolean(initialData.gdprConsent) : true);
  const [marketingConsent, setMarketingConsent] = useState(initialData ? Boolean(initialData.marketingConsent) : true);
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');

  /**
   * Cliente già in anagrafica con questo numero: si scopre mentre si digita,
   * prima di perdere tempo a compilare il resto. Il salvataggio è comunque
   * bloccato anche dal server, per ogni altra strada.
   */
  const clienti = useClientStore(s => s.clients);
  const doppione = useMemo(() => {
    const coda = codaTelefono(phone);
    if (coda.length < 6) return null;
    return clienti.find(c => c.id !== initialData?.id && codaTelefono(c.phone) === coda) || null;
  }, [phone, clienti, initialData?.id]);

  /**
   * Stesso nome ma numero diverso: non blocca (due persone possono chiamarsi
   * uguale), però si fa notare — nove volte su dieci è la stessa cliente
   * registrata con un numero nuovo.
   */
  const omonimo = useMemo(() => {
    if (doppione) return null; // il blocco per numero ha già la precedenza
    const nome = `${firstName} ${lastName}`.toLowerCase().trim().replace(/\s+/g, ' ');
    if (nome.length < 5 || !firstName.trim() || !lastName.trim()) return null;
    return clienti.find(c =>
      c.id !== initialData?.id &&
      `${c.firstName} ${c.lastName}`.toLowerCase().trim().replace(/\s+/g, ' ') === nome
    ) || null;
  }, [firstName, lastName, clienti, initialData?.id, doppione]);

  const canSave = firstName.trim() && lastName.trim() && phone.trim() && !doppione;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      birthDate: birthDate || undefined,
      gender,
      address: address || undefined,
      city: city || undefined,
      notes: notes || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      vipLevel: initialData ? initialData.vipLevel : 0,
      gdprConsent,
      marketingConsent,
    });
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-lg font-display font-semibold text-text-primary">{initialData ? 'Modifica Cliente' : 'Nuovo Cliente'}</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* Avviso campi mancanti per profilo completo */}
            {(() => {
              const missing: string[] = [];
              if (!email.trim()) missing.push('Email');
              if (!birthDate) missing.push('Data di nascita');
              if (!address.trim()) missing.push('Indirizzo');
              if (missing.length === 0) return null;
              return (
                <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-warning/10 border border-warning/25">
                  <span className="text-warning text-sm mt-0.5">⚠️</span>
                  <p className="text-xs text-text-secondary">Per il profilo completo manca: <strong className="text-warning">{missing.join(', ')}</strong>. Sono i campi evidenziati in giallo.</p>
                </div>
              );
            })()}
            {/* Nome + Cognome */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(maiuscoleNome(e.target.value))} placeholder="Nome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Cognome *</label>
                <input type="text" value={lastName} onChange={e => setLastName(maiuscoleNome(e.target.value))} placeholder="Cognome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Telefono + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333..." className={`w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border text-sm text-text-primary placeholder-text-muted focus:outline-none transition-all ${doppione ? 'border-error bg-error/[0.06] focus:border-error' : 'border-border focus:border-accent/50'}`} /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email {!email.trim() && <span className="text-warning text-xs font-normal">• da completare</span>}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.it" className={`w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all ${!email.trim() ? 'border-warning/50 bg-warning/[0.04]' : 'border-border'}`} /></div>
            </div>
            {/* Doppione: si dice subito chi è e si va sulla sua scheda */}
            {doppione && (
              <div className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/[0.07] p-3">
                <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary">Questo numero è già in anagrafica</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    È di <b className="text-text-primary">{doppione.firstName} {doppione.lastName}</b> ({doppione.phone}).
                    Non creare una seconda scheda: apri la sua e completala.
                  </p>
                  <Link href={`/dashboard/clients/${doppione.id}`} onClick={onClose}
                    className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-error text-white text-xs font-bold hover:opacity-90 transition-opacity">
                    Apri la scheda di {doppione.firstName}
                  </Link>
                </div>
              </div>
            )}

            {/* Stesso nome ma numero diverso: si avvisa, non si blocca */}
            {omonimo && (
              <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/[0.07] p-3">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary">C&apos;è già una cliente con questo nome</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    <b className="text-text-primary">{omonimo.firstName} {omonimo.lastName}</b> con il numero {omonimo.phone}.
                    Se è la stessa persona con un numero nuovo, apri la sua scheda e cambia il numero lì.
                  </p>
                  <Link href={`/dashboard/clients/${omonimo.id}`} onClick={onClose}
                    className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-warning text-white text-xs font-bold hover:opacity-90 transition-opacity">
                    Apri la sua scheda
                  </Link>
                </div>
              </div>
            )}

            {/* Data nascita + Genere */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Data di Nascita {!birthDate && <span className="text-warning text-xs font-normal">• da completare</span>}</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={`w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all ${!birthDate ? 'border-warning/50 bg-warning/[0.04]' : 'border-border'}`} /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Genere</label>
                <div className="flex gap-2">
                  {([['F', 'Donna'], ['M', 'Uomo'], ['other', 'Altro']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setGender(val as any)} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${gender === val ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>{label}</button>
                  ))}
                </div></div>
            </div>
            {/* Indirizzo + Città */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Indirizzo {!address.trim() && <span className="text-warning text-xs font-normal">• da completare</span>}</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Via..." className={`w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all ${!address.trim() ? 'border-warning/50 bg-warning/[0.04]' : 'border-border'}`} /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Città</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Milano..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Tags */}
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Tag <span className="font-normal text-text-muted">(separati da virgola)</span></label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="Es. Sensibile, Allergica, VIP..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            {/* Note */}
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Note sul cliente..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all resize-none" /></div>
            {/* Consensi */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setGdprConsent(!gdprConsent)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${gdprConsent ? 'border-accent bg-accent' : 'border-border bg-bg-tertiary'}`}>
                  {gdprConsent && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm text-text-secondary">Consenso GDPR (trattamento dati)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setMarketingConsent(!marketingConsent)}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${marketingConsent ? 'border-accent bg-accent' : 'border-border bg-bg-tertiary'}`}>
                  {marketingConsent && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm text-text-secondary">Consenso Marketing (promozioni, SMS, email)</span>
              </label>
            </div>
            {/* Preview */}
            {canSave && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center text-white text-sm font-bold">{getInitials(firstName, lastName)}</div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{firstName} {lastName}</p>
                  <p className="text-xs text-text-muted">{phone}{email ? ` • ${email}` : ''}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              <CheckCircle className="w-4 h-4" /> {initialData ? 'Salva Modifiche' : 'Crea Cliente'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
