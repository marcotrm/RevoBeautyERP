'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AvatarCliente from '@/components/AvatarCliente';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useClientStore } from '@/stores/useClientStore';
import { usePriceListStore } from '@/stores/usePriceListStore';
import { useTreatmentStore } from '@/stores/useTreatmentStore';
import { useAgendaStore } from '@/stores/useAgendaStore';
import {
  ArrowLeft, Phone, Mail, Calendar, MapPin,
  Heart, Star, Crown, Gift, CreditCard,
  FileText, Clock, TrendingUp,
  Edit, MoreHorizontal, Shield, AlertTriangle,
  CheckCircle, User, Cake, Tag, Settings, Plus, Trash2, Bell, Frown,
} from 'lucide-react';
import { formatCurrency, getInitials, formatDate, getStatusLabel, getStatusColor, getCategoryLabel, generateId, formatBirthDate } from '@/lib/helpers';

/**
 * Il giorno di una visita: "gio 30 lug 2026".
 *
 * Con l'anno, perche' lo storico di una cliente affezionata attraversa il
 * capodanno e "30 lug" da solo, l'anno prossimo, sarebbe ambiguo.
 */
function dataVisita(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
import Link from 'next/link';
import AddClientModal from '@/components/AddClientModal';
import BuonoCompleannoBadge from '@/components/BuonoCompleanno';
import MandaListino from '@/components/MandaListino';
import ClientRecordTab from './ClientRecordTab';
import { Credito } from './Credito';
import PromemoriaCliente from '@/components/PromemoriaCliente';
import NienteRecensione from '@/components/NienteRecensione';
import { valutaAffidabilita, dalQuando, MESI_AFFIDABILITA } from '@/lib/affidabilita';
import { clientiDifficili, togliSegnalazione, type ClienteDifficile } from '@/app/actions/clientiDifficili';
import { getClientValue, type ClientValue } from '@/app/actions/businessStats';

const tabs = [
  { id: 'profile', label: 'Profilo', icon: User },
  { id: 'timeline', label: 'Cronologia', icon: Clock },
  { id: 'treatments', label: 'Riepilogo', icon: Heart },
  { id: 'custom_treatments', label: 'Trattamenti Personalizzati', icon: Settings },
  { id: 'documents', label: 'Scheda estetica', icon: FileText },
  { id: 'loyalty', label: 'Fidelity', icon: Star },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients, updateClient, fetchClients } = useClientStore();
  const { priceLists } = usePriceListStore();
  const { treatments, fetchTreatments } = useTreatmentStore();
  const { appointments, fetchAppointments, setSelectedDate } = useAgendaStore();
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    fetchClients();
    fetchTreatments();
    fetchAppointments();
  }, [fetchClients, fetchTreatments, fetchAppointments]);
  
  // Custom treatments state
  const [isCustomTreatmentModalOpen, setIsCustomTreatmentModalOpen] = useState(false);
  const [editingCustomTreatmentId, setEditingCustomTreatmentId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState<{treatmentId: string; duration: number | ''; price: number | ''; notes: string}>({ treatmentId: '', duration: '', price: '', notes: '' });

  // Edit client modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const client = useMemo(
    () => clients.find(c => c.id === params.id),
    [clients, params.id]
  );

  // Valore reale del cliente (incassi cassa + pacchetti, visite dagli appuntamenti)
  const [cval, setCval] = useState<ClientValue | null>(null);
  useEffect(() => {
    if (!params.id) return;
    getClientValue(String(params.id)).then(setCval).catch(() => {});
  }, [params.id]);

  // Appuntamenti reali del cliente (match per id o per nome, tolleranti all'ordine)
  const clientAppointments = useMemo(() => {
    if (!client) return [] as typeof appointments;
    const fullName = `${client.firstName} ${client.lastName}`.trim().toLowerCase();
    return appointments.filter(a =>
      a.clientId === params.id ||
      (a.clientName || '').trim().toLowerCase() === fullName
    );
  }, [appointments, params.id, client]);

  /**
   * Appuntamenti ancora da fare: quelli da oggi in avanti che non sono già
   * chiusi. Serve al banco per rispondere subito a "ha già un altro
   * appuntamento?" senza andare a cercarla in agenda giorno per giorno.
   */
  const [prossimiOpen, setProssimiOpen] = useState(false);
  const prossimiAppuntamenti = useMemo(() => {
    const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
    return clientAppointments
      .filter(a => a.date >= oggi && !['cancelled', 'no_show', 'completed'].includes(a.status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [clientAppointments]);

  // Statistiche disdette / no-show per classificare il cliente
  /*
    Affidabilità: stessa regola dell'agenda (src/lib/affidabilita.ts), se no la
    scheda e il blocco appuntamento direbbero due cose diverse sulla stessa
    persona. Si guardano gli ultimi 12 mesi e solo gli appuntamenti conclusi:
    contare anche quelli già fissati per il mese prossimo abbasserebbe la
    percentuale di chi prenota molto, cioè il contrario di quel che serve.
  */
  const dalAffidabilita = useMemo(() => dalQuando(), []);
  const cancelStats = useMemo(() => {
    const recenti = clientAppointments.filter(a => a.date >= dalAffidabilita);
    return {
      // La lista serve solo per i motivi qui sotto: i conteggi li dà la regola.
      /*
        Una riga per giornata, come il conteggio: tre disdette dello stesso
        giorno sono quasi sempre lo stesso appuntamento preso male e corretto,
        e in elenco diventavano tre righe identiche.
      */
      disdetteLista: recenti.filter(a => a.status === 'cancelled')
        .filter((a, i, tutte) => tutte.findIndex(x => x.date === a.date) === i),
      ...valutaAffidabilita(clientAppointments, dalAffidabilita),
    };
  }, [clientAppointments, dalAffidabilita]);

  /** La segnalazione scritta a mano dalle ragazze in agenda. */
  const [segnalata, setSegnalata] = useState<ClienteDifficile | null>(null);
  const ricaricaSegnalazione = useCallback(async () => {
    const id = String(params.id || '');
    if (!id) return;
    const lista = await clientiDifficili().catch(() => []);
    setSegnalata(lista.find(c => c.clientId === id) || null);
  }, [params.id]);
  useEffect(() => { void ricaricaSegnalazione(); }, [ricaricaSegnalazione]);

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
    if (!customForm.treatmentId || customForm.duration === '' || customForm.duration <= 0 || customForm.price === '' || customForm.price < 0) return;
    
    const tr = treatments.find(t => t.id === customForm.treatmentId);
    if (!tr) return;

    const currentCustoms = client.customTreatments || [];
    
    // Check if updating existing or adding new
    let newCustoms;
    if (editingCustomTreatmentId) {
      newCustoms = currentCustoms.map(ct => ct.treatmentId === editingCustomTreatmentId ? {
        treatmentId: customForm.treatmentId,
        treatmentName: tr.name,
        duration: Number(customForm.duration),
        price: Number(customForm.price),
        notes: customForm.notes,
      } : ct);
    } else {
      // Remove any existing one for same treatment just in case, then add
      newCustoms = [
        ...currentCustoms.filter(ct => ct.treatmentId !== customForm.treatmentId),
        {
          treatmentId: customForm.treatmentId,
          treatmentName: tr.name,
          duration: Number(customForm.duration),
          price: Number(customForm.price),
          notes: customForm.notes,
        }
      ];
    }
    
    updateClient(client.id, { customTreatments: newCustoms });
    setIsCustomTreatmentModalOpen(false);
    setCustomForm({ treatmentId: '', duration: '', price: '', notes: '' });
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
        className="bg-bg-secondary border border-border rounded-3xl overflow-hidden relative"
      >
        {/* Subtle Background Effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] pointer-events-none -translate-x-1/2 translate-y-1/2" />

        <div className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar with Glow */}
            <div className="relative group">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl group-hover:bg-accent/30 transition-colors duration-500" />
              {client.avatar ? (
                <AvatarCliente
                  nome={`${client.firstName} ${client.lastName}`}
                  avatar={client.avatar}
                  size={96}
                  className="relative shadow-lg border-2 border-border/50"
                />
              ) : (
                <div
                  className="relative w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-display font-bold shadow-lg border-2 border-border/50 backdrop-blur-sm"
                  style={{
                    background: client.vipLevel >= 2
                      ? 'linear-gradient(135deg, #A855F7, #EC4899)'
                      : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  }}
                >
                  {getInitials(client.firstName, client.lastName)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left mt-2 sm:mt-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-text-primary tracking-tight">
                  {client.firstName} {client.lastName}
                </h2>
                {client.vipLevel >= 2 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-accent/10 to-pink-500/10 border border-accent/20 text-accent text-xs font-bold shadow-sm">
                    <Crown className="w-3.5 h-3.5" /> VIP {client.vipLevel === 3 ? 'Gold' : 'Silver'}
                  </span>
                )}
                {cancelStats.livello === 'rischio' && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/25 text-error text-xs font-bold shadow-sm" title={`${cancelStats.mancati} appuntamenti saltati su ${cancelStats.conclusi} negli ultimi ${MESI_AFFIDABILITA} mesi`}>
                    <AlertTriangle className="w-3.5 h-3.5" /> Disdette frequenti
                  </span>
                )}
                {segnalata && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/25 text-error text-xs font-bold shadow-sm" title={`${segnalata.motivo}${segnalata.segnalataDa ? ` — segnalata da ${segnalata.segnalataDa}` : ''}`}>
                    <Frown className="w-3.5 h-3.5" /> Segnalata
                  </span>
                )}
                {/* Il regalo di compleanno ancora da spendere: qui perché è la
                    prima scheda che si apre quando la cliente chiama. */}
                <BuonoCompleannoBadge clientId={client.id} />
                {/* "Quanto viene?" si chiede al banco con la scheda aperta. */}
                <MandaListino phone={client.phone} nome={client.firstName} />
              </div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <div className="p-1.5 rounded-md bg-bg-tertiary text-text-muted"><Phone className="w-3.5 h-3.5" /></div>
                  {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                    <div className="p-1.5 rounded-md bg-bg-tertiary text-text-muted"><Mail className="w-3.5 h-3.5" /></div>
                    {client.email}
                  </span>
                )}
                {client.birthDate && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                    <div className="p-1.5 rounded-md bg-bg-tertiary text-text-muted"><Cake className="w-3.5 h-3.5" /></div>
                    {formatBirthDate(client.birthDate)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 sm:mt-0 w-full sm:w-auto justify-center sm:justify-end">
              {/* Ha già un altro appuntamento? Risposta immediata, senza cercarla in agenda */}
              <button
                onClick={() => setProssimiOpen(true)}
                title="Appuntamenti già fissati in agenda"
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  prossimiAppuntamenti.length > 0
                    ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                    : 'border-border text-text-secondary hover:bg-bg-hover hover:border-border-light'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Appuntamenti</span>
                {prossimiAppuntamenti.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-bold leading-none">
                    {prossimiAppuntamenti.length}
                  </span>
                )}
              </button>
              <button className="flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-xl border border-border hover:bg-bg-hover hover:border-border-light text-text-secondary transition-all">
                <Phone className="w-4 h-4" />
              </button>
              <button className="flex-1 sm:flex-none flex items-center justify-center p-2.5 rounded-xl border border-border hover:bg-bg-hover hover:border-border-light text-text-secondary transition-all">
                <Mail className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all hover:-translate-y-0.5"
              >
                <Edit className="w-4 h-4" /> Modifica
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8">
            <div className="bg-bg-tertiary/40 border border-border/40 rounded-2xl p-4 text-center hover:bg-bg-tertiary/80 transition-colors">
              <p className="text-xl font-display font-bold text-text-primary mb-0.5">{formatCurrency(cval ? cval.totalSpent : client.totalSpent)}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Spesa Totale</p>
              {cval && cval.monthlyAvg > 0 && <p className="text-[10px] text-text-muted mt-0.5">≈ {formatCurrency(cval.monthlyAvg)}/mese</p>}
            </div>
            <div className="bg-bg-tertiary/40 border border-border/40 rounded-2xl p-4 text-center hover:bg-bg-tertiary/80 transition-colors">
              <p className="text-xl font-display font-bold text-text-primary mb-0.5">{cval ? cval.visits : client.visitCount}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Visite</p>
            </div>
            <div className="bg-bg-tertiary/40 border border-border/40 rounded-2xl p-4 text-center hover:bg-bg-tertiary/80 transition-colors">
              <p className="text-xl font-display font-bold text-text-primary mb-0.5">{formatCurrency(cval ? cval.avgTicket : client.avgTicket)}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Scontrino Medio</p>
            </div>
            <div className="bg-bg-tertiary/40 border border-border/40 rounded-2xl p-4 text-center hover:bg-bg-tertiary/80 transition-colors">
              <p className="text-xl font-display font-bold text-text-primary mb-0.5">{cval && cval.avgDaysBetweenVisits ? `${cval.avgDaysBetweenVisits}g` : '—'}</p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Torna ogni</p>
            </div>
            <div className="bg-bg-tertiary/40 border border-border/40 rounded-2xl p-4 text-center hover:bg-bg-tertiary/80 transition-colors">
              <p className={`text-xl font-display font-bold mb-0.5 ${
                daysSinceVisit !== null && daysSinceVisit <= 14 ? 'text-success' :
                daysSinceVisit !== null && daysSinceVisit <= 60 ? 'text-warning' : 'text-error'
              }`}>
                {daysSinceVisit !== null ? `${daysSinceVisit}g` : '—'}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Ultima Visita</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Affidabilità appuntamenti (disdette / no-show) */}
      {cancelStats.conclusi > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 ${cancelStats.livello === 'rischio' ? 'bg-error/5 border-error/25' : cancelStats.livello === 'attenzione' ? 'bg-warning/5 border-warning/25' : 'bg-bg-secondary border-border'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${cancelStats.livello === 'rischio' ? 'text-error' : cancelStats.livello === 'attenzione' ? 'text-warning' : 'text-text-muted'}`} />
              <h3 className="text-base font-display font-semibold text-text-primary">Affidabilità appuntamenti</h3>
              <span className="text-[11px] text-text-muted">· ultimi {MESI_AFFIDABILITA} mesi</span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cancelStats.livello === 'rischio' ? 'bg-error/15 text-error' : cancelStats.livello === 'attenzione' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
              {cancelStats.mancati === 0 ? 'Cliente affidabile' : `${cancelStats.percentuale}% mancati`}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
            <div className="text-center bg-bg-tertiary/40 rounded-xl p-3">
              <p className="text-lg font-display font-bold text-text-primary">{cancelStats.conclusi}</p>
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Conclusi</p>
            </div>
            <div className="text-center bg-bg-tertiary/40 rounded-xl p-3">
              <p className="text-lg font-display font-bold text-success">{cancelStats.completati}</p>
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Completati</p>
            </div>
            <div className="text-center bg-bg-tertiary/40 rounded-xl p-3">
              <p className="text-lg font-display font-bold text-error">{cancelStats.disdette}</p>
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Disdette</p>
            </div>
            <div className="text-center bg-bg-tertiary/40 rounded-xl p-3">
              <p className="text-lg font-display font-bold text-error">{cancelStats.noShow}</p>
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">No-Show</p>
            </div>
          </div>
          {cancelStats.livello === 'rischio' && (
            <p className="text-xs text-error mt-3">⚠️ Ha disdetto o non si è presentato {cancelStats.mancati} volte su {cancelStats.conclusi} appuntamenti. Valuta di chiedere un acconto alla prenotazione.</p>
          )}
          {segnalata && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-start gap-2">
              <Frown className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-primary">Segnalata dalle ragazze</p>
                <p className="text-xs text-text-secondary">{segnalata.motivo}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {segnalata.segnalataDa ? `Segnalata da ${segnalata.segnalataDa}` : 'Segnalata'} il {segnalata.quando.slice(8, 10)}/{segnalata.quando.slice(5, 7)}
                  {' · '}non riceve la richiesta di recensione su Google
                </p>
              </div>
              <button onClick={async () => { await togliSegnalazione(String(params.id || '')); await ricaricaSegnalazione(); }}
                className="text-[11px] font-semibold text-text-muted hover:text-text-primary underline flex-shrink-0">
                Togli
              </button>
            </div>
          )}
          {cancelStats.disdetteLista.some(a => a.cancelReason) && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-text-secondary mb-1.5">Motivi disdette recenti</p>
              <div className="space-y-1">
                {cancelStats.disdetteLista.filter(a => a.cancelReason).slice(-5).reverse().map(a => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="text-text-secondary font-medium">{formatDate(a.date)}</span>
                    <span>·</span>
                    <span>{a.cancelReason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

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
            {/*
              Il credito sta nel Profilo, non nella scheda estetica.

              Era finito li' dentro insieme a foto e consensi, ed e' il posto
              in cui nessuno lo cerca: sono soldi che il centro deve alla
              cliente, e li si va a guardare dove si guardano il telefono e il
              listino. Occupa tutta la riga perche' i movimenti sotto vanno
              letti per esteso — quando una cliente dice «avevo lasciato
              cinquanta euro», la riga con la data chiude il discorso.
            */}
            <div className="lg:col-span-2">
              <Credito clientId={client.id} />
            </div>

            {/* Personal Info */}
            <div className="bg-bg-secondary border border-border rounded-2xl p-5">
              <h3 className="text-base font-display font-semibold text-text-primary mb-4">Informazioni Personali</h3>
              <div className="space-y-3">
                {[
                  { label: 'Nome', value: `${client.firstName} ${client.lastName}` },
                  { label: 'Telefono', value: client.phone },
                  { label: 'Email', value: client.email || '—' },
                  { label: 'Data di Nascita', value: client.birthDate ? formatBirthDate(client.birthDate) : '—' },
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

                {/* Sta qui, fra le impostazioni personali, e non fra i segni:
                    non e' un giudizio sulla cliente, e' una decisione su un
                    messaggio. */}
                <NienteRecensione clientId={client.id} />
              </div>
            </div>

            {/* Notes & Preferences */}
            <div className="space-y-4">
              {/* Promemoria: si scrivono qui, giorni prima, e ricompaiono da
                  soli al check-in quando la cliente è davvero al banco. */}
              <div className="bg-bg-secondary border border-border rounded-2xl p-5">
                <h3 className="text-base font-display font-semibold text-text-primary mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-warning" /> Da chiedere quando è qui
                </h3>
                <p className="text-[11px] text-text-muted mb-3">Salta fuori al check-in del prossimo appuntamento.</p>
                <PromemoriaCliente clientId={client.id} conStorico senzaTitolo />
              </div>

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
                {/*
                  Dalla piu' recente alla piu' vecchia.

                  Senza la data scritta l'ordine non si notava; con la data in
                  chiaro, partire da un mese fa vorrebbe dire scorrere fino in
                  fondo per sapere quando e' venuta l'ultima volta — che e'
                  proprio la domanda che ci si fa aprendo lo storico.
                */}
                {[...clientAppointments]
                  .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))
                  .map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                    <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: apt.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{apt.treatmentName}</p>
                      <p className="text-xs text-text-secondary">con {apt.operatorName}</p>
                      {/* La data prima dell'ora: uno storico senza il giorno
                          dice solo "alle nove", e di quale giorno non si sa. */}
                      <p className="text-[11px] text-text-muted mt-0.5">
                        <span className="font-semibold text-text-secondary">{dataVisita(apt.date)}</span>
                        {' · '}{apt.startTime} - {apt.endTime}
                      </p>
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
                  setCustomForm({ treatmentId: '', duration: '', price: '', notes: '' });
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

        {activeTab === 'documents' && client && (
          <ClientRecordTab clientId={client.id} nomeCliente={`${client.firstName} ${client.lastName}`.trim()} />
        )}

        {activeTab === 'loyalty' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BoxCodiceInvito clientId={client.id} />
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
                      onChange={e => setCustomForm(prev => ({ ...prev, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider">Durata Person. (min)</label>
                    <input 
                      type="number" 
                      step={5}
                      value={customForm.duration} 
                      onChange={e => setCustomForm(prev => ({ ...prev, duration: e.target.value === '' ? '' : Number(e.target.value) }))}
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

      <AnimatePresence>
        {isEditModalOpen && (
          <AddClientModal
            initialData={client}
            onClose={() => setIsEditModalOpen(false)}
            onSave={(updates) => {
              updateClient(client.id, updates);
              setIsEditModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Appuntamenti già fissati: cliccando una riga si apre l'agenda su quel giorno */}
      <AnimatePresence>
        {prossimiOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProssimiOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-bg-secondary shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="flex items-center gap-3 px-5 py-4 bg-accent/10 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-display font-bold text-text-primary">
                    Appuntamenti di {client.firstName}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {prossimiAppuntamenti.length === 0
                      ? 'Nessun appuntamento fissato'
                      : `${prossimiAppuntamenti.length} da fare, dal più vicino`}
                  </p>
                </div>
                <button onClick={() => setProssimiOpen(false)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary flex-shrink-0">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto">
                {prossimiAppuntamenti.length === 0 ? (
                  <p className="text-sm text-text-secondary py-4 text-center">
                    {client.firstName} non ha appuntamenti in agenda da oggi in avanti.
                  </p>
                ) : prossimiAppuntamenti.map(a => (
                  <button key={a.id}
                    onClick={() => {
                      const [y, m, d] = a.date.split('-').map(Number);
                      setSelectedDate(new Date(y, m - 1, d));
                      router.push('/dashboard/agenda');
                    }}
                    className="w-full text-left rounded-xl border border-border bg-bg-tertiary/40 p-3 hover:bg-bg-hover transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-primary capitalize">{formatDate(a.date)}</span>
                      <span className="text-sm text-accent font-semibold">{a.startTime} – {a.endTime}</span>
                      <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${getStatusColor(a.status)}15`, color: getStatusColor(a.status) }}>
                        {getStatusLabel(a.status)}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {a.treatmentName} · con {a.operatorName}
                      {a.price > 0 && ` · ${formatCurrency(a.price)}`}
                    </p>
                  </button>
                ))}
              </div>

              <div className="p-4 pt-0 flex-shrink-0">
                <p className="text-[11px] text-text-muted text-center">Tocca un appuntamento per aprirlo in agenda.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Il codice invito detto al banco: "vengo da parte di Maria, REVO-XXXX".
 * Si scrive qui e il benvenuto arriva subito nel wallet della nuova
 * cliente; il premio di chi ha invitato matura al suo primo incasso.
 */
