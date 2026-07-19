'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowRightLeft, Plus, Trash2, User, CheckCircle, Calendar, X } from 'lucide-react';
import { usePartnerExpenseStore, PartnerExpense } from '@/stores/usePartnerExpenseStore';
import { formatCurrency } from '@/lib/helpers';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

export default function PartnerExpensesPage() {
  const { expenses, addExpense, deleteExpense, clearExpenses, fetchExpenses } = usePartnerExpenseStore();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  const [partner, setPartner] = useState<'Dino' | 'Francesco'>('Dino');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Calculations
  const { totalDino, totalFrancesco, total, balanceStr, balanceColor, debtor, creditor, amountOwed } = useMemo(() => {
    const dTotal = expenses.filter(e => e.partner === 'Dino').reduce((s, e) => s + e.amount, 0);
    const fTotal = expenses.filter(e => e.partner === 'Francesco').reduce((s, e) => s + e.amount, 0);
    const tot = dTotal + fTotal;
    const expectedShare = tot / 2;

    let balStr = "Tutti in pari";
    let balCol = "text-success";
    let deb = null;
    let cred = null;
    let owed = 0;

    if (dTotal > fTotal) {
      owed = dTotal - expectedShare;
      deb = 'Francesco';
      cred = 'Dino';
      balStr = `Francesco deve a Dino ${formatCurrency(owed)}`;
      balCol = "text-warning";
    } else if (fTotal > dTotal) {
      owed = fTotal - expectedShare;
      deb = 'Dino';
      cred = 'Francesco';
      balStr = `Dino deve a Francesco ${formatCurrency(owed)}`;
      balCol = "text-error";
    }

    return { 
      totalDino: dTotal, 
      totalFrancesco: fTotal, 
      total: tot, 
      balanceStr: balStr, 
      balanceColor: balCol,
      debtor: deb,
      creditor: cred,
      amountOwed: owed
    };
  }, [expenses]);

  const handleSave = () => {
    if (!amount || isNaN(Number(amount)) || !description) return;
    addExpense({
      partner,
      amount: Number(amount),
      description,
      date,
    });
    setAmount('');
    setDescription('');
    setShowAddModal(false);
  };

  const handleClear = () => {
    if (confirm('Sei sicuro di voler azzerare tutti i conti? Questa operazione è irreversibile e dovrebbe essere fatta solo dopo aver saldato il debito.')) {
      clearExpenses();
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary">Spese Soci (Dare e Avere)</h2>
          <p className="text-text-secondary mt-1">Registra le spese personali anticipate e calcola il conguaglio a fine mese</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-error transition-all">
            Salda e Azzera
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Nuova Spesa
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dino */}
        <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><User className="w-24 h-24" /></div>
          <p className="text-sm font-medium text-text-secondary mb-1">Totale speso da Dino</p>
          <p className="text-3xl font-display font-bold text-text-primary mb-2">{formatCurrency(totalDino)}</p>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-tertiary text-xs font-medium text-text-muted">
            <Wallet className="w-3.5 h-3.5" /> Anticipi
          </div>
        </motion.div>

        {/* Francesco */}
        <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><User className="w-24 h-24" /></div>
          <p className="text-sm font-medium text-text-secondary mb-1">Totale speso da Francesco</p>
          <p className="text-3xl font-display font-bold text-text-primary mb-2">{formatCurrency(totalFrancesco)}</p>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg-tertiary text-xs font-medium text-text-muted">
            <Wallet className="w-3.5 h-3.5" /> Anticipi
          </div>
        </motion.div>

        {/* Conguaglio */}
        <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-5 flex flex-col justify-center border-l-4" style={{ borderLeftColor: amountOwed > 0 ? (debtor === 'Dino' ? '#EF4444' : '#F59E0B') : '#22C55E' }}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft className={`w-5 h-5 ${balanceColor}`} />
            <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">Stato Attuale</span>
          </div>
          <p className={`text-lg font-display font-bold leading-tight ${balanceColor}`}>
            {balanceStr}
          </p>
          <p className="text-xs text-text-muted mt-2">Spesa totale di entrambi: {formatCurrency(total)}</p>
          <p className="text-xs text-text-muted">Quota per socio: {formatCurrency(total / 2)}</p>
        </motion.div>
      </div>

      {/* Expenses List */}
      <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border bg-bg-tertiary/30">
          <h3 className="text-base font-display font-semibold text-text-primary">Storico Spese</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider bg-bg-secondary">
                <th className="py-3 px-5">Data</th>
                <th className="py-3 px-5">Socio</th>
                <th className="py-3 px-5">Descrizione</th>
                <th className="py-3 px-5 text-right">Importo</th>
                <th className="py-3 px-5 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-sm">
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-bg-hover transition-colors">
                  <td className="py-3 px-5 text-text-muted">{exp.date}</td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                      exp.partner === 'Dino' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'
                    }`}>
                      <User className="w-3.5 h-3.5" /> {exp.partner}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-text-primary font-medium">{exp.description}</td>
                  <td className="py-3 px-5 text-right font-bold text-text-primary">{formatCurrency(exp.amount)}</td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => deleteExpense(exp.id)} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted">
                    Nessuna spesa registrata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-0 z-[61] flex items-center justify-center sm:p-4">
              <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <h3 className="text-lg font-display font-semibold text-text-primary">Nuova Spesa</h3>
                  <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                  
                  {/* Partner Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPartner('Dino')}
                      className={`py-3 rounded-xl border-2 font-medium text-sm transition-all ${partner === 'Dino' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-border-light'}`}>
                      Dino
                    </button>
                    <button onClick={() => setPartner('Francesco')}
                      className={`py-3 rounded-xl border-2 font-medium text-sm transition-all ${partner === 'Francesco' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-border-light'}`}>
                      Francesco
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Importo Speso (€)</label>
                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Descrizione</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Es. Acquisto rotoli carta"
                      className="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Data</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50" />
                    </div>
                  </div>

                </div>
                <div className="p-6 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
                  <button onClick={handleSave} disabled={!amount || !description} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle className="w-5 h-5" /> Salva Spesa
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
