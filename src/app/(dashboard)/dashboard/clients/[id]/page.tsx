'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useClientStore } from '@/stores/useClientStore';
import { usePriceListStore } from '@/stores/usePriceListStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { mockAppointments } from '@/lib/mock-data';
import {
  ArrowLeft, Phone, Mail, Calendar, MapPin,
  Heart, Star, Crown, Gift, CreditCard,
  FileText, Camera, Clock, TrendingUp,
  Edit, MoreHorizontal, Shield, AlertTriangle,
  CheckCircle, User, Cake, Tag, Settings, Plus, Trash2,
} from 'lucide-react';
import { formatCurrency, getInitials, formatDate, getStatusLabel, getStatusColor, getCategoryLabel, generateId } from '@/lib/helpers';
import Link from 'next/link';

const tabs = [
  { id: 'profile', label: 'Profilo', icon: User },
  { id: 'timeline', label: 'Cronologia', icon: Clock },
  { id: 'treatments', label: 'Riepilogo', icon: Heart },
  { id: 'custom_treatments', label: 'Trattamenti Personalizzati', icon: Settings },
  { id: 'documents', label: 'Documenti', icon: FileText },
  { id: 'loyalty', label: 'Fidelity', icon: Star },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients, updateClient } = useClientStore();
  const { priceLists } = usePriceListStore();
  const { treatments } = useTreatmentStore();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Custom treatments state
  const [isCustomTreatmentModalOpen, setIsCustomTreatmentModalOpen] = useState(false);
  const [editingCustomTreatmentId, setEditingCustomTreatmentId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ treatmentId: '', duration: 0, price: 0, notes: '' });

  const client = useMemo(
    () => clients.find(c => c.id === params.id),
    [clients, params.id]
  );

  const clientAppointments = useMemo(
    () => mockAppointments.filter(a => a.clientId === params.id),
    [params.id]
  );

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-text-secondary">Cliente non trovato</p>
        <Link href="/dashboard/clients" className="text-accent text-sm mt-2 hover:underline">
          Torna alla lista
        </Link>
      </div>
    );
  }

  const daysSinceVisit = client.lastVisit
    ? Math.floor((Date.now() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleSaveCustomTreatment = () => {
    if (!customForm.treatmentId || customForm.duration <= 0 || customForm.price < 0) return;
    
    const tr = treatments.find(t => t.id === customForm.treatmentId);
    if (!tr) return;

    const currentCustoms = client.customTreatments || [];
    
    // Check if updating existing or adding new
    let newCustoms;
    if (editingCustomTreatmentId) {
      newCustoms = currentCustoms.map(ct => ct.treatmentId === editingCustomTreatmentId ? {
        treatmentId: customForm.treatmentId,
        treatmentName: tr.name,
        duration: customForm.duration,
        price: customForm.price,
        notes: customForm.notes,
      } : ct);
    } else {
      // Remove any existing one for same treatment just in case, then add
      newCustoms = [
        ...currentCustoms.filter(ct => ct.treatmentId !== customForm.treatmentId),
        {
          treatmentId: customForm.treatmentId,
          treatmentName: tr.name,
          duration: customForm.duration,
          price: customForm.price,
          notes: customForm.notes,
        }
      ];
    }
    
    updateClient(client.id, { customTreatments: newCustoms });
    setIsCustomTreatmentModalOpen(false);
    setCustomForm({ treatmentId: '', duration: 0, price: 0, notes: '' });
    setEditingCustomTreatmentId(null);
  };

  const handleEditCustomTreatment = (ct: any) => {
    setEditingCustomTreatmentId(ct.treatmentId);
    setCustomForm({ treatmentId: ct.treatmentId, duration: ct.duration, price: ct.price, notes: ct.notes || '' });
    setIsCustomTreatmentModalOpen(true);
  };

  const handleDeleteCustomTreatment = (treatmentId: string) => {
    const currentCustoms = client.customTreatments || [];
    updateClient(client.id, { customTreatments: currentCustoms.filter(ct => ct.treatmentId !== treatmentId) });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna ai Clienti
      </button>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-secondary border border-border rounded-2xl overflow-hidden"
      >
        {/* Gradient Header */}
        <div className="h-24 gradient-accent opacity-80 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
        </div>

        <div className="px-6 pb-6 -mt-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-4 border-bg-secondary shadow-xl"
              style={{
                background: client.vipLevel >= 2
                  ? 'linear-gradient(135deg, #A855F7, #EC4899)'
                  : '#3B82F6',
              }}
            >
              {getInitials(client.firstName, client.lastName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-display font-bold text-text-primary">
                  {client.firstName} {client.lastName}
                </h2>
                {client.vipLevel >= 2 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold">
                    <Crown className="w-3 h-3" /> VIP {client.vipLevel === 3 ? 'Gold' : 'Silver'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-text-secondary">
                  <Phone className="w-3.5 h-3.5" /> {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <Mail className="w-3.5 h-3.5" /> {client.email}
                  </span>
                )}
                {client.birthDate && (
                  <span className="flex items-center gap-1 text-sm text-text-secondary">
                    <Cake className="w-3.5 h-3.5" /> {formatDate(client.birthDate)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-xl border border-border hover:bg-bg-hover text-text-secondary transition-colors">
                <Phone className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-xl border border-border hover:bg-bg-hover text-text-secondary transition-colors">
                <Mail className="w-4 h-4" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium">
                <Edit className="w-4 h-4" /> Modifica
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            <div className="bg-bg-tertiary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-display font-bold text-text-primary">{formatCurrency(client.totalSpent)}</p>
              <p className="text-[11px] text-text-muted">Spesa Totale</p>
            </div>
            <div className="bg-bg-tertiary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-display font-bold text-text-primary">{client.visitCount}</p>
              <p className="text-[11px] text-text-muted">Visite</p>
            </div>
            <div className="bg-bg-tertiary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-display font-bold text-text-primary">{formatCurrency(client.avgTicket)}</p>
              <p className="text-[11px] text-text-muted">Scontrino Medio</p>
            </div>
            <div className="bg-bg-tertiary/50 rounded-xl p-3 text-center">
              <p className="text-lg font-display font-bold text-accent">{client.loyaltyPoints}</p>
              <p className="text-[11px] text-text-muted">Punti Fedeltà</p>
            </div>
            <div className="bg-bg-tertiary/50 rounded-xl p-3 text-center">
              <p className={`text-lg font-display font-bold ${
                daysSinceVisit !== null && daysSinceVisit <= 14 ? 'text-success' :
                daysSinceVisit !== null && daysSinceVisit <= 60 ? 'text-warning' : 'text-error'
              }`}>
                {daysSinceVisit !== null ? `${daysSinceVisit}g` : '—'}
              </p>
              <p className="text-[11px] text-text-muted">Ultima Visita</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-bg-secondary border border-border rounded-2xl p-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Personal Info */}
            <div className="bg-bg-secondary border border-border rounded-2xl p-5">
              <h3 className="text-base font-display font-semibold text-text-primary mb-4">Informazioni Personali</h3>
              <div className="space-y-3">
                {[
                  { label: 'Nome', value: `${client.firstName} ${client.lastName}` },
                  { label: 'Telefono', value: client.phone },
                  { label: 'Email', value: client.email || '—' },
                  { label: 'Data di Nascita', value: client.birthDate ? formatDate(client.birthDate) : '—' },
                  { label: 'Città', value: client.city || '—' },
                  { label: 'Genere', value: client.gender === 'F' ? 'Donna' : client.gender === 'M' ? 'Uomo' : '—' },
                ].map((field) => (
                  <div key={field.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0">
                    <span className="text-sm text-text-secondary">{field.label}</span>
                    <span className="text-sm font-medium text-text-primary">{field.value}</span>
                  </div>
                ))}
                
                {/* Listino Assegnato */}
                <div className="flex items-center justify-between py-2 border-t border-border mt-2 pt-4">
                  <span className="text-sm font-semibold text-text-secondary">Listino Assegnato</span>
                  <select
                    value={client.priceListId || ''}
                    onChange={(e) => updateClient(client.id, { priceListId: e.target.value || null })}
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary font-medium focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="">Standard (Nessuno Sconto)</option>
                    {priceLists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name} (-{pl.discountPercentage}%)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notes & Preferences */}
            <div className="space-y-4">
              <div className="bg-bg-secondary border border-border rounded-2xl p-5">
                <h3 className="text-base font-display font-semibold text-text-primary mb-3">Note</h3>
                <p className="text-sm text-text-secondary">{client.notes || 'Nessuna nota'}</p>
              </div>

              {client.allergies && (
                <div className="bg-error-bg border border-error/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-error" />
                    <h3 className="text-base font-display font-semibold text-error">Allergie</h3>
                  </div>
                  <p className="text-sm text-text-primary">{client.allergies}</p>
                </div>
              )}

              {client.preferences && client.preferences.length > 0 && (
                <div className="bg-bg-secondary border border-border rounded-2xl p-5">
                  <h3 className="text-base font-display font-semibold text-text-primary mb-3">Preferenze</h3>
                  <div className="flex flex-wrap gap-2">
                    {client.preferences.map((pref) => (
                      <span key={pref} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium">
                        {pref}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-bg-secondary border border-border rounded-2xl p-5">
                <h3 className="text-base font-display font-semibold text-text-primary mb-3">Tag</h3>
                <div className="flex flex-wrap gap-2">
                  {client.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-xs font-medium">
                      <Tag className="w-3 h-3 inline mr-1" />{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-bg-secondary border border-border rounded-2xl p-5">
                <h3 className="text-base font-display font-semibold text-text-primary mb-3">Consensi GDPR</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${client.gdprConsent ? 'text-success' : 'text-error'}`} />
                    <span className="text-sm text-text-secondary">Privacy & Trattamento Dati</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${client.marketingConsent ? 'text-success' : 'text-error'}`} />
                    <span className="text-sm text-text-secondary">Comunicazioni Marketing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <h3 className="text-base font-display font-semibold text-text-primary mb-4">Storico Visite</h3>
            {clientAppointments.length > 0 ? (
              <div className="space-y-3">
                {clientAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                    <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: apt.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{apt.treatmentName}</p>
                      <p className="text-xs text-text-secondary">con {apt.operatorName}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">{apt.startTime} - {apt.endTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">{formatCurrency(apt.price)}</p>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${getStatusColor(apt.status)}15`,
                          color: getStatusColor(apt.status),
                        }}
                      >
                        {getStatusLabel(apt.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted text-center py-8">Nessuna visita registrata</p>
            )}
          </div>
        )}

        {activeTab === 'treatments' && (
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <h3 className="text-base font-display font-semibold text-text-primary mb-4">Trattamenti Effettuati</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...new Set(clientAppointments.map(a => a.treatmentName))].map(treatmentName => {
                const apt = clientAppointments.find(a => a.treatmentName === treatmentName)!;
                const count = clientAppointments.filter(a => a.treatmentName === treatmentName).length;
                return (
                  <div key={treatmentName} className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: apt.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{treatmentName}</p>
                      <p className="text-xs text-text-muted">{getCategoryLabel(apt.treatmentCategory)}</p>
                    </div>
                    <span className="text-xs font-semibold text-accent">{count}x</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'custom_treatments' && (
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-display font-semibold text-text-primary">Trattamenti Personalizzati</h3>
                <p className="text-xs text-text-secondary mt-1">Imposta durata e prezzo specifici per questo cliente.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingCustomTreatmentId(null);
                  setCustomForm({ treatmentId: '', duration: 0, price: 0, notes: '' });
                  setIsCustomTreatmentModalOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Aggiungi
              </button>
            </div>

            {(!client.customTreatments || client.customTreatments.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="w-12 h-12 text-text-muted mb-3 opacity-50" />
                <p className="text-sm font-medium text-text-primary">Nessun trattamento personalizzato</p>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">Quando associ un trattamento qui, l'agenda utilizzerà automaticamente questi valori al posto di quelli standard.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {client.customTreatments.map(ct => {
                  const standard = treatments.find(t => t.id === ct.treatmentId);
                  return (
                    <div key={ct.treatmentId} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-text-primary">{ct.treatmentName}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent">Personalizzato</span>
                        </div>
                        {ct.notes && <p className="text-xs text-text-secondary mt-1 italic">"{ct.notes}"</p>}
                        
                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <span className="text-[10px] text-text-muted uppercase">Prezzo</span>
                            <p className="text-sm font-semibold text-text-primary">
                              {formatCurrency(ct.price)}
                              {standard && standard.price !== ct.price && (
                                <span className="text-[10px] text-text-muted line-through ml-1">{formatCurrency(standard.price)}</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-text-muted uppercase">Durata</span>
                            <p className="text-sm font-semibold text-text-primary">
                              {ct.duration} min
                              {standard && standard.duration !== ct.duration && (
                                <span className="text-[10px] text-text-muted line-through ml-1">{standard.duration}m</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditCustomTreatment(ct)}
                          className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-border transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomTreatment(ct.treatmentId)}
                          className="p-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-bg-secondary border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-display font-semibold text-text-primary">Documenti & Foto</h3>
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-hover transition-colors">
                <Camera className="w-4 h-4" /> Carica
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-text-muted mb-3" />
              <p className="text-text-secondary font-medium">Nessun documento</p>
              <p className="text-sm text-text-muted mt-1">Carica foto prima/dopo, consensi, documenti</p>
            </div>
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-bg-secondary border border-border rounded-2xl p-5">
              <h3 className="text-base font-display font-semibold text-text-primary mb-4">Programma Fedeltà</h3>
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full gradient-accent mx-auto flex items-center justify-center mb-3">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <p className="text-3xl font-display font-bold text-text-primary">{client.loyaltyPoints}</p>
                <p className="text-sm text-text-secondary mt-1">Punti Fedeltà</p>
                <div className="mt-4 bg-bg-tertiary rounded-xl p-3">
                  <p className="text-sm text-text-secondary">Cashback disponibile</p>
                  <p className="text-xl font-display font-bold text-success">{formatCurrency(client.cashback)}</p>
                </div>
              </div>
            </div>
            <div className="bg-bg-secondary border border-border rounded-2xl p-5">
              <h3 className="text-base font-display font-semibold text-text-primary mb-4">Livello VIP</h3>
              <div className="space-y-3">
                {[
                  { level: 1, name: 'Bronze', min: 0, icon: '⭐' },
                  { level: 2, name: 'Silver', min: 1000, icon: '⭐⭐' },
                  { level: 3, name: 'Gold VIP', min: 2000, icon: '👑' },
                ].map((l) => (
                  <div key={l.level} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    client.vipLevel >= l.level ? 'bg-accent/5 border-accent/20' : 'border-border/30'
                  }`}>
                    <span className="text-lg">{l.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${client.vipLevel >= l.level ? 'text-accent' : 'text-text-muted'}`}>
                        {l.name}
                      </p>
                      <p className="text-xs text-text-muted">{l.min}+ punti</p>
                    </div>
                    {client.vipLevel >= l.level && (
                      <CheckCircle className="w-4 h-4 text-accent" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal Custom Treatment */}
      <AnimatePresence>
        {isCustomTreatmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCustomTreatmentModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-bg-secondary border border-border rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-display font-bold text-text-primary mb-1">
                {editingCustomTreatmentId ? 'Modifica Personalizzazione' : 'Nuovo Trattamento Personalizzato'}
              </h3>
              <p className="text-xs text-text-secondary mb-4">Imposta regole specifiche per {client.firstName}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Trattamento</label>
                  <select 
                    value={customForm.treatmentId} 
                    onChange={e => {
                      const t = treatments.find(x => x.id === e.target.value);
                      if (t && !editingCustomTreatmentId) {
                        setCustomForm(prev => ({ ...prev, treatmentId: t.id, duration: t.duration, price: t.price }));
                      } else {
                        setCustomForm(prev => ({ ...prev, treatmentId: e.target.value }));
                      }
                    }}
                    disabled={!!editingCustomTreatmentId}
                    className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 disabled:opacity-50"
                  >
                    <option value="">Seleziona un trattamento...</option>
                    {treatments.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (Std: {t.duration}m, {formatCurrency(t.price)})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Prezzo Person. (€)</label>
                    <input 
                      type="number" 
                      value={customForm.price} 
                      onChange={e => setCustomForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Durata Person. (min)</label>
                    <input 
                      type="number" 
                      step={5}
                      value={customForm.duration} 
                      onChange={e => setCustomForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Note Operative (Opzionale)</label>
                  <textarea 
                    value={customForm.notes} 
                    onChange={e => setCustomForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Es. Richiede più tempo per pelle sensibile..."
                    className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50 resize-none h-20"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsCustomTreatmentModalOpen(false)} className="flex-1 px-4 py-2 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-border transition-colors">
                  Annulla
                </button>
                <button 
                  onClick={handleSaveCustomTreatment}
                  disabled={!customForm.treatmentId}
                  className="flex-1 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium disabled:opacity-50"
                >
                  Salva Impostazioni
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
