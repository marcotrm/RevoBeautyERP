'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogIn, LogOut, Coffee, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useTimeClockStore } from '@/stores/useTimeClockStore';

// Simple mock for staff members
const MOCK_STAFF = [
  { id: '1', name: 'Valentina', role: 'Estetista Senior', color: '#EC4899' },
  { id: '2', name: 'Francesca', role: 'Estetista', color: '#8B5CF6' },
  { id: '3', name: 'Sara', role: 'Receptionist', color: '#3B82F6' },
  { id: '4', name: 'Dino', role: 'Titolare', color: '#F59E0B' },
];

export default function KioskPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState<typeof MOCK_STAFF[0] | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const { addPunch, getStaffStatus } = useTimeClockStore();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = (type: 'in' | 'out' | 'break_start' | 'break_end') => {
    if (!selectedStaff) return;
    
    addPunch({
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      type,
      timestamp: new Date().toISOString()
    });

    let msg = '';
    if (type === 'in') msg = 'Entrata registrata';
    if (type === 'out') msg = 'Uscita registrata';
    if (type === 'break_start') msg = 'Inizio pausa registrato';
    if (type === 'break_end') msg = 'Fine pausa registrata';

    setShowSuccess(msg);
    setTimeout(() => {
      setShowSuccess(null);
      setSelectedStaff(null);
    }, 2000);
  };

  const renderButtons = () => {
    if (!selectedStaff) return null;
    const status = getStaffStatus(selectedStaff.id);

    if (status === 'out') {
      return (
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => handlePunch('in')}
          className="w-full py-6 rounded-2xl bg-success/10 border-2 border-success text-success text-2xl font-bold hover:bg-success/20 transition-all flex items-center justify-center gap-3">
          <LogIn className="w-8 h-8" /> Entrata
        </motion.button>
      );
    }

    if (status === 'in') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          <button onClick={() => handlePunch('break_start')}
            className="py-6 rounded-2xl bg-warning/10 border-2 border-warning text-warning text-xl font-bold hover:bg-warning/20 transition-all flex items-center justify-center gap-3">
            <Coffee className="w-7 h-7" /> Inizio Pausa
          </button>
          <button onClick={() => handlePunch('out')}
            className="py-6 rounded-2xl bg-error/10 border-2 border-error text-error text-xl font-bold hover:bg-error/20 transition-all flex items-center justify-center gap-3">
            <LogOut className="w-7 h-7" /> Uscita
          </button>
        </motion.div>
      );
    }

    if (status === 'on_break') {
      return (
        <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => handlePunch('break_end')}
          className="w-full py-6 rounded-2xl bg-blue-500/10 border-2 border-blue-500 text-blue-500 text-2xl font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center gap-3">
          <Coffee className="w-8 h-8" /> Fine Pausa
        </motion.button>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-bg-main overflow-hidden flex flex-col">
      {/* Topbar Kiosk */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-bg-secondary">
        <Link href="/dashboard/staff" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-6 h-6" /> <span className="font-medium text-lg">Torna al Gestionale</span>
        </Link>
        <div className="flex items-center gap-3 text-accent">
          <Clock className="w-8 h-8" />
          <div className="text-right">
            <h1 className="text-3xl font-display font-bold leading-none">
              {currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </h1>
            <p className="text-sm font-medium text-text-secondary mt-1">
              {currentTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center text-center">
              <CheckCircle className="w-24 h-24 text-success mb-6" />
              <h2 className="text-3xl font-display font-bold text-text-primary mb-2">{showSuccess}</h2>
              <p className="text-xl text-text-secondary">Grazie, {selectedStaff?.name}!</p>
            </motion.div>
          ) : selectedStaff ? (
            <motion.div key="action" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-2xl bg-bg-secondary border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
              
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-6 shadow-lg"
                style={{ backgroundColor: selectedStaff.color }}>
                {selectedStaff.name.charAt(0)}
              </div>
              <h2 className="text-3xl font-display font-bold text-text-primary mb-2">Ciao, {selectedStaff.name}!</h2>
              <p className="text-text-secondary mb-8 text-lg">Cosa vuoi fare?</p>

              {renderButtons()}

              <button onClick={() => setSelectedStaff(null)} className="mt-8 text-text-muted hover:text-text-primary transition-colors underline">
                Annulla
              </button>
            </motion.div>
          ) : (
            <motion.div key="select" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-4xl text-center">
              <h2 className="text-4xl font-display font-bold text-text-primary mb-12">Seleziona il tuo profilo</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {MOCK_STAFF.map(staff => {
                  const status = getStaffStatus(staff.id);
                  let statusLabel = 'Fuori';
                  let statusColor = 'bg-bg-tertiary text-text-muted';
                  if (status === 'in') { statusLabel = 'In Turno'; statusColor = 'bg-success/10 text-success ring-1 ring-success/30'; }
                  if (status === 'on_break') { statusLabel = 'In Pausa'; statusColor = 'bg-warning/10 text-warning ring-1 ring-warning/30'; }

                  return (
                    <button key={staff.id} onClick={() => setSelectedStaff(staff)}
                      className="bg-bg-secondary border border-border hover:border-accent/50 rounded-3xl p-6 flex flex-col items-center transition-all hover:scale-105 group relative overflow-hidden">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg transition-transform group-hover:scale-110"
                        style={{ backgroundColor: staff.color }}>
                        {staff.name.charAt(0)}
                      </div>
                      <h3 className="text-xl font-bold text-text-primary mb-1">{staff.name}</h3>
                      <p className="text-sm text-text-secondary mb-4">{staff.role}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