function BoxCodiceInvito({ clientId }: { clientId: string }) {
  const [codice, setCodice] = useState('');
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [invio, setInvio] = useState(false);

  const applica = async () => {
    if (!codice.trim() || invio) return;
    setInvio(true);
    setEsito(null);
    try {
      const r = await fetch('/api/admin/referral-codice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, codice }),
      });
      const j = await r.json();
      setEsito(r.ok
        ? { ok: true, testo: `Fatto! ${j.importo} € di benvenuto accreditati (invitata da ${j.inviter}).` }
        : { ok: false, testo: j.error || 'Codice non valido.' });
      if (r.ok) setCodice('');
    } catch {
      setEsito({ ok: false, testo: 'Errore di rete: riprova.' });
    } finally {
      setInvio(false);
    }
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-5 lg:col-span-2">
      <h3 className="text-base font-display font-semibold text-text-primary mb-1">🎁 Codice invito di un&apos;amica</h3>
      <p className="text-xs text-text-muted mb-3">
        Se questa cliente è nuova e arriva &quot;da parte di&quot; qualcuna con l&apos;app, scrivi qui il suo codice:
        il credito di benvenuto entra subito nel wallet e si può usare già in questa cassa.
      </p>
      <div className="flex gap-2">
        <input
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          placeholder="ES. MARIA-7K2P"
          className="flex-1 border border-border bg-bg-primary rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-text-primary"
        />
        <button onClick={() => void applica()} disabled={invio || !codice.trim()}
          className="text-sm bg-black text-white rounded-lg px-4 py-2 disabled:opacity-40">
          {invio ? 'Verifico…' : 'Applica'}
        </button>
      </div>
      {esito && (
        <p className={`text-sm mt-2 ${esito.ok ? 'text-success' : 'text-error'}`}>{esito.testo}</p>
      )}
    </div>
  );
}
