'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useClientStore } from '@/stores/useClientStore';
import { mockAppointments, mockTreatments } from '@/lib/mock-data';
import {
  ArrowLeft, Phone, Mail, Calendar, MapPin,
  Heart, Star, Crown, Gift, CreditCard,
  FileText, Camera, Clock, TrendingUp,
  Edit, MoreHorizontal, Shield, AlertTriangle,
  CheckCircle, User, Cake, Tag,
} from 'lucide-react';
import { formatCurrency, getInitials, formatDate, getStatusLabel, getStatusColor, getCategoryLabel } from '@/lib/helpers';
import Link from 'next/link';

const tabs = [
  { id: 'profile', label: 'Profilo', icon: User },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'treatments', label: 'Trattamenti', icon: Heart },
  { id: 'documents', label: 'Documenti', icon: FileText },
  { id: 'loyalty', label: 'Fidelity', icon: Star },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients } = useClientStore();
  const [activeTab, setActiveTab] = useState('profile');

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
    </div>
  );
}
