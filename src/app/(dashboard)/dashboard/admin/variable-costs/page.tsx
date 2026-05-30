'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, Calendar, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { VariableCost } from '@/lib/admin-data';
import { formatCurrency } from '@/lib/helpers';
import { useVariableCostStore } from '@/stores/useVariableCostStore';

const CATEGORIES = ['Carta lettino','Rotoloni','Guanti','Mascherine','Creme','Sieri','Prodotti cabina','Monouso','Detergenti','Lavanderia','Acqua clienti','Caffè','Snack','Materiali marketing','Cancelleria','Prodotti pulizia','Manutenzione macchinari','Piccole riparazioni'];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (<div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-xl"><p className="text-xs font-medium text-text-primary">{label}</p><p className="text-xs text-accent">{formatCurrency(payload[0]?.value || 0)}</p></div>);
}

export default function VariableCostsPage() {
  const { variableCosts: costs, addVariableCost, deleteVariableCost } = useVariableCostStore();
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  const totalMonthly = useMemo(() => costs.reduce((s, c) => s + c.amount, 0), [costs]);
  const dailyAvg = Math.round(totalMonthly / 26);
  const weeklyAvg = Math.round(totalMonthly / 4);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    costs.forEach(c => { map[c.category] = (map[c.category] || 0) + c.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + '...' : name, fullName: name, value }));
  }, [costs]);

  const byDate = useMemo(() => {
    const map: Record<string, VariableCost[]> = {};
    costs.forEach(c => { if (!map[c.date]) map[c.date] = []; map[c.date].push(c); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [costs]);

  const topSpender = byCategory[0];

  const handleAdd = () => {
    if (!newName.trim() || !newCategory || !Number(newAmount)) return;
    addVariableCost({ id: `vc-${Date.now()}`, name: newName.trim(), category: newCategory, amount: Number(newAmount), date: newDate });
    setNewName(''); setNewCategory(''); setNewAmount('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div><h2 className="text-xl font-display font-bold text-text-primary">Costi Variabili</h2><p className="text-sm text-text-secondary">Consumi giornalieri e materiali</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Media Giornaliera</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(dailyAvg)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Media Settimanale</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(weeklyAvg)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5"><p className="text-sm text-text-secondary">Totale Mese</p><p className="text-2xl font-display font-bold text-text-primary mt-1">{formatCurrency(totalMonthly)}</p></div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          {topSpender && topSpender.value > totalMonthly * 0.25 ? (
            <><p className="text-sm text-warning flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Alert Sprechi</p><p className="text-sm font-semibold text-text-primary mt-1">{topSpender.fullName}</p><p className="text-xs text-text-muted">{formatCurrency(topSpender.value)} ({Math.round((topSpender.value / totalMonthly) * 100)}%)</p></>
          ) : (<><p className="text-sm text-success">Nessun Alert</p><p className="text-lg font-display font-bold text-success mt-1">OK</p></>)}
        </div>
      </div>

      {/* Quick Entry */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-sm font-display font-semibold text-text-primary mb-3">Inserimento Rapido</h3>
        <div className="flex flex-wrap gap-3">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome spesa..." className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
            <option value="">Categoria...</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="€ Importo" className="w-28 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all" />
          <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="w-4 h-4" /> Aggiungi</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {byDate.map(([date, items]) => (
            <div key={date} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-2.5 border-b border-border bg-bg-tertiary/30 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-text-muted" /><span className="text-xs font-semibold text-text-secondary">{date}</span>
                <span className="ml-auto text-xs font-bold text-text-primary">{formatCurrency(items.reduce((s, i) => s + i.amount, 0))}</span>
              </div>
              <div className="divide-y divide-border/30">{items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-bg-hover transition-colors group">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text-primary">{item.name}</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{item.category}</span></div>
                  <span className="text-sm font-semibold text-error">-{formatCurrency(item.amount)}</span>
                  <button onClick={() => deleteVariableCost(item.id)} className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted hover:text-error transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}</div>
            </div>
          ))}
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5 h-fit sticky top-4">
          <h3 className="text-base font-display font-semibold text-text-primary mb-4">Consumi per Categoria</h3>
          <div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={byCategory} layout="vertical" margin={{ left: 5, right: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A5' }} tickFormatter={v => `€${v}`} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8B92A5' }} width={90} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer></div>
        </div>
      </div>
    </motion.div>
  );
}
