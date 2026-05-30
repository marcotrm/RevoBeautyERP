'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, CheckCircle, Trash2, Edit2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { INVESTMENT_CATEGORY_LABELS, Investment } from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useInvestmentStore } from '@/stores/useInvestmentStore';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pianificato: { bg: 'bg-warning/10', text: 'text-warning', label: 'Pianificato' },
  in_corso: { bg: 'bg-info/10', text: 'text-info', label: 'In Corso' },
  completato: { bg: 'bg-success/10', text: 'text-success', label: 'Completato' },
  annullato: { bg: 'bg-error/10', text: 'text-error', label: 'Annullato' },
};
const INV_CATEGORIES = Object.keys(INVESTMENT_CATEGORY_LABELS);

function InvestmentModal({ onClose, onSave, initialData }: { onClose: () => void; onSave: (i: Investment) => void; initialData?: Investment | null }) {
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || 'macchinari');
  const [totalCost, setTotalCost] = useState(initialData?.totalCost ? String(initialData.totalCost) : '');
  const [supplier, setSupplier] = useState(initialData?.supplier || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Bonifico');
  const [estimatedROI, setEstimatedROI] = useState(initialData?.estimatedROI ? String(initialData.estimatedROI) : '100');
  const [amortYears, setAmortYears] = useState(initialData?.amortizationYears ? String(initialData.amortizationYears) : '5');
  const [installments, setInstallments] = useState(initialData?.installments ? String(initialData.installments) : '');
  const [status, setStatus] = useState(initialData?.status || 'pianificato');
  const [actualROI, setActualROI] = useState(initialData?.actualROI ? String(initialData.actualROI) : '');
  const [installmentsPaid, setInstallmentsPaid] = useState(initialData?.installmentsPaid ? String(initialData.installmentsPaid) : '0');
  const canSave = name.trim() && Number(totalCost) > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initialData ? initialData.id : `inv-${Date.now()}`, 
      name: name.trim(), 
      category: category as Investment['category'],
      totalCost: Number(totalCost), 
      date: initialData ? initialData.date : new Date().toISOString().slice(0, 10), 
      supplier,
      paymentMethod, 
      installments: Number(installments) || undefined, 
      installmentsPaid: Number(installmentsPaid) || 0,
      estimatedROI: Number(estimatedROI), 
      status: status as Investment['status'],
      amortizationYears: Number(amortYears),
      actualROI: actualROI ? Number(actualROI) : undefined,
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
            <h3 className="text-lg font-display font-semibold text-text-primary">{initialData ? 'Modifica Investimento' : 'Nuovo Investimento'}</h3>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome Investimento *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Laser a diodo, Ristrutturazione..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  {INV_CATEGORIES.map(c => <option key={c} value={c}>{INVESTMENT_CATEGORY_LABELS[c]}</option>)}
                </select></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Costo Totale € *</label>
                <input type="number" value={totalCost} onChange={e => setTotalCost(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Fornitore</label>
                <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nome fornitore..." className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Metodo Pagamento</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                  <option>Bonifico</option><option>Finanziamento</option><option>Leasing</option><option>Carta</option>
                </select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">ROI Stimato %</label>
                <input type="number" value={estimatedROI} onChange={e => setEstimatedROI(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Ammort. Anni</label>
                <input type="number" value={amortYears} onChange={e => setAmortYears(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">N° Rate</label>
                <input type="number" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="0 = no rate" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
            <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Stato</label>
              <div className="flex gap-2">{Object.entries(STATUS_STYLES).map(([k, v]) => (
                <button key={k} onClick={() => setStatus(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === k ? `${v.bg} ${v.text} border border-current/20` : 'bg-bg-tertiary text-text-secondary border border-border'}`}>{v.label}</button>
              ))}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Rate Pagate</label>
                <input type="number" value={installmentsPaid} onChange={e => setInstallmentsPaid(e.target.value)} disabled={!installments || Number(installments) === 0} className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50" /></div>
              <div><label className="block text-sm font-medium text-text-secondary mb-1.5">ROI Reale %</label>
                <input type="number" value={actualROI} onChange={e => setActualROI(e.target.value)} placeholder="Opzionale" className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
            <button onClick={handleSave} disabled={!canSave} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${canSave ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}><CheckCircle className="w-4 h-4" /> {initialData ? 'Salva Modifiche' : 'Crea Investimento'}</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function InvestmentsPage() {
  const { investments, addInvestment, updateInvestment, deleteInvestment } = useInvestmentStore();
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const filtered = filter === 'all' ? investments : investments.filter(i => i.status === filter);
  const totalInvested = investments.filter(i => i.status !== 'annullato').reduce((s, i) => s + i.totalCost, 0);
  const withROI = investments.filter(i => i.actualROI);
  const avgROI = withROI.length > 0 ? Math.round(withROI.reduce((s, i) => s + (i.actualROI || 0), 0) / withROI.length) : 0;
  const activeCount = investments.filter(i => i.status === 'in_corso').length;
  const monthlyAmort = Math.round(investments.filter(i => i.status !== 'annullato').reduce((s, i) => s + i.totalCost / (i.amortizationYears * 12), 0));
  const roiData = investments.filter(i => i.status !== 'annullato').map(i => ({ name: i.name.length > 20 ? i.name.slice(0, 20) + '...' : i.name, estimated: i.estimatedROI, actual: i.actualROI || 0 }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-display font-bold text-text-primary">Investimenti</h2><p className="text-sm text-text-secondary">Macchinari, formazione, ristrutturazioni e ROI</p></div>
        <button onClick={() => { setEditingInv(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all hover:scale-105"><Plus className="w-4 h-4" /> Nuovo Investimento</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Investito</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(totalInvested)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">ROI Medio</p><p className="text-2xl font-display font-bold text-success mt-1">{avgROI}%</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Investimenti Attivi</p><p className="text-2xl font-display font-bold text-accent mt-1">{activeCount}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Ammortamento/Mese</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(monthlyAmort)}</p></div>
      </div>
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary mb-4">ROI Stimato vs Reale</h3>
        <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={roiData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A5' }} tickFormatter={v => `${v}%`} />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A5' }} width={150} />
          <Tooltip contentStyle={{ background: '#1A1D27', border: '1px solid #2E3348', borderRadius: 12, fontSize: 12 }} formatter={(v) => `${v}%`} />
          <Bar dataKey="estimated" name="ROI Stimato" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={12} /><Bar dataKey="actual" name="ROI Reale" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart></ResponsiveContainer></div>
      </div>
      <div className="flex gap-2">
        {['all', 'pianificato', 'in_corso', 'completato'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'}`}>{f === 'all' ? 'Tutti' : STATUS_STYLES[f].label}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(inv => {
          const st = STATUS_STYLES[inv.status]; const progress = inv.installments ? Math.round(((inv.installmentsPaid || 0) / inv.installments) * 100) : 100;
          return (
            <div key={inv.id} className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-border-light transition-all relative">
              <div className="absolute top-3 right-3 flex items-center gap-1 transition-all">
                <button onClick={() => { setEditingInv(inv); setShowModal(true); }} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-accent transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => { if(window.confirm('Eliminare questo investimento?')) deleteInvestment(inv.id); }} className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-start justify-between mb-3"><div><h4 className="text-sm font-semibold text-text-primary">{inv.name}</h4><span className="text-xs text-text-muted">{INVESTMENT_CATEGORY_LABELS[inv.category]} • {inv.supplier}</span></div><span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span></div>
              <div className="grid grid-cols-3 gap-3 mb-3"><div><p className="text-[10px] text-text-muted">Costo</p><p className="text-sm font-bold text-text-primary">{formatCurrency(inv.totalCost)}</p></div><div><p className="text-[10px] text-text-muted">ROI Stimato</p><p className="text-sm font-bold text-info">{inv.estimatedROI}%</p></div><div><p className="text-[10px] text-text-muted">ROI Reale</p><p className="text-sm font-bold text-success">{inv.actualROI ? `${inv.actualROI}%` : '—'}</p></div></div>
              {inv.installments && <div><div className="flex justify-between text-[10px] text-text-muted mb-1"><span>Rate: {inv.installmentsPaid}/{inv.installments}</span><span>{progress}%</span></div><div className="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div></div>}
              <p className="text-[10px] text-text-muted mt-2">Ammortamento: {inv.amortizationYears} anni • Data: {inv.date}</p>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {showModal && (
          <InvestmentModal 
            initialData={editingInv}
            onClose={() => { setShowModal(false); setEditingInv(null); }} 
            onSave={i => {
              if (editingInv) {
                updateInvestment(i.id, i);
              } else {
                addInvestment(i);
              }
            }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
