'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Search, Plus, Phone, Mail, Globe, MapPin, Star, Pencil, Trash2,
  BookUser, Save, ArrowLeft, MessageCircle, StickyNote, Receipt, Building2,
} from 'lucide-react';
import {
  getContacts, createContact, updateContact, deleteContact,
  type BusinessContactData,
} from '@/app/actions/contacts';
import { CONTACT_CATEGORIES, ROLE_SUGGESTIONS, categoryColor, categoryLabel } from '@/lib/contactCategories';

type FormState = {
  name: string; role: string; category: string; company: string; phone: string;
  email: string; website: string; address: string; vatNumber: string; notes: string; favorite: boolean;
};

const EMPTY_FORM: FormState = {
  name: '', role: '', category: 'professionisti', company: '', phone: '',
  email: '', website: '', address: '', vatNumber: '', notes: '', favorite: false,
};

/** Numero pulito per tel: e WhatsApp (aggiunge 39 ai cellulari italiani senza prefisso). */
function phoneDigits(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '39' + d;
  return d;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function RubricaModal({ onClose }: { onClose: () => void }) {
  const [contacts, setContacts] = useState<BusinessContactData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<BusinessContactData | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Il Topbar ha backdrop-blur: senza portal il modale resterebbe incastrato dentro l'header.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = async () => {
    const rows = await getContacts();
    setContacts(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: contacts.length };
    contacts.forEach(c => { map[c.category] = (map[c.category] || 0) + 1; });
    return map;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(c => {
      if (category !== 'all' && c.category !== category) return false;
      if (!q) return true;
      return [c.name, c.role, c.company, c.phone, c.email, c.notes, c.address, categoryLabel(c.category)]
        .join(' ').toLowerCase().includes(q);
    });
  }, [contacts, query, category]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, category: category !== 'all' ? category : 'professionisti' });
    setEditing('new');
  };

  const openEdit = (c: BusinessContactData) => {
    setForm({
      name: c.name, role: c.role, category: c.category, company: c.company, phone: c.phone,
      email: c.email, website: c.website, address: c.address, vatNumber: c.vatNumber,
      notes: c.notes, favorite: c.favorite,
    });
    setEditing(c);
  };

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      if (editing === 'new') await createContact(form);
      else if (editing) await updateContact(editing.id, form);
      await load();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteContact(id);
    setConfirmDelete(null);
    await load();
  };

  const toggleFavorite = async (c: BusinessContactData) => {
    setContacts(prev => prev.map(x => x.id === c.id ? { ...x, favorite: !x.favorite } : x));
    await updateContact(c.id, { favorite: !c.favorite });
    await load();
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border focus:border-accent outline-none text-sm text-text-primary placeholder:text-text-muted';

  if (!mounted) return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="fixed inset-0 z-[71] flex items-center justify-center sm:p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-3xl bg-bg-secondary sm:border sm:border-border sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border flex-shrink-0 bg-accent/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                <BookUser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold text-text-primary">Rubrica contatti</h3>
                <p className="text-xs text-text-secondary">Commercialista, programmatore, HR, fornitori, manutenzione…</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {editing ? (
            /* ---------------- FORM ---------------- */
            <>
              <div className="px-5 sm:px-6 py-3 border-b border-border flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-text-primary">
                  {editing === 'new' ? 'Nuovo contatto' : 'Modifica contatto'}
                </span>
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-4 flex-1 overflow-y-auto">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Nome e cognome *</label>
                    <input autoFocus className={inputCls} value={form.name} placeholder="Es. Mario Rossi"
                      onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Categoria</label>
                    <select className={inputCls} value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CONTACT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Ruolo / cosa fa</label>
                  <input className={inputCls} value={form.role} placeholder="Es. Commercialista"
                    onChange={e => setForm({ ...form, role: e.target.value })} />
                  {(ROLE_SUGGESTIONS[form.category] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(ROLE_SUGGESTIONS[form.category] || []).map(r => (
                        <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            form.role === r ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-bg-hover'
                          }`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Azienda / studio</label>
                    <input className={inputCls} value={form.company} placeholder="Es. Studio Rossi & Partners"
                      onChange={e => setForm({ ...form, company: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Telefono</label>
                    <input className={inputCls} value={form.phone} placeholder="Es. 333 1234567"
                      onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                    <input className={inputCls} value={form.email} placeholder="nome@dominio.it"
                      onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Sito web</label>
                    <input className={inputCls} value={form.website} placeholder="www.sito.it"
                      onChange={e => setForm({ ...form, website: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Indirizzo</label>
                    <input className={inputCls} value={form.address} placeholder="Via, città"
                      onChange={e => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">P.IVA / Cod. Fiscale</label>
                    <input className={inputCls} value={form.vatNumber} placeholder="Per fatture e pagamenti"
                      onChange={e => setForm({ ...form, vatNumber: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Note</label>
                  <textarea rows={3} className={inputCls} value={form.notes}
                    placeholder="Es. contratto annuale, si occupa del gestionale, chiamare solo di mattina…"
                    onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>

                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input type="checkbox" checked={form.favorite} className="accent-accent w-4 h-4"
                    onChange={e => setForm({ ...form, favorite: e.target.checked })} />
                  <span className="text-sm text-text-secondary">Contatto importante (sempre in cima)</span>
                </label>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover transition-colors">
                  Annulla
                </button>
                <button onClick={handleSave} disabled={!form.name.trim() || saving}
                  className="px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Salvo…' : 'Salva contatto'}
                </button>
              </div>
            </>
          ) : (
            /* ---------------- LISTA ---------------- */
            <>
              <div className="px-5 sm:px-6 py-4 border-b border-border flex-shrink-0 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      className={`${inputCls} pl-9`} value={query} autoFocus
                      placeholder="Cerca per nome, ruolo, azienda, telefono…"
                      onChange={e => setQuery(e.target.value)}
                    />
                  </div>
                  <button onClick={openNew}
                    className="px-3 sm:px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium flex items-center gap-2 flex-shrink-0">
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuovo contatto</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[{ id: 'all', label: 'Tutti' }, ...CONTACT_CATEGORIES].map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        category === c.id ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                      }`}>
                      {c.label} <span className="opacity-70">({counts[c.id] || 0})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
                {loading ? (
                  <p className="text-sm text-text-muted text-center py-10">Carico la rubrica…</p>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <BookUser className="w-10 h-10 mx-auto text-text-muted mb-3" />
                    <p className="text-sm text-text-secondary">
                      {contacts.length === 0 ? 'Nessun contatto in rubrica.' : 'Nessun contatto trovato.'}
                    </p>
                    <button onClick={openNew} className="mt-3 text-sm text-accent font-medium hover:underline">
                      + Aggiungi il primo contatto
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map(c => (
                      <div key={c.id} className="rounded-2xl border border-border bg-bg-tertiary/50 p-4 hover:border-border-light transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.favorite && <Star className="w-3.5 h-3.5 text-warning fill-warning flex-shrink-0" />}
                              <p className="font-semibold text-text-primary truncate">{c.name}</p>
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${categoryColor(c.category)}`}>
                                {categoryLabel(c.category)}
                              </span>
                            </div>
                            {(c.role || c.company) && (
                              <p className="text-sm text-text-secondary mt-0.5">
                                {c.role}{c.role && c.company ? ' • ' : ''}{c.company}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                              {c.phone && (
                                <a href={`tel:${phoneDigits(c.phone)}`} className="flex items-center gap-1.5 text-text-secondary hover:text-accent">
                                  <Phone className="w-3.5 h-3.5" /> {c.phone}
                                </a>
                              )}
                              {c.phone && (
                                <a href={`https://wa.me/${phoneDigits(c.phone)}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-text-secondary hover:text-success">
                                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-text-secondary hover:text-accent">
                                  <Mail className="w-3.5 h-3.5" /> {c.email}
                                </a>
                              )}
                              {c.website && (
                                <a href={normalizeUrl(c.website)} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-text-secondary hover:text-accent">
                                  <Globe className="w-3.5 h-3.5" /> {c.website}
                                </a>
                              )}
                              {c.address && (
                                <span className="flex items-center gap-1.5 text-text-muted">
                                  <MapPin className="w-3.5 h-3.5" /> {c.address}
                                </span>
                              )}
                              {c.vatNumber && (
                                <span className="flex items-center gap-1.5 text-text-muted">
                                  <Receipt className="w-3.5 h-3.5" /> {c.vatNumber}
                                </span>
                              )}
                            </div>

                            {c.notes && (
                              <p className="flex items-start gap-1.5 text-xs text-text-muted mt-2">
                                <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {c.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => toggleFavorite(c)} title="Contatto importante"
                              className={`p-2 rounded-lg hover:bg-bg-hover ${c.favorite ? 'text-warning' : 'text-text-muted'}`}>
                              <Star className={`w-4 h-4 ${c.favorite ? 'fill-warning' : ''}`} />
                            </button>
                            <button onClick={() => openEdit(c)} title="Modifica"
                              className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {confirmDelete === c.id ? (
                              <button onClick={() => handleDelete(c.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-error text-white text-xs font-medium">
                                Conferma
                              </button>
                            ) : (
                              <button onClick={() => setConfirmDelete(c.id)} title="Elimina"
                                className="p-2 rounded-lg hover:bg-error/10 text-error">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 sm:px-6 py-3 border-t border-border flex-shrink-0 flex items-center gap-2 text-xs text-text-muted">
                <Building2 className="w-3.5 h-3.5" />
                {contacts.length} contatt{contacts.length === 1 ? 'o' : 'i'} in rubrica
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
}
