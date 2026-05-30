'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';
import { Client } from '@/types';
import { getInitials } from '@/lib/helpers';

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
  const [gdprConsent, setGdprConsent] = useState(initialData?.gdprConsent || false);
  const [marketingConsent, setMarketingConsent] = useState(initialData?.marketingConsent || false);
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');

  const canSave = firstName.trim() && lastName.trim() && phone.trim();

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
            {/* Nome + Cognome */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Cognome *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Cognome..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Telefono + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.it" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            {/* Data nascita + Genere */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Data di Nascita</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Genere</label>
                <div className="flex gap-2">
                  {([['F', 'Donna'], ['M', 'Uomo'], ['other', 'Altro']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setGender(val as any)} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${gender === val ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-light'}`}>{label}</button>
                  ))}
                </div></div>
            </div>
            {/* Indirizzo + Città */}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Indirizzo</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Via..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
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
