'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, CheckCircle } from 'lucide-react';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { Treatment, TreatmentCategory } from '@/types';
import { formatCurrency } from '@/lib/helpers';
import { getCategoryLabel } from '@/lib/helpers';

export const CATEGORIES = [
  { value: 'facial', label: 'Viso' }, { value: 'body', label: 'Corpo' }, { value: 'laser', label: 'Laser' },
  { value: 'massage', label: 'Massaggi' }, { value: 'nails', label: 'Unghie' }, { value: 'waxing', label: 'Depilazione' },
  { value: 'consultation', label: 'Consulenza' }, { value: 'hair', label: 'Capelli' }, { value: 'makeup', label: 'Trucco' },
];

export const TREATMENT_COLORS = ['#A855F7','#EC4899','#3B82F6','#22C55E','#F59E0B','#EF4444','#6366F1','#14B8A6','#8B5CF6','#F97316'];

export function TreatmentsSection() {
  const treatments = useTreatmentStore(s => s.treatments);
  const addTreatment = useTreatmentStore(s => s.addTreatment);
  const updateTreatment = useTreatmentStore(s => s.updateTreatment);
  const deleteTreatment = useTreatmentStore(s => s.deleteTreatment);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);

  // Modal state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('facial');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('#A855F7');

  const openAdd = () => { setEditing(null); setName(''); setCategory('facial'); setDuration('60'); setPrice(''); setColor('#A855F7'); setShowModal(true); };
  const openEdit = (t: Treatment) => { setEditing(t); setName(t.name); setCategory(t.category); setDuration(String(t.duration)); setPrice(String(t.price)); setColor(t.color); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = () => {
    if (!name.trim() || !price) return;
    if (editing) {
      updateTreatment(editing.id, { name: name.trim(), category: category as TreatmentCategory, duration: Number(duration), price: Number(price), color });
    } else {
      const newTreatment: Treatment = {
        id: `treat-${Date.now()}`, name: name.trim(), category: category as TreatmentCategory,
        duration: Number(duration), price: Number(price), color, isActive: true, description: '',
        requiresRoom: false, bufferBefore: 0, bufferAfter: 0,
      };
      addTreatment(newTreatment);
    }
    closeModal();
  };

  const handleDelete = (id: string) => { deleteTreatment(id); };

  const filtered = search.trim() ? treatments.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : treatments;

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-display font-semibold text-text-primary">Catalogo Trattamenti Base <span className="text-sm font-normal text-text-muted">({treatments.length})</span></h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..."
                className="pl-8 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all w-40" />
            </div>
            <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-text-primary text-xs font-medium hover:bg-bg-hover transition-all">
              <Plus className="w-3.5 h-3.5" /> Nuovo
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase">Trattamento</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase hidden sm:table-cell">Categoria</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase">Durata</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase">Prezzo</th>
              <th className="w-20"></th>
            </tr></thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-bg-hover transition-colors group">
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} /><span className="text-sm font-medium text-text-primary">{t.name}</span></div></td>
                  <td className="px-5 py-3 hidden sm:table-cell"><span className="text-xs text-text-secondary">{getCategoryLabel(t.category)}</span></td>
                  <td className="px-5 py-3 text-center"><span className="text-sm text-text-secondary">{t.duration} min</span></td>
                  <td className="px-5 py-3 text-right"><span className="text-sm font-semibold text-text-primary">{formatCurrency(t.price)}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-all" title="Modifica">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all" title="Elimina">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-10"><p className="text-text-muted text-sm">Nessun trattamento trovato</p></div>}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={closeModal} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && closeModal()}>
              <div className="w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="text-lg font-display font-semibold text-text-primary">{editing ? 'Modifica Trattamento' : 'Nuovo Trattamento'}</h3>
                  <button onClick={closeModal} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Pulizia Viso Profonda..."
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Durata (min)</label>
                      <select value={duration} onChange={e => setDuration(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                        {[15,20,30,45,60,75,90,120,150,180].map(d => <option key={d} value={d}>{d} min</option>)}
                      </select></div>
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Prezzo (€) *</label>
                      <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-2">Colore</label>
                    <div className="flex gap-2 flex-wrap">
                      {TREATMENT_COLORS.map(c => (
                        <button key={c} onClick={() => setColor(c)}
                          className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-bg-secondary scale-110' : 'hover:scale-110'}`}
                          style={{ backgroundColor: c, ...(color === c ? { boxShadow: `0 0 10px ${c}50` } : {}) }} />
                      ))}
                    </div>
                  </div>
                  {/* Preview */}
                  {name.trim() && price && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                      <div className="w-3 h-10 rounded-full" style={{ backgroundColor: color }} />
                      <div><p className="text-sm font-medium text-text-primary">{name}</p><p className="text-xs text-text-muted">{getCategoryLabel(category)} • {duration} min • {formatCurrency(Number(price))}</p></div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
                  <button onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
                  <button onClick={handleSave} disabled={!name.trim() || !price}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${name.trim() && price ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                    <CheckCircle className="w-4 h-4" /> {editing ? 'Salva Modifiche' : 'Aggiungi'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
