'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MessageCircle, CalendarPlus, Clock, CheckCircle, Ban, MessageSquare } from 'lucide-react';
import { useWaitlistStore, WaitlistEntry } from '@/stores/useWaitlistStore';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { mockOperators } from '@/lib/mock-data';
import { timeToMinutes, formatDateLong } from '@/lib/helpers';

export default function WaitlistPanel({ onClose, onOpenNew }: { onClose: () => void; onOpenNew: () => void }) {
  const { entries, updateStatus } = useWaitlistStore();
  const { appointments, addAppointment } = useAgendaStore();
  const treatments = useTreatmentStore(s => s.treatments);

  const activeEntries = entries.filter(e => e.status === 'waiting');

  const checkIsFree = (e: WaitlistEntry) => {
    const eStart = timeToMinutes(e.startTime);
    const eEnd = eStart + e.duration;

    if (e.operatorId) {
      const hasConflict = appointments.some(a => 
        a.date === e.date && a.operatorId === e.operatorId &&
        !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
      );
      return !hasConflict;
    } else {
      const isFree = mockOperators.some(op => {
        const hasConflict = appointments.some(a => 
          a.date === e.date && a.operatorId === op.id &&
          !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
        );
        return !hasConflict;
      });
      return isFree;
    }
  };

  const handleConvertToAppointment = (entry: WaitlistEntry) => {
    // Find free operator
    let opId = entry.operatorId;
    if (!opId) {
      const eStart = timeToMinutes(entry.startTime);
      const eEnd = eStart + entry.duration;
      const freeOp = mockOperators.find(op => {
        const hasConflict = appointments.some(a => 
          a.date === entry.date && a.operatorId === op.id &&
          !(timeToMinutes(a.endTime) <= eStart || timeToMinutes(a.startTime) >= eEnd)
        );
        return !hasConflict;
      });
      if (freeOp) opId = freeOp.id;
    }

    if (!opId) return; // shouldn't happen if they click when free

    const op = mockOperators.find(o => o.id === opId);
    const treatment = treatments.find(t => t.id === entry.treatmentId);
    
    // Add to agenda
    addAppointment({
      clientId: 'waitlist-client', // Dummy or actual if available
      clientName: entry.clientName,
      treatmentId: entry.treatmentId,
      treatmentName: entry.treatmentName,
      treatmentCategory: treatment?.category || 'facial',
      operatorId: opId,
      operatorName: op ? `${op.firstName} ${op.lastName}` : 'Staff',
      date: entry.date,
      startTime: entry.startTime,
      endTime: `${String(Math.floor((timeToMinutes(entry.startTime) + entry.duration) / 60)).padStart(2,'0')}:${String((timeToMinutes(entry.startTime) + entry.duration) % 60).padStart(2,'0')}`,
      duration: entry.duration,
      price: 0, // Should be fetched from treatment, but we don't store price in waitlist. Default 0 is ok for now.
      status: 'confirmed',
      color: '#A855F7',
      locationId: 'loc1',
      notes: `Da Lista Attesa: ${entry.notes}`,
      isLocked: false,
    });

    updateStatus(entry.id, 'converted');
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-bg-secondary border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div>
            <h2 className="text-lg font-display font-semibold text-text-primary">Clienti in Attesa</h2>
            <p className="text-xs text-text-secondary">{activeEntries.length} richieste pendenti</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenNew} className="p-2 rounded-xl bg-warning/10 hover:bg-warning/20 text-warning transition-colors" title="Aggiungi Nuova Richiesta">
              <CalendarPlus className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <CheckCircle className="w-8 h-8 text-success mb-2 opacity-50" />
              <p className="text-sm font-medium text-text-primary">Nessun cliente in attesa</p>
              <p className="text-xs text-text-secondary">La lista d'attesa è vuota.</p>
            </div>
          ) : (
            <AnimatePresence>
              {activeEntries.map(entry => {
                const isFree = checkIsFree(entry);
                return (
                  <motion.div key={entry.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-xl border-2 transition-all ${isFree ? 'border-warning bg-warning/5 shadow-glow' : 'border-border bg-bg-tertiary/50'}`}>
                    
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-text-primary">{entry.clientName}</h3>
                        <p className="text-xs text-text-secondary">{entry.treatmentName} ({entry.duration} min)</p>
                      </div>
                      {isFree && (
                        <span className="px-2 py-1 rounded-lg bg-warning text-white text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          Slot Libero!
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                        <span>{formatDateLong(entry.date)} alle <strong>{entry.startTime}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px]">👤</span>
                        <span>{entry.operatorName || 'Indifferente (Qualsiasi Operatrice)'}</span>
                      </div>
                      {entry.notes && (
                        <div className="mt-2 p-2 rounded-lg bg-bg-primary/50 text-xs text-text-secondary italic">
                          "{entry.notes}"
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <a href={`tel:${entry.phone}`} className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border hover:bg-bg-hover text-xs font-medium text-text-secondary transition-colors">
                        <Phone className="w-3.5 h-3.5" /> Chiama
                      </a>
                      <a href={`https://wa.me/${entry.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-medium transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                      <a href={`sms:${entry.phone}`} className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border hover:bg-bg-hover text-xs font-medium text-text-secondary transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" /> SMS
                      </a>
                    </div>

                    <div className="flex gap-2 border-t border-border/50 pt-3">
                      <button onClick={() => updateStatus(entry.id, 'dismissed')} className="flex-1 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-error hover:bg-error/10 transition-colors">
                        <Ban className="w-3.5 h-3.5 mx-auto mb-1" /> Non interessata
                      </button>
                      <button onClick={() => handleConvertToAppointment(entry)} disabled={!isFree}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 ${isFree ? 'bg-warning text-white shadow-lg shadow-warning/20' : 'bg-bg-primary text-text-muted cursor-not-allowed'}`}>
                        <CalendarPlus className="w-3.5 h-3.5" /> Inserisci
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </>
  );
}
