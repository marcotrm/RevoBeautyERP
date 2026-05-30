'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, CreditCard, X, CheckCircle, Trash2, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  getTotalFixedCostsMonthly, getFixedCostsByCategory,
  FIXED_COST_CATEGORY_LABELS, FIXED_COST_CATEGORY_COLORS, FixedCost,
} from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useFixedCostStore } from '@/stores/useFixedCostStore';

const FREQ_LABELS: Record<string, string> = { mensile: 'Mensile', trimestrale: 'Trimestrale', annuale: 'Annuale', una_tantum: 'Una tantum' };
const PAY_LABELS: Record<string, string> = { bonifico: 'Bonifico', rid: 'RID', carta: 'Carta', contanti: 'Contanti', assegno: 'Assegno' };
const CATEGORIES = ['personale', 'struttura', 'utenze', 'tasse', 'marketing'] as const;

function CostModal({ onClose, onSave, initialData }: { onClose: () => void; onSave: (c: FixedCost) => void; initialData?: FixedCost | null }) {
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState<string>(initialData?.category || 'personale');
  const [subcategory, setSubcategory] = useState(initialData?.subcategory || '');
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [frequency, setFrequency] = useState<string>(initialData?.frequency || 'mensile');
  const [paymentDate, setPaymentDate] = useState(initialData?.paymentDate ? String(initialData.paymentDate) : '1');
  const [paymentMethod, setPaymentMethod] = useState<string>(initialData?.paymentMethod || 'bonifico');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const canSave = name.trim() && Number(amount) > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initialData ? initialData.id : `fc-${Date.now()}`, 
      name: name.trim(), 
      category: category as FixedCost['category'],
      subcategory: subcategory || name.trim(), 
      amount: Number(amount),
      frequency: frequency as FixedCost['frequency'], 
      paymentDate: Number(paymentDate),
      paymentMethod: paymentMethod as FixedCost['paymentMethod'], 
      notes, 
      isActive: initialData ? initialData.isActive : true,
    });
    onClose();
  };
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }} className="fixed inset-0 z-[61] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-display font-semibold text-text-primary">{initialData ? 'Modifica Costo Fisso' : 'Nuovo Costo Fisso'}</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Affitto locale, Stipendio..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria *</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{FIXED_COST_CATEGORY_LABELS[c]}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Sottocategoria</label>
                <input type="text" value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="Es. Stipendi, Affitto..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Importo € *</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Frequenza</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  <option value="mensile">Mensile</option><option value="trimestrale">Trimestrale</option><option value="annuale">Annuale</option><option value="una_tantum">Una tantum</option>
                </select></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Giorno Pag.</label>
                <input type="number" min="1" max="31" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Metodo Pagamento</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  <option value="bonifico">Bonifico</option><option value="rid">RID</option><option value="carta">Carta</option><option value="contanti">Contanti</option><option value="assegno">Assegno</option>
                </select></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}><CheckCircle className="w-4 h-4" /> {initialData ? 'Salva Modifiche' : 'Aggiungi'}</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function FixedCostsPage() {
  const { fixedCosts: costs, addFixedCost, updateFixedCost, deleteFixedCost } = useFixedCostStore();
  const [showModal, setShowModal] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);
  const totalMonthly = getTotalFixedCostsMonthly(costs);
  const byCategory = getFixedCostsByCategory(costs);
  const categories = Object.keys(byCategory);
  const topCategory = categories.length > 0 ? categories.reduce((a, b) => byCategory[a] > byCategory[b] ? a : b, categories[0]) : '';
  const pieData = useMemo(() => Object.entries(byCategory).map(([cat, val]) => ({ name: FIXED_COST_CATEGORY_LABELS[cat] || cat, value: Math.round(val), color: FIXED_COST_CATEGORY_COLORS[cat] || '#666' })), [byCategory]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-display font-bold text-text-primary">Costi Fissi</h2><p className="text-sm text-text-secondary">Gestione costi fissi mensili, trimestrali e annuali</p></div>
        <button onClick={() => { setEditingCost(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105"><Plus className="w-4 h-4" /> Aggiungi Costo</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Mensile</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(totalMonthly)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Annuale</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(totalMonthly * 12)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Categoria Top</p>{topCategory && <><p className="text-lg font-display font-bold mt-1" style={{ color: FIXED_COST_CATEGORY_COLORS[topCategory] }}>{FIXED_COST_CATEGORY_LABELS[topCategory]}</p><p className="text-xs text-text-muted">{formatCurrency(byCategory[topCategory])}/mese</p></>}</div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Voci Attive</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{costs.filter(c => c.isActive).length}</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {categories.map(cat => {
            const items = costs.filter(c => c.category === cat && c.isActive);
            const color = FIXED_COST_CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /><h3 className="text-sm font-display font-semibold text-text-primary">{FIXED_COST_CATEGORY_LABELS[cat]}</h3></div>
                  <span className="text-sm font-bold text-text-primary">{formatCurrency(byCategory[cat])}/mese</span>
                </div>
                <div className="divide-y divide-border/30">{items.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-hover transition-colors group">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary">{item.name}</p><p className="text-xs text-text-muted">{item.subcategory}</p></div>
                    <div className="hidden sm:flex items-center gap-4 text-xs text-text-secondary">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.paymentDate} del mese</span>
                      <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />{PAY_LABELS[item.paymentMethod]}</span>
                      <span className="px-2 py-0.5 rounded-full bg-bg-tertiary">{FREQ_LABELS[item.frequency]}</span>
                    </div>
                    <span className="text-sm font-semibold text-text-primary mr-2">{formatCurrency(item.amount)}</span>
                    <button onClick={() => { setEditingCost(item); setShowModal(true); }} className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-accent transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if(window.confirm('Eliminare questo costo fisso?')) deleteFixedCost(item.id); }} className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}</div>
              </div>
            );
          })}
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 h-fit sticky top-4">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Distribuzione Costi</h3>
          <div className="h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie></PieChart></ResponsiveContainer></div>
          <div className="space-y-2 mt-3">{pieData.map(item => (<div key={item.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-xs text-text-secondary">{item.name}</span></div><span className="text-xs font-bold text-text-primary">{formatCurrency(item.value)}</span></div>))}</div>
        </div>
      </div>
      <AnimatePresence>
        {showModal && (
          <CostModal 
            initialData={editingCost}
            onClose={() => { setShowModal(false); setEditingCost(null); }} 
            onSave={c => {
              if (editingCost) {
                updateFixedCost(c.id, c);
              } else {
                addFixedCost(c);
              }
            }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
