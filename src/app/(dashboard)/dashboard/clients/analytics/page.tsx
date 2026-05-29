'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft, Users, UserCheck, UserX, UserPlus, TrendingUp, DollarSign,
  Target, Clock, RefreshCw, Heart, Shield, Search, ChevronDown, Phone,
  MessageCircle, Bell, AlertTriangle, Gift, Star, Package, ArrowUpRight,
  BarChart3, PieChart as PieIcon, Zap, Award, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  mockClientAnalytics, getKPIs, getTopClients, getAtRiskClients,
  getRFMDistribution, getRevenueDistribution, getParetoData,
  getMonthlyNewClients, getTreatmentStats, getUpsellOpportunities,
  getAlerts, getVisitDistribution, getSourceDistribution,
  monthlyRevenueTrend, LOYALTY_COLORS, ClientAnalytics,
} from '@/lib/client-analytics';

const fmt = (n: number) => '€' + n.toLocaleString('it-IT');

const tabs = [
  { id: 'overview', label: 'Panoramica', icon: BarChart3 },
  { id: 'ranking', label: 'Classifica', icon: Award },
  { id: 'noshow', label: 'Affidabilità', icon: ThumbsDown },
  { id: 'risk', label: 'Rischio', icon: AlertTriangle },
  { id: 'rfm', label: 'RFM', icon: PieIcon },
  { id: 'revenue', label: 'Fatturato', icon: DollarSign },
  { id: 'treatments', label: 'Trattamenti', icon: Zap },
  { id: 'upsell', label: 'Opportunità', icon: TrendingUp },
  { id: 'alerts', label: 'Alert', icon: Bell },
];

const chartColors = ['#8B5CF6', '#22C55E', '#3B82F6', '#F59E0B', '#F97316', '#EF4444', '#EC4899', '#14B8A6'];

/* ======== KPI CARD ======== */
function KPICard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-bg-secondary border border-border rounded-2xl p-4 hover:border-border-light transition-all group">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}15`, color }}><Icon className="w-4 h-4" /></div>
        {sub && <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">{sub}</span>}
      </div>
      <p className="text-xl font-display font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{label}</p>
    </motion.div>
  );
}

