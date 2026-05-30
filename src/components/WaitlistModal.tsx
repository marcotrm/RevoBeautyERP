'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserCircle, Clock, Save, ListTodo } from 'lucide-react';
import { useWaitlistStore, WaitlistEntry } from '@/stores/useWaitlistStore';
import { useClientStore } from '@/stores/useClientStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { mockOperators } from '@/lib/mock-data';
import { getInitials } from '@/lib/helpers';

export default function WaitlistModal({
  onClose,
  initialData,
}: {
  onClose: () => void;
  initialData?: Partial<WaitlistEntry>;
}) {
  const { addEntry } = useWaitlistStore();
  const allClients = useClientStore(s => s.clients);
  const treatments = useTreatmentStore(s => s.treatments);

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState(initialData?.clientName || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [selectedTreatmentId, setSelectedTreatmentId] = useState(initialData?.treatmentId || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(initialData?.startTime || '10:00');
  const [operatorId, setOperatorId] = useState(initialData?.operatorId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const filteredClients = clientSearch.trim()
    ? allClients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch)).slice(0, 5)
    : [];

  useEffect(() => {
    if (selectedClientId) {
      const c = allClients.find(x => x.id === selectedClientId);
      if (c) setPhone(c.phone);
    }
  }, [selectedClientId, allClients]);

  const handleSave = () => {
    const t = treatments.find(x => x.id === selectedTreatmentId);
    if (!selectedClientName || !t) return;
    
    addEntry({
      clientName: selectedClientName,
      phone,
      treatmentId: t.id,
      treatmentName: t.name,
      duration: t.duration,
      date,
      startTime,
      operatorId: operatorId || undefined,
      notes,
    });
    onClose();
  };

  const START_HOUR = 8;
  const END_HOUR = 21;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-[71] flex items-center justify-center sm:p-4 pointer-events-none">
        <div className="pointer-events-auto w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-warning/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                <ListTodo className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold text-text-primary">Aggiungi a Lista d'Attesa</h3>
                <p className="text-xs text-text-secondary">Il cliente verrà avvisato appena si libera un posto.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>

          <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
            {/* Cliente */}
            <div className="relative">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Cliente *</label>
              {selectedClientName ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary border border-border">
                  <UserCircle className="w-5 h-5 text-warning" />
                  <span className="text-sm font-medium text-text-primary flex-1">{selectedClientName}</span>
                  <button onClick={() => { setSelectedClientId(''); setSelectedClientName(''); setClientSearch(''); setPhone(''); }} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input type="text" value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                      placeholder="Cerca cliente o scrivi il nome..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-warning/50 transition-all" />
                  </div>
                  {showClientDropdown && clientSearch && (
                    <div className="absolute left-0 right-0 mt-1 bg-bg-tertiary border border-border rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                      <button onClick={() => { setSelectedClientName(clientSearch); setShowClientDropdown(false); }} className="w-full text-left px-3 py-2.5 text-sm font-medium text-warning hover:bg-bg-hover border-b border-border/50">
                        + Usa "{clientSearch}" come nuovo
                      </button>
                      {filteredClients.map(client => (
                        <button key={client.id} onClick={() => { setSelectedClientId(client.id); setSelectedClientName(`${client.firstName} ${client.lastName}`); setShowClientDropdown(false); setClientSearch(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left">
                          <div className="w-7 h-7 rounded-full bg-warning/20 text-warning flex items-center justify-center text-xs font-bold">{getInitials(client.firstName, client.lastName)}</div>
                          <div className="min-w-0"><p className="text-sm font-medium text-text-primary">{client.firstName} {client.lastName}</p><p className="text-xs text-text-muted">{client.phone}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Telefono */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono (per contatto rapido)</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333 1234567"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50" />
            </div>

            {/* Trattamento */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Trattamento Richiesto *</label>
              <select value={selectedTreatmentId} onChange={e => setSelectedTreatmentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50 appearance-none">
                <option value="">Seleziona trattamento...</option>
                {treatments.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.duration} min)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Data Desiderata</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Ora Desiderata</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50 appearance-none">
                  {Array.from({ length: (END_HOUR - START_HOUR) * 4 }, (_, i) => { const t = START_HOUR*60+i*15; const h=String(Math.floor(t/60)).padStart(2,'0'); const m=String(t%60).padStart(2,'0'); return <option key={i} value={`${h}:${m}`}>{h}:{m}</option>; })}
                </select>
              </div>
            </div>

            {/* Operatrice */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Operatrice / Cabina Preferita (Opzionale)</label>
              <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-warning/50 appearance-none">
                <option value="">Indifferente (Qualsiasi Operatrice)</option>
                {mockOperators.map(o => (
                  <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Es. Solo mattina, chiamare prima..." rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-warning/50 resize-none" />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30 flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
              Annulla
            </button>
            <button onClick={handleSave} disabled={!selectedClientName || !selectedTreatmentId} 
              className={`px-5 py-2 rounded-xl text-white text-sm font-medium transition-all ${selectedClientName && selectedTreatmentId ? 'bg-warning hover:bg-warning/90 shadow-lg shadow-warning/20' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
              Salva in Lista
            </button>
          </div>

        </div>
      </motion.div>
    </>
  );
}
