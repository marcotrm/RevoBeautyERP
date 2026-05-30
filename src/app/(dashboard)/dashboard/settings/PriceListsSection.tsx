'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, CheckCircle, X, Search } from 'lucide-react';
import { usePriceListStore } from '@/stores/usePriceListStore';
import { PriceList } from '@/types';

export function PriceListsSection() {
  const { priceLists, addPriceList, updatePriceList, deletePriceList } = usePriceListStore();
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [formData, setFormData] = useState({ name: '', discountPercentage: '' });

  const filtered = priceLists.filter(pl => pl.name.toLowerCase().includes(search.toLowerCase()));

  const handleOpenModal = (pl?: PriceList) => {
    if (pl) {
      setEditingList(pl);
      setFormData({ name: pl.name, discountPercentage: String(pl.discountPercentage) });
    } else {
      setEditingList(null);
      setFormData({ name: '', discountPercentage: '' });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.discountPercentage) return;
    const discount = Math.min(100, Math.max(0, Number(formData.discountPercentage)));
    
    if (editingList) {
      updatePriceList(editingList.id, { name: formData.name, discountPercentage: discount });
    } else {
      addPriceList({ name: formData.name, discountPercentage: discount, isActive: true });
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Cerca listino..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:shadow-lg hover:shadow-accent/20 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Nuovo Listino
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(pl => (
          <div key={pl.id} className="bg-bg-secondary border border-border rounded-xl p-4 flex flex-col justify-between hover:border-accent/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-base font-semibold text-text-primary">{pl.name}</h4>
                <p className="text-sm text-text-secondary mt-1">Sconto applicato su servizi</p>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent font-bold text-sm">
                -{pl.discountPercentage}%
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-4 border-t border-border/50">
              <button 
                onClick={() => handleOpenModal(pl)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" /> Modifica
              </button>
              <button 
                onClick={() => { if(confirm('Sicuro di voler eliminare questo listino?')) deletePriceList(pl.id); }}
                className="p-2 rounded-lg bg-bg-tertiary text-text-muted hover:text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4 pointer-events-none">
              <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <h3 className="text-lg font-display font-semibold text-text-primary">{editingList ? 'Modifica Listino' : 'Nuovo Listino'}</h3>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nome Listino</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Es. VIP, Gold..." className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Sconto (%)</label>
                    <div className="relative">
                      <input type="number" min="0" max="100" value={formData.discountPercentage} onChange={e => setFormData({ ...formData, discountPercentage: e.target.value })} placeholder="10" className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">%</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
                  <button onClick={handleSave} disabled={!formData.name.trim() || !formData.discountPercentage} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle className="w-4 h-4" /> {editingList ? 'Salva Modifiche' : 'Crea Listino'}
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
