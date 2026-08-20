'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, CheckCircle, Upload, Loader2, Trash2 } from 'lucide-react';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { Treatment, OperatorSkill } from '@/types';
import { useOperatorStore } from '@/stores/useOperatorStore';
import { formatCurrency } from '@/lib/helpers';
import { getCategoryLabel } from '@/lib/helpers';
import { NO_AUTOFILL } from '@/lib/noAutofill';

export const CATEGORIES = [
  { value: 'facial', label: 'Viso' }, { value: 'body', label: 'Corpo' }, { value: 'laser', label: 'Laser' },
  { value: 'massage', label: 'Massaggi' }, { value: 'nails', label: 'Unghie' }, { value: 'waxing', label: 'Depilazione' },
  { value: 'consultation', label: 'Consulenza' }, { value: 'hair', label: 'Capelli' }, { value: 'makeup', label: 'Trucco' },
];

export const TREATMENT_COLORS = ['#A855F7','#EC4899','#3B82F6','#22C55E','#F59E0B','#EF4444','#6366F1','#14B8A6','#8B5CF6','#F97316'];

export function TreatmentsSection() {
  const treatments = useTreatmentStore(s => s.treatments);
  const setTreatments = useTreatmentStore(s => s.setTreatments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);

  // Modal state (prezzi/tempi donna e uomo)
  const [name, setName] = useState('');
  const [category, setCategory] = useState('facial');
  const [wPrice, setWPrice] = useState(''); // prezzo donna
  const [mPrice, setMPrice] = useState(''); // prezzo uomo
  const [wDur, setWDur] = useState('30');   // durata donna
  const [mDur, setMDur] = useState('');     // durata uomo
  const [prep, setPrep] = useState('');     // minuti di preparazione (solo agenda)
  const [color, setColor] = useState('#A855F7');
  const [saving, setSaving] = useState(false);
  /**
   * Chi lo fa e con che tempi.
   *
   * Elenco vuoto = lo fanno tutte, con la durata standard. Appena si spunta
   * anche una sola operatrice, il trattamento diventa "di quelle lì" e in
   * prenotazione le altre non compaiono più.
   */
  const [skills, setSkills] = useState<OperatorSkill[]>([]);
  const operatori = useOperatorStore(s => s.operators);
  const fetchOperators = useOperatorStore(s => s.fetchOperators);
  useEffect(() => { fetchOperators(); }, [fetchOperators]);
  /**
   * Chi può essere spuntato: le operatrice e anche le cabine automatiche.
   * La lampada e la pressoterapia non le fa una persona, le fa la cabina —
   * e devono poter comparire nell'elenco come tutte le altre.
   */
  const staff = useMemo(
    // "Chi lo fa" riguarda il lavoro futuro: chi se n'è andata non compare più.
    () => operatori.filter(o => o.isActive !== false).sort((a, b) => (a.isResource ? 1 : 0) - (b.isResource ? 1 : 0)),
    [operatori],
  );

  const openAdd = () => { setEditing(null); setName(''); setCategory('facial'); setWPrice(''); setMPrice(''); setWDur('30'); setMDur(''); setPrep(''); setColor('#A855F7'); setSkills([]); setShowModal(true); };
  const openEdit = (t: Treatment) => {
    setEditing(t); setName(t.name); setCategory(t.category);
    setWPrice(String(t.priceFemale ?? t.price ?? ''));
    setMPrice(t.priceMale != null ? String(t.priceMale) : '');
    setWDur(String(t.durationFemale ?? t.duration ?? 30));
    setMDur(t.durationMale != null ? String(t.durationMale) : '');
    setPrep(t.preparazione ? String(t.preparazione) : '');
    setColor(t.color); setSkills(t.operatorSkills || []); setShowModal(true);
  };

  /** Spunta o toglie un'operatrice da "chi lo fa". */
  const alternaSkill = (operatorId: string) => setSkills(prec =>
    prec.some(x => x.operatorId === operatorId)
      ? prec.filter(x => x.operatorId !== operatorId)
      : [...prec, { operatorId }]
  );
  /** La sua durata su questo trattamento: vuoto = quella standard. */
  const durataSkill = (operatorId: string, minuti: string) => setSkills(prec =>
    prec.map(x => x.operatorId === operatorId
      ? { ...x, ...(minuti === '' ? { duration: undefined } : { duration: Math.round(Number(minuti)) }) }
      : x)
  );
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async () => {
    if (!name.trim() || !wPrice) return;
    setSaving(true);
    try {
      const res = await fetch('/api/treatments/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id, name: name.trim(), category,
          priceFemale: wPrice, priceMale: mPrice, durationFemale: wDur, durationMale: mDur, preparazione: prep, color,
          operatorSkills: skills,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante il salvataggio');
      setTreatments(data.treatments as Treatment[]);
      closeModal();
    } catch (err) {
      setImportMsg(`✗ ${err instanceof Error ? err.message : 'Errore'}`);
    } finally {
      setSaving(false);
    }
  };

  const runBulk = async (payload: object) => {
    const res = await fetch('/api/treatments/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore');
    setTreatments(data.treatments as Treatment[]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo trattamento?')) return;
    try { await runBulk({ action: 'delete', ids: [id] }); }
    catch (err) { setImportMsg(`✗ ${err instanceof Error ? err.message : 'Errore'}`); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/treatments/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante l\'import');
      setTreatments(data.treatments as Treatment[]);
      setImportMsg(`✓ ${data.count} trattamenti importati con successo`);
    } catch (err) {
      setImportMsg(`✗ ${err instanceof Error ? err.message : 'Errore'}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Prezzo/durata donna e uomo per la visualizzazione
  const priceF = (t: Treatment) => t.priceFemale ?? t.price;
  const priceM = (t: Treatment) => t.priceMale;
  const durF = (t: Treatment) => t.durationFemale ?? t.duration;
  const durM = (t: Treatment) => t.durationMale;

  const filtered = search.trim() ? treatments.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : treatments;

  // --- Selezione multipla e azioni massive ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allVisibleSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id));
  const toggleAll = () => setSelected(prev => {
    if (allVisibleSelected) return new Set();
    return new Set(filtered.map(t => t.id));
  });
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Eliminare ${selected.size} trattament${selected.size === 1 ? 'o' : 'i'}?`)) return;
    try { await runBulk({ action: 'delete', ids: [...selected] }); clearSelection(); }
    catch (err) { setImportMsg(`✗ ${err instanceof Error ? err.message : 'Errore'}`); }
  };
  const bulkCategory = async (cat: string) => {
    if (!cat || selected.size === 0) return;
    try { await runBulk({ action: 'category', ids: [...selected], category: cat }); clearSelection(); }
    catch (err) { setImportMsg(`✗ ${err instanceof Error ? err.message : 'Errore'}`); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-display font-semibold text-text-primary">Catalogo Trattamenti Base <span className="text-sm font-normal text-text-muted">({treatments.length})</span></h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} {...NO_AUTOFILL} placeholder="Cerca..."
                className="pl-8 pr-3 py-2 rounded-xl bg-bg-tertiary border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all w-40" />
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-text-primary text-xs font-medium hover:bg-bg-hover transition-all disabled:opacity-50">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {importing ? 'Importo...' : 'Importa Excel'}
            </button>
            <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-text-primary text-xs font-medium hover:bg-bg-hover transition-all">
              <Plus className="w-3.5 h-3.5" /> Nuovo
            </button>
          </div>
        </div>
        {importMsg && (
          <div className={`px-6 py-2.5 text-xs font-medium border-b border-border ${importMsg.startsWith('✓') ? 'text-green-500 bg-green-500/5' : 'text-error bg-error/5'}`}>
            {importMsg}
          </div>
        )}
        {selected.size > 0 && (
          <div className="px-6 py-2.5 border-b border-border bg-accent/5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-semibold text-accent">{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
            <div className="flex items-center gap-2">
              <select onChange={e => { bulkCategory(e.target.value); e.target.value = ''; }} defaultValue=""
                className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/50">
                <option value="" disabled>Cambia categoria…</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/20 text-error text-xs font-medium hover:bg-error/20 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </button>
              <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:bg-bg-hover transition-all">
                Annulla
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="w-10 px-4 py-3 text-center"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4 rounded border-border accent-accent cursor-pointer" /></th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase">Trattamento</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase hidden sm:table-cell">Categoria</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase">Durata</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase">Prezzo</th>
              <th className="w-20"></th>
            </tr></thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(t => (
                <tr key={t.id} className={`transition-colors group ${selected.has(t.id) ? 'bg-accent/5' : 'hover:bg-bg-hover'}`}>
                  <td className="px-4 py-3 text-center"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} className="w-4 h-4 rounded border-border accent-accent cursor-pointer" /></td>
                  <td className="px-5 py-3"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} /><span className="text-sm font-medium text-text-primary">{t.name}</span></div></td>
                  <td className="px-5 py-3 hidden sm:table-cell"><span className="text-xs text-text-secondary">{getCategoryLabel(t.category)}</span></td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-sm text-text-secondary">♀ {durF(t)}′{durM(t) != null ? <span className="text-text-muted"> · ♂ {durM(t)}′</span> : null}</span>
                    {/* Con la preparazione i minuti veri sono altri: si vedono
                        qui, se no si scopre solo quando l'agenda slitta. */}
                    {t.preparazione ? (
                      <span className="block text-[11px] text-accent" title="Durata più preparazione: è il posto che occupa in agenda">
                        +{t.preparazione}′ prep · in agenda {durF(t) + t.preparazione}′
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-semibold text-text-primary">♀ {formatCurrency(priceF(t))}</span>
                    {priceM(t) != null ? <span className="text-xs text-text-muted block">♂ {formatCurrency(priceM(t) as number)}</span> : null}
                  </td>
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
              {/* Alta al massimo quanto lo schermo, e con il corpo che scorre:
                  aggiungendo campi la scheda superava il video e i tasti Salva
                  e Annulla restavano sotto il bordo, irraggiungibili. */}
              <div className="w-full max-w-md max-h-[90vh] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                  <h3 className="text-lg font-display font-semibold text-text-primary">{editing ? 'Modifica Trattamento' : 'Nuovo Trattamento'}</h3>
                  <button onClick={closeModal} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Nome *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Pulizia Viso Profonda..."
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all appearance-none">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Prezzo Donna (€) *</label>
                      <input type="number" value={wPrice} onChange={e => setWPrice(e.target.value)} placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Prezzo Uomo (€)</label>
                      <input type="number" value={mPrice} onChange={e => setMPrice(e.target.value)} placeholder="—"
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Durata Donna (min)</label>
                      <input type="number" value={wDur} onChange={e => setWDur(e.target.value)} placeholder="30"
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                    <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Durata Uomo (min)</label>
                      <input type="number" value={mDur} onChange={e => setMDur(e.target.value)} placeholder="—"
                        className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" /></div>
                  </div>

                  {/* La preparazione: quello che il trattamento si porta dietro
                      e che alla cliente non si dice. Sta sotto le durate perché
                      è la stessa cosa vista dall'altra parte — quanto tempo
                      togliere all'agenda, non quanto prometterne. */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Preparazione (min)</label>
                    <input type="number" min={0} value={prep} onChange={e => setPrep(e.target.value)} placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
                    <p className="text-[11px] text-text-muted mt-1.5">
                      Cabina da allestire, prodotto da stendere, macchinario da scaldare.
                      {Number(prep) > 0
                        ? ` Alla cliente dici ${wDur || 30} minuti, in agenda il posto occupato è ${Number(wDur || 30) + Number(prep)}.`
                        : ' Alla cliente si dice la durata qui sopra; in agenda si occupa la somma delle due.'}
                    </p>
                  </div>
                  {/* Chi lo fa e quanto ci mette. La riga della durata compare
                      solo per chi è spuntata: si scrive solo dove il tempo è
                      diverso dallo standard. */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Chi lo fa</label>
                    <div className="rounded-xl border border-border divide-y divide-border/40 overflow-hidden">
                      {staff.length === 0 && (
                        <p className="px-3 py-3 text-xs text-text-muted">Nessuna operatrice in anagrafica.</p>
                      )}
                      {staff.map(op => {
                        const skill = skills.find(x => x.operatorId === op.id);
                        const scelta = Boolean(skill);
                        return (
                          <div key={op.id} className={`flex items-center gap-2.5 px-3 py-2 ${scelta ? 'bg-accent/5' : ''}`}>
                            <button type="button" onClick={() => alternaSkill(op.id)}
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                scelta ? 'bg-accent border-accent text-white' : 'border-border'}`}>
                              {scelta && <CheckCircle className="w-3 h-3" />}
                            </button>
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: op.color }}>
                              {op.isResource ? '☀' : `${op.firstName.slice(0, 1)}${op.lastName.slice(0, 1)}`}
                            </span>
                            <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{op.firstName} {op.lastName}</span>
                            {scelta && (
                              <span className="flex items-center gap-1.5 flex-shrink-0">
                                <input type="number" value={skill?.duration ?? ''} {...NO_AUTOFILL}
                                  onChange={e => durataSkill(op.id, e.target.value)}
                                  placeholder={wDur || '30'}
                                  className="w-16 px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-xs text-text-primary text-right" />
                                <span className="text-[11px] text-text-muted">min</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1.5">
                      {skills.length === 0
                        ? 'Nessuna spunta = lo fanno tutte, con la durata standard.'
                        : `Lo fanno in ${skills.length}. Le altre non compariranno in prenotazione. Il tempo si scrive solo dove è diverso da ${wDur || 30} min.`}
                    </p>
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
                  {name.trim() && wPrice && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                      <div className="w-3 h-10 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{name}</p>
                        <p className="text-xs text-text-muted">
                          {getCategoryLabel(category)} • ♀ {formatCurrency(Number(wPrice))} / {wDur || 0}′
                          {mPrice ? ` • ♂ ${formatCurrency(Number(mPrice))} / ${mDur || wDur || 0}′` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-bg-tertiary/30 flex-shrink-0">
                  <button onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">Annulla</button>
                  <button onClick={handleSave} disabled={!name.trim() || !wPrice || saving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${name.trim() && wPrice && !saving ? 'gradient-accent shadow-lg shadow-accent/20 hover:scale-105' : 'bg-bg-tertiary text-text-muted cursor-not-allowed'}`}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {editing ? 'Salva Modifiche' : 'Aggiungi'}
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