/* ======== OVERVIEW TAB ======== */
function OverviewTab({ clients }: { clients: ClientAnalytics[] }) {
  const kpi = useMemo(() => getKPIs(clients), [clients]);
  const rfmData = useMemo(() => getRFMDistribution(clients), [clients]);
  const srcData = useMemo(() => getSourceDistribution(clients), [clients]);

  const kpis = [
    { icon: Users, label: 'Totale Clienti', value: kpi.totalClients, color: '#8B5CF6' },
    { icon: UserCheck, label: 'Attivi (90gg)', value: kpi.activeClients90Days, color: '#22C55E', sub: `${Math.round((kpi.activeClients90Days / kpi.totalClients) * 100)}%` },
    { icon: UserX, label: 'Inattivi', value: kpi.inactiveClients, color: '#EF4444' },
    { icon: UserPlus, label: 'Nuovi del Mese', value: kpi.newClientsMonth, color: '#3B82F6' },
    { icon: DollarSign, label: 'Valore Medio Cliente', value: fmt(kpi.avgClientValue), color: '#F59E0B' },
    { icon: TrendingUp, label: 'Fatturato Mese', value: fmt(kpi.monthlyRevenue), color: '#22C55E' },
    { icon: Target, label: 'Fatturato Anno', value: fmt(kpi.yearlyRevenue), color: '#8B5CF6' },
    { icon: DollarSign, label: 'Ticket Medio', value: fmt(kpi.avgTicket), color: '#EC4899' },
    { icon: RefreshCw, label: 'Freq. Media Visite', value: `${kpi.avgVisitFrequency} visite`, color: '#3B82F6' },
    { icon: Clock, label: 'Tempo Medio tra Visite', value: `${kpi.avgDaysBetweenVisits}gg`, color: '#F97316' },
    { icon: Heart, label: 'Tasso di Ritorno', value: `${kpi.returnRate}%`, color: '#22C55E' },
    { icon: Shield, label: 'Fidelizzazione', value: `${kpi.retentionRate}%`, color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpis.map((k, i) => <KPICard key={i} {...k} />)}
      </div>

      {/* Revenue Trend */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-sm font-display font-semibold text-text-primary mb-4">📈 Andamento Fatturato Clienti (12 mesi)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={monthlyRevenueTrend}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="month" tick={{ fill: '#999', fontSize: 11 }} />
            <YAxis tick={{ fill: '#999', fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} labelStyle={{ color: '#fff' }} formatter={(v: any) => [fmt(v), 'Fatturato']} />
            <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" fill="url(#revGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-sm font-display font-semibold text-text-primary mb-4">📊 Provenienza Clienti</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={srcData} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {srcData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-sm font-display font-semibold text-text-primary mb-4">🎯 Segmentazione RFM</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rfmData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis type="number" tick={{ fill: '#999', fontSize: 11 }} />
              <YAxis type="category" dataKey="segment" tick={{ fill: '#ccc', fontSize: 11 }} width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} />
              <Bar dataKey="count" name="Clienti" radius={[0, 6, 6, 0]}>
                {rfmData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ======== RANKING TAB ======== */
function RankingTab({ clients }: { clients: ClientAnalytics[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'totalRevenue' | 'revenue12Months' | 'totalAppointments' | 'avgTicket' | 'daysSinceLastVisit'>('totalRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [levelFilter, setLevelFilter] = useState('all');

  const sorted = useMemo(() => {
    let list = [...clients];
    if (levelFilter !== 'all') list = list.filter(c => c.loyaltyLevel === levelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q));
    }
    list.sort((a, b) => sortDir === 'desc' ? (b[sortKey] as number) - (a[sortKey] as number) : (a[sortKey] as number) - (b[sortKey] as number));
    return list;
  }, [clients, search, sortKey, sortDir, levelFilter]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted cursor-pointer hover:text-accent transition-colors select-none"
      onClick={() => toggleSort(k)}>
      {label} {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" />
        </div>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none transition-all appearance-none">
          <option value="all">Tutti i livelli</option>
          {['VIP', 'Platinum', 'Gold', 'Silver', 'Bronze'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-bg-tertiary/30">
              <tr>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted w-10">#</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Cliente</th>
                <SortHeader label="Fatturato" k="totalRevenue" />
                <SortHeader label="Fatt. 12M" k="revenue12Months" />
                <SortHeader label="N° App." k="totalAppointments" />
                <SortHeader label="Ticket" k="avgTicket" />
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Ultima Visita</th>
                <SortHeader label="Giorni" k="daysSinceLastVisit" />
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Tratt. Preferito</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Livello</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((c, i) => (
                <tr key={c.id} className={`hover:bg-bg-hover/50 transition-colors ${i < 10 ? 'bg-accent/[0.02]' : ''}`}>
                  <td className="px-3 py-3"><span className={`text-xs font-bold ${i < 3 ? 'text-accent' : 'text-text-muted'}`}>{i + 1}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: LOYALTY_COLORS[c.loyaltyLevel] || '#666' }}>
                        {c.firstName[0]}{c.lastName[0]}
                      </div>
                      <span className="text-sm font-medium text-text-primary whitespace-nowrap">{c.firstName} {c.lastName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-text-primary">{fmt(c.totalRevenue)}</td>
                  <td className="px-3 py-3 text-sm text-text-secondary">{fmt(c.revenue12Months)}</td>
                  <td className="px-3 py-3 text-sm text-text-secondary">{c.totalAppointments}</td>
                  <td className="px-3 py-3 text-sm text-text-secondary">{fmt(c.avgTicket)}</td>
                  <td className="px-3 py-3 text-xs text-text-muted whitespace-nowrap">{c.lastVisitDate}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold ${c.daysSinceLastVisit > 60 ? 'text-error' : c.daysSinceLastVisit > 30 ? 'text-warning' : 'text-success'}`}>
                      {c.daysSinceLastVisit}gg
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-muted max-w-[140px] truncate">{c.preferredTreatment}</td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${LOYALTY_COLORS[c.loyaltyLevel]}20`, color: LOYALTY_COLORS[c.loyaltyLevel] }}>
                      {c.loyaltyLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ======== RELIABILITY / NO-SHOW TAB ======== */
function ReliabilityTab({ clients }: { clients: ClientAnalytics[] }) {
  const [sortMode, setSortMode] = useState<'worst' | 'best'>('worst');

  const sorted = useMemo(() => {
    const list = [...clients].filter(c => c.totalBooked >= 2);
    if (sortMode === 'worst') {
      list.sort((a, b) => (b.noShowCount + b.cancelledCount) - (a.noShowCount + a.cancelledCount));
    } else {
      list.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
    }
    return list;
  }, [clients, sortMode]);

  const totalNoShows = clients.reduce((s, c) => s + c.noShowCount, 0);
  const totalCancelled = clients.reduce((s, c) => s + c.cancelledCount, 0);
  const totalBooked = clients.reduce((s, c) => s + c.totalBooked, 0);
  const avgReliability = clients.length > 0 ? Math.round(clients.reduce((s, c) => s + c.reliabilityScore, 0) / clients.length) : 0;
  const worstOffenders = clients.filter(c => c.noShowCount >= 3);

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-error/5 border border-error/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-error">{totalNoShows}</p>
          <p className="text-[10px] text-text-muted">No-Show Totali</p>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-warning">{totalCancelled}</p>
          <p className="text-[10px] text-text-muted">Cancellazioni</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-text-primary">{totalBooked}</p>
          <p className="text-[10px] text-text-muted">Prenotazioni Totali</p>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-success">{avgReliability}%</p>
          <p className="text-[10px] text-text-muted">Affidabilità Media</p>
        </div>
        <div className="bg-error/5 border border-error/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-error">{worstOffenders.length}</p>
          <p className="text-[10px] text-text-muted">Recidivi (3+ No-Show)</p>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => setSortMode('worst')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${sortMode === 'worst' ? 'bg-error text-white shadow-lg shadow-error/20' : 'bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover'}`}>
          <ThumbsDown className="w-3.5 h-3.5" /> Peggiori prima
        </button>
        <button onClick={() => setSortMode('best')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${sortMode === 'best' ? 'bg-success text-white shadow-lg shadow-success/20' : 'bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover'}`}>
          <ThumbsUp className="w-3.5 h-3.5" /> Migliori prima
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-bg-tertiary/30">
              <tr>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted w-10">#</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Cliente</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-error">No-Show</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-warning">Cancellazioni</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">Tot. Prenotati</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">Completati</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted min-w-[140px]">Affidabilità</th>
                <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((c, i) => {
                const totalBad = c.noShowCount + c.cancelledCount;
                const reliColor = c.reliabilityScore >= 90 ? '#22C55E' : c.reliabilityScore >= 70 ? '#F59E0B' : '#EF4444';
                const medal = sortMode === 'worst'
                  ? (i === 0 ? '💀' : i === 1 ? '⚠️' : i === 2 ? '😤' : '')
                  : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '');
                const statusLabel = c.reliabilityScore >= 95 ? 'Eccellente' : c.reliabilityScore >= 85 ? 'Affidabile' : c.reliabilityScore >= 70 ? 'Medio' : c.reliabilityScore >= 50 ? 'Problematico' : 'Inaffidabile';
                const statusColor = c.reliabilityScore >= 95 ? 'text-success bg-success/10' : c.reliabilityScore >= 85 ? 'text-blue-400 bg-blue-500/10' : c.reliabilityScore >= 70 ? 'text-warning bg-warning/10' : c.reliabilityScore >= 50 ? 'text-orange-400 bg-orange-500/10' : 'text-error bg-error/10';

                return (
                  <tr key={c.id} className={`hover:bg-bg-hover/50 transition-colors ${sortMode === 'worst' && i < 3 && totalBad > 0 ? 'bg-error/[0.03]' : ''} ${sortMode === 'best' && i < 3 ? 'bg-success/[0.03]' : ''}`}>
                    <td className="px-3 py-3">
                      <span className="text-sm">{medal || <span className="text-xs text-text-muted">{i + 1}</span>}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: reliColor }}>
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-text-primary whitespace-nowrap">{c.firstName} {c.lastName}</span>
                          <p className="text-[10px] text-text-muted">{c.preferredTreatment}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-bold ${c.noShowCount > 0 ? 'text-error' : 'text-text-muted'}`}>{c.noShowCount}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-bold ${c.cancelledCount > 0 ? 'text-warning' : 'text-text-muted'}`}>{c.cancelledCount}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-text-secondary">{c.totalBooked}</td>
                    <td className="px-3 py-3 text-center text-sm text-success font-semibold">{c.totalAppointments}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-bg-tertiary overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${c.reliabilityScore}%`, backgroundColor: reliColor }} />
                        </div>
                        <span className="text-xs font-bold min-w-[32px] text-right" style={{ color: reliColor }}>{c.reliabilityScore}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ======== RISK TAB ======== */
function RiskTab({ clients }: { clients: ClientAnalytics[] }) {
  const [threshold, setThreshold] = useState<30 | 60 | 90>(30);
  const atRisk = useMemo(() => getAtRiskClients(clients, threshold), [clients, threshold]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {([30, 60, 90] as const).map(t => (
          <button key={t} onClick={() => setThreshold(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${threshold === t ? 'gradient-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover'}`}>
            {'>'}{t} giorni ({getAtRiskClients(clients, t).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {atRisk.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-error/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#EF4444' }}>
                {c.firstName[0]}{c.lastName[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-text-muted">{c.preferredTreatment}</p>
              </div>
              <span className="text-xs font-bold text-error">{c.daysSinceLastVisit}gg</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-bg-tertiary/50"><p className="text-[10px] text-text-muted">Ultima visita</p><p className="text-xs font-semibold text-text-primary">{c.lastVisitDate}</p></div>
              <div className="p-2 rounded-lg bg-bg-tertiary/50"><p className="text-[10px] text-text-muted">Fatturato</p><p className="text-xs font-semibold text-text-primary">{fmt(c.totalRevenue)}</p></div>
            </div>

            {/* Churn bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-text-muted">Probabilità abbandono</p>
                <p className={`text-xs font-bold ${c.churnProbability > 60 ? 'text-error' : c.churnProbability > 30 ? 'text-warning' : 'text-success'}`}>{c.churnProbability}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${c.churnProbability}%`, background: c.churnProbability > 60 ? '#EF4444' : c.churnProbability > 30 ? '#F59E0B' : '#22C55E' }} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors">
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors">
                <Phone className="w-3 h-3" /> Chiama
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors">
                <Bell className="w-3 h-3" /> Promemoria
              </button>
            </div>
          </motion.div>
        ))}
        {atRisk.length === 0 && <p className="text-text-muted text-sm col-span-full text-center py-8">Nessun cliente a rischio in questa fascia 🎉</p>}
      </div>
    </div>
  );
}

/* ======== RFM TAB ======== */
function RFMTab({ clients }: { clients: ClientAnalytics[] }) {
  const rfm = useMemo(() => getRFMDistribution(clients), [clients]);
  const descriptions: Record<string, string> = {
    'VIP': 'Clienti top: vengono spesso, spendono molto, recenti',
    'Fedeli': 'Clienti affidabili: buona frequenza e spesa',
    'Regolari': 'Clienti abituali: nella media su tutti i parametri',
    'Occasionali': 'Clienti saltuari: poche visite o spesa bassa',
    'Da recuperare': 'Non vengono da un po\' ma hanno potenziale',
    'Persi': 'Clienti inattivi da molto tempo',
  };

  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-base font-display font-semibold text-text-primary mb-2">📊 Modello RFM (Recency, Frequency, Monetary)</h3>
        <p className="text-sm text-text-muted mb-4">Classifica automatica basata su: <strong className="text-text-secondary">quanto recentemente</strong> è venuto, <strong className="text-text-secondary">quanto spesso</strong> viene, e <strong className="text-text-secondary">quanto spende</strong>.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {rfm.map(seg => (
            <div key={seg.segment} className="rounded-xl border border-border p-4 text-center" style={{ borderColor: `${seg.color}30` }}>
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: seg.color }}>
                {seg.count}
              </div>
              <p className="text-sm font-semibold text-text-primary">{seg.segment}</p>
              <p className="text-xs text-text-muted mt-1">{fmt(seg.revenue)}</p>
              <p className="text-[10px] text-text-muted mt-1">{descriptions[seg.segment]}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-sm font-display font-semibold text-text-primary mb-4">Distribuzione Fatturato per Segmento</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rfm}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="segment" tick={{ fill: '#999', fontSize: 11 }} />
            <YAxis tick={{ fill: '#999', fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} formatter={(v: any) => [fmt(v), 'Fatturato']} />
            <Bar dataKey="revenue" name="Fatturato" radius={[8, 8, 0, 0]}>
              {rfm.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ======== REVENUE TAB ======== */
function RevenueTab({ clients }: { clients: ClientAnalytics[] }) {
  const pareto = useMemo(() => getParetoData(clients), [clients]);
  const revDist = useMemo(() => getRevenueDistribution(clients), [clients]);
  const visitDist = useMemo(() => getVisitDistribution(clients), [clients]);
  const pareto80 = pareto.find(p => p.revenuePercent >= 80);

  return (
    <div className="space-y-6">
      {/* Pareto */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-semibold text-text-primary">📐 Analisi Pareto 80/20</h3>
          {pareto80 && <span className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-semibold">{pareto80.clientPercent}% dei clienti genera l&apos;80% del fatturato</span>}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={pareto}>
            <defs>
              <linearGradient id="paretoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="clientPercent" tick={{ fill: '#999', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <YAxis tick={{ fill: '#999', fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} formatter={(v: any) => [`${v}%`, 'Fatturato cumulativo']} />
            <Area type="monotone" dataKey="revenuePercent" stroke="#8B5CF6" fill="url(#paretoGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-sm font-display font-semibold text-text-primary mb-4">💰 Distribuzione Spesa</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="range" tick={{ fill: '#999', fontSize: 10 }} />
              <YAxis tick={{ fill: '#999', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} />
              <Bar dataKey="count" name="Clienti" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-5">
          <h3 className="text-sm font-display font-semibold text-text-primary mb-4">📅 Distribuzione Visite</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={visitDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="range" tick={{ fill: '#999', fontSize: 10 }} />
              <YAxis tick={{ fill: '#999', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} />
              <Bar dataKey="count" name="Clienti" fill="#22C55E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ======== TREATMENTS TAB ======== */
function TreatmentsTab({ clients }: { clients: ClientAnalytics[] }) {
  const stats = useMemo(() => getTreatmentStats(clients), [clients]);
  return (
    <div className="space-y-6">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <h3 className="text-sm font-display font-semibold text-text-primary mb-4">💅 Top Trattamenti per Fatturato</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.slice(0, 8)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis type="number" tick={{ fill: '#999', fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#ccc', fontSize: 10 }} width={160} />
            <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 12 }} formatter={(v: any) => [fmt(v), 'Fatturato']} />
            <Bar dataKey="revenue" name="Fatturato" radius={[0, 6, 6, 0]}>
              {stats.slice(0, 8).map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border bg-bg-tertiary/30">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Trattamento</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Clienti</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Fatturato</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">Ritorno Medio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {stats.map((t, i) => (
              <tr key={t.name} className="hover:bg-bg-hover/50 transition-colors">
                <td className="px-4 py-3 text-sm text-text-primary font-medium flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />{t.name}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{t.count}</td>
                <td className="px-4 py-3 text-sm font-semibold text-text-primary">{fmt(t.revenue)}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{fmt(t.avgReturn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======== UPSELL TAB ======== */
function UpsellTab({ clients }: { clients: ClientAnalytics[] }) {
  const opps = useMemo(() => getUpsellOpportunities(clients), [clients]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {opps.map((opp, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
          className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{opp.icon}</span>
            <div>
              <h4 className="text-sm font-display font-semibold text-text-primary">{opp.type}</h4>
              <p className="text-xs text-text-muted">{opp.clients.length} clienti identificati</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-accent/5 border border-accent/10 mb-3">
            <p className="text-xs text-accent font-medium">💡 {opp.suggestion}</p>
          </div>
          {opp.clients.length > 0 ? (
            <div className="space-y-1.5">
              {opp.clients.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-tertiary/50 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[9px] font-bold">{c.firstName[0]}{c.lastName[0]}</div>
                  <span className="text-xs text-text-primary flex-1">{c.firstName} {c.lastName}</span>
                  <span className="text-[10px] text-text-muted">{fmt(c.totalRevenue)} • {c.totalAppointments} vis.</span>
                </div>
              ))}
              {opp.clients.length > 5 && <p className="text-[10px] text-text-muted text-center">+{opp.clients.length - 5} altri</p>}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-3">Nessun cliente in questa categoria</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ======== ALERTS TAB ======== */
function AlertsTab({ clients }: { clients: ClientAnalytics[] }) {
  const alerts = useMemo(() => getAlerts(clients), [clients]);
  const alertStyles = {
    danger: { bg: 'bg-error/5', border: 'border-error/30', icon: AlertTriangle, iconColor: 'text-error' },
    warning: { bg: 'bg-warning/5', border: 'border-warning/30', icon: AlertTriangle, iconColor: 'text-warning' },
    birthday: { bg: 'bg-accent/5', border: 'border-accent/30', icon: Gift, iconColor: 'text-accent' },
    info: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', icon: Bell, iconColor: 'text-blue-400' },
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-error/5 border border-error/20 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-error">{alerts.filter(a => a.type === 'danger').length}</p>
          <p className="text-[10px] text-text-muted">Critici</p>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-warning">{alerts.filter(a => a.type === 'warning').length}</p>
          <p className="text-[10px] text-text-muted">Attenzione</p>
        </div>
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-accent">{alerts.filter(a => a.type === 'birthday').length}</p>
          <p className="text-[10px] text-text-muted">Compleanni</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-400">{alerts.filter(a => a.type === 'info').length}</p>
          <p className="text-[10px] text-text-muted">Info</p>
        </div>
      </div>

      {alerts.map((alert, i) => {
        const style = alertStyles[alert.type];
        const Icon = style.icon;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-3 p-4 rounded-xl border ${style.bg} ${style.border}`}>
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-text-primary">{alert.clientName}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.iconColor}`}>{alert.type === 'danger' ? 'Critico' : alert.type === 'warning' ? 'Attenzione' : alert.type === 'birthday' ? 'Compleanno' : 'Info'}</span>
              </div>
              <p className="text-xs text-text-secondary">{alert.message}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{alert.detail}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ======== MAIN PAGE ======== */
export default function ClientAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const clients = mockClientAnalytics;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clients" className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">Dashboard Clienti</h2>
            <p className="text-sm text-text-secondary">{clients.length} clienti • Analisi completa del portafoglio</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'gradient-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
              }`}>
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {activeTab === 'overview' && <OverviewTab clients={clients} />}
          {activeTab === 'ranking' && <RankingTab clients={clients} />}
          {activeTab === 'noshow' && <ReliabilityTab clients={clients} />}
          {activeTab === 'risk' && <RiskTab clients={clients} />}
          {activeTab === 'rfm' && <RFMTab clients={clients} />}
          {activeTab === 'revenue' && <RevenueTab clients={clients} />}
          {activeTab === 'treatments' && <TreatmentsTab clients={clients} />}
          {activeTab === 'upsell' && <UpsellTab clients={clients} />}
          {activeTab === 'alerts' && <AlertsTab clients={clients} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
