'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Square, Plus, Trash2, Flag, Calendar as CalendarIcon, X, User } from 'lucide-react';
import { TodoItem } from '@/types';
import { getTodos, createTodo, updateTodo, deleteTodo } from '@/app/actions/todo';
import { useOperatorStore } from '@/stores/useOperatorStore';

const PRIORITIES: { value: TodoItem['priority']; label: string; color: string; bg: string }[] = [
  { value: 'high', label: 'Alta', color: '#EF4444', bg: 'bg-error/10 text-error border-error/30' },
  { value: 'normal', label: 'Media', color: '#F59E0B', bg: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'low', label: 'Bassa', color: '#22C55E', bg: 'bg-success/10 text-success border-success/30' },
];
const prioMeta = (p: string) => PRIORITIES.find(x => x.value === p) || PRIORITIES[1];

function fmtDue(d?: string) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  if (diff < 0) return { label, tone: 'text-error', note: 'scaduto' };
  if (diff === 0) return { label: 'Oggi', tone: 'text-warning', note: '' };
  if (diff === 1) return { label: 'Domani', tone: 'text-text-secondary', note: '' };
  return { label, tone: 'text-text-secondary', note: '' };
}

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TodoItem['priority']>('normal');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo');

  const { operators, fetchOperators } = useOperatorStore();

  useEffect(() => {
    getTodos().then(t => { setTodos(t); setLoading(false); }).catch(() => setLoading(false));
    fetchOperators();
  }, [fetchOperators]);

  const add = async () => {
    if (!title.trim()) return;
    const optimisticTitle = title.trim();
    setTitle(''); setDueDate(''); setAssignee('');
    const created = await createTodo({ title: optimisticTitle, priority, dueDate: dueDate || undefined, assignee: assignee || undefined });
    setTodos(prev => [created, ...prev]);
  };

  const toggle = async (t: TodoItem) => {
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x));
    await updateTodo(t.id, { done: !t.done });
  };

  const remove = async (id: string) => {
    setTodos(prev => prev.filter(x => x.id !== id));
    await deleteTodo(id);
  };

  const changePriority = async (t: TodoItem) => {
    const order: TodoItem['priority'][] = ['normal', 'high', 'low'];
    const next = order[(order.indexOf(t.priority) + 1) % order.length];
    setTodos(prev => prev.map(x => x.id === t.id ? { ...x, priority: next } : x));
    await updateTodo(t.id, { priority: next });
  };

  const filtered = useMemo(() => {
    let list = todos;
    if (filter === 'todo') list = todos.filter(t => !t.done);
    else if (filter === 'done') list = todos.filter(t => t.done);
    // Ordina: non fatti per priorità (alta prima) e scadenza, fatti in fondo
    const prioRank = { high: 0, normal: 1, low: 2 } as Record<string, number>;
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (prioRank[a.priority] !== prioRank[b.priority]) return prioRank[a.priority] - prioRank[b.priority];
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [todos, filter]);

  const openCount = todos.filter(t => !t.done).length;
  const doneCount = todos.filter(t => t.done).length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">To-Do</h2>
        <p className="text-sm text-text-secondary">Le cose da fare del salone</p>
      </div>

      {/* Aggiungi */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="Cosa c'è da fare? (es. Ordinare cere, chiamare fornitore...)"
            className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all"
          />
          <button onClick={add} disabled={!title.trim()}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium transition-all ${title.trim() ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
            <Plus className="w-4 h-4" /> Aggiungi
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Priorità:</span>
            {PRIORITIES.map(p => (
              <button key={p.value} onClick={() => setPriority(p.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${priority === p.value ? p.bg : 'bg-bg-tertiary text-text-secondary border-border hover:border-border-light'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted">Entro il:</span>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50" />
            {dueDate && <button onClick={() => setDueDate('')} className="text-text-muted hover:text-error"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted">Assegna a:</span>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50 appearance-none">
              <option value="">Chiunque</option>
              {operators.map(op => <option key={op.id} value={`${op.firstName} ${op.lastName}`}>{op.firstName} {op.lastName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-2">
        {([['todo', `Da fare (${openCount})`], ['done', `Fatte (${doneCount})`], ['all', 'Tutte']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === val ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary border border-border hover:bg-bg-hover'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-text-muted text-center py-10">Caricamento...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-bg-secondary border border-border rounded-2xl">
            <CheckSquare className="w-10 h-10 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary font-medium">{filter === 'done' ? 'Nessuna attività completata' : 'Niente da fare, tutto a posto!'}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map(t => {
              const pm = prioMeta(t.priority);
              const due = fmtDue(t.dueDate);
              return (
                <motion.div key={t.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${t.done ? 'bg-bg-tertiary/40 border-border/40' : 'bg-bg-secondary border-border hover:border-border-light'}`}
                  style={{ borderLeft: `3px solid ${t.done ? 'var(--border)' : pm.color}` }}>
                  <button onClick={() => toggle(t)} className="flex-shrink-0">
                    {t.done ? <CheckSquare className="w-5 h-5 text-success" /> : <Square className="w-5 h-5 text-text-muted hover:text-accent transition-colors" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.done ? 'line-through text-text-muted' : 'text-text-primary font-medium'}`}>{t.title}</p>
                    {!t.done && (due || t.assignee) && (
                      <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                        {t.assignee && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-accent font-medium">
                            <User className="w-3 h-3" /> {t.assignee}
                          </span>
                        )}
                        {due && (
                          <span className={`inline-flex items-center gap-1 text-[11px] ${due.tone}`}>
                            <CalendarIcon className="w-3 h-3" /> {due.label}{due.note ? ` · ${due.note}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!t.done && (
                    <button onClick={() => changePriority(t)} title="Cambia priorità"
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${pm.bg}`}>
                      <Flag className="w-3 h-3" /> {pm.label}
                    </button>
                  )}
                  <button onClick={() => remove(t.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
