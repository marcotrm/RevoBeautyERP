'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Calendar, Users, Euro,
  Activity, ArrowRight, Clock, UserPlus, CreditCard,
  CalendarPlus, UserX, CalendarX, CheckCircle, Package,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useClientStore } from '@/stores/useClientStore';
import { usePackageStore } from '@/stores/usePackageStore';
import {
  formatCurrency, getGreeting, getRelativeTime,
  getStatusLabel, getStatusColor,
} from '@/lib/helpers';
import Link from 'next/link';
import { usePersistedState } from '@/hooks/usePersistedState';

interface TransactionRecord {
  id: number;
  client: string;
  items: string;
  total: number;
  method: string;
  time: string;
  operator: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as const } },
};

const activityIcons: Record<string, React.ReactNode> = {
  'check-circle': <CheckCircle className="w-4 h-4" />,
  'user-plus': <UserPlus className="w-4 h-4" />,
  'credit-card': <CreditCard className="w-4 h-4" />,
  'calendar-plus': <CalendarPlus className="w-4 h-4" />,
  'user-x': <UserX className="w-4 h-4" />,
  'calendar-x': <CalendarX className="w-4 h-4" />,
  'package': <Package className="w-4 h-4" />,
};

function KPICard({ title, value, trend, icon: Icon, isCurrency = false }: {
  title: string; value: number | string; trend: number; icon: React.ElementType; isCurrency?: boolean;
}) {
  const isPositive = trend >= 0;
  return (
    <motion.div variants={item}
      className="bg-bg-secondary border border-border rounded-2xl p-5 hover:border-border-light transition-all duration-300 group">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
          isPositive ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{trend}%
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-text-primary">
        {isCurrency ? formatCurrency(value as number) : value}
      </p>
      <p className="text-sm text-text-secondary mt-1">{title}</p>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-xs text-text-secondary">
          {entry.dataKey === 'revenue' ? 'Fatturato' : 'Servizi'}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// Helper: get today's date string
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Helper: last N days as date strings
function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const appointments = useAgendaStore(s => s.appointments);
  const clients = useClientStore(s => s.clients);
  const clientPackages = usePackageStore(s => s.clientPackages);
  const [transactions] = usePersistedState<TransactionRecord[]>('revo_pos_transactions', []);

  const today = todayStr();

  // =================== LIVE KPIs ===================
  const kpi = useMemo(() => {
    const todayAppts = appointments.filter(a => a.date === today);
    const completedToday = todayAppts.filter(a => a.status === 'completed');
    const apptsRevenue = completedToday.reduce((s, a) => s + a.price, 0);
    
    // Add package payments (both new packages and debt payments)
    const pkgPaymentsToday = clientPackages.reduce((sum, cp) => {
      const todays = cp.payments.filter(p => p.date === today);
      return sum + todays.reduce((s, p) => s + p.amount, 0);
    }, 0);
    
    const revenueToday = apptsRevenue + pkgPaymentsToday;
    const appointmentsToday = todayAppts.length;

    // New clients created today (or in last 24h)
    const oneDayAgo = Date.now() - 86400000;
    const newClientsToday = clients.filter(c => new Date(c.createdAt).getTime() >= oneDayAgo).length;

    // Occupancy: completed + confirmed vs total slots (assume 8 slots per operator, 5 operators = 40)
    const busySlots = todayAppts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length;
    const totalSlots = 40;
    const occupancyRate = totalSlots > 0 ? Math.min(100, Math.round((busySlots / totalSlots) * 100)) : 0;

    // Yesterday comparison for trend
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayAppts = appointments.filter(a => a.date === yesterdayStr);
    const revenueYesterday = yesterdayAppts.filter(a => a.status === 'completed').reduce((s, a) => s + a.price, 0);
    const revenueTrend = revenueYesterday > 0 ? Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100) : (revenueToday > 0 ? 100 : 0);
    const appointmentsTrend = yesterdayAppts.length > 0 ? Math.round(((appointmentsToday - yesterdayAppts.length) / yesterdayAppts.length) * 100) : (appointmentsToday > 0 ? 100 : 0);

    // No-show rate (this week)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const weekAppts = appointments.filter(a => a.date >= weekAgoStr && a.date <= today);
    const noShows = weekAppts.filter(a => a.status === 'no_show').length;
    const noShowRate = weekAppts.length > 0 ? Math.round((noShows / weekAppts.length) * 100) : 0;

    // Avg ticket
    const allCompleted = appointments.filter(a => a.status === 'completed');
    const avgTicket = allCompleted.length > 0 ? Math.round(allCompleted.reduce((s, a) => s + a.price, 0) / allCompleted.length) : 0;

    return {
      revenueToday, revenueTrend, appointmentsToday, appointmentsTrend,
      newClientsToday, occupancyRate, noShowRate, avgTicket,
    };
  }, [appointments, clients, clientPackages, today]);

  // =================== REVENUE CHART (last 7 days) ===================
  const revenueChartData = useMemo(() => {
    const days = lastNDays(7);
    return days.map((d, i) => {
      const dayAppts = appointments.filter(a => a.date === d && a.status === 'completed');
      const apptsRev = dayAppts.reduce((s, a) => s + a.price, 0);
      
      const pkgRev = clientPackages.reduce((sum, cp) => {
        const dayPayments = cp.payments.filter(p => p.date === d);
        return sum + dayPayments.reduce((s, p) => s + p.amount, 0);
      }, 0);

      const revenue = apptsRev + pkgRev;
      const dayDate = new Date(d);
      const isToday = d === today;
      return {
        label: isToday ? 'Oggi' : dayLabels[dayDate.getDay()],
        revenue,
        services: Math.round(revenue * 0.8),
      };
    });
  }, [appointments, clientPackages, today]);

  // =================== LIVE ACTIVITIES ===================
  const liveActivities = useMemo(() => {
    type Activ = { id: string; title: string; description: string; timestamp: string; icon: string; color: string };
    const acts: Activ[] = [];

    // Recent new clients (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    clients.forEach(c => {
      if (new Date(c.createdAt).getTime() >= weekAgo.getTime()) {
        acts.push({
          id: `client-${c.id}`, title: 'Nuova cliente registrata',
          description: `${c.firstName} ${c.lastName} — ${c.phone}`,
          timestamp: c.createdAt.includes('T') ? c.createdAt : `${c.createdAt}T10:00:00`,
          icon: 'user-plus', color: '#3B82F6',
        });
      }
    });

    // Recent appointments (created/completed/cancelled in last 7 days)
    const recentAppts = appointments.filter(a => {
      const updated = a.updatedAt || a.createdAt;
      return new Date(updated).getTime() >= weekAgo.getTime();
    });

    recentAppts.forEach(a => {
      if (a.status === 'completed') {
        acts.push({
          id: `apt-done-${a.id}`, title: 'Appuntamento completato',
          description: `${a.treatmentName} — ${a.clientName} con ${a.operatorName}`,
          timestamp: a.updatedAt || a.createdAt, icon: 'check-circle', color: '#22C55E',
        });
        acts.push({
          id: `pay-${a.id}`, title: 'Pagamento ricevuto',
          description: `${formatCurrency(a.price)} — ${a.clientName}`,
          timestamp: a.updatedAt || a.createdAt, icon: 'credit-card', color: '#A855F7',
        });
      } else if (a.status === 'no_show') {
        acts.push({
          id: `ns-${a.id}`, title: 'No-Show registrato',
          description: `${a.treatmentName} — ${a.clientName} non si è presentata`,
          timestamp: a.updatedAt || a.createdAt, icon: 'user-x', color: '#EF4444',
        });
      } else if (a.status === 'cancelled') {
        acts.push({
          id: `canc-${a.id}`, title: 'Appuntamento annullato',
          description: `${a.treatmentName} — ${a.clientName} ha cancellato`,
          timestamp: a.updatedAt || a.createdAt, icon: 'calendar-x', color: '#F59E0B',
        });
      } else if (a.status === 'confirmed' || a.status === 'pending') {
        acts.push({
          id: `new-${a.id}`, title: 'Nuovo appuntamento',
          description: `${a.treatmentName} — ${a.clientName}, ${a.date} ore ${a.startTime}`,
          timestamp: a.createdAt, icon: 'calendar-plus', color: '#EC4899',
        });
      }
    });

    // Package sessions used (last 7 days)
    clientPackages.forEach(cp => {
      cp.history.forEach((h, i) => {
        if (new Date(h.date).getTime() >= weekAgo.getTime()) {
          acts.push({
            id: `pkg-${cp.id}-${i}`, title: 'Seduta pacchetto scalata',
            description: `${cp.clientName} — ${cp.packageName} (${h.operator})`,
            timestamp: `${h.date}T12:00:00`, icon: 'package', color: cp.packageColor,
          });
        }
      });
    });

    // Sort by newest first
    acts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return acts.slice(0, 8);
  }, [appointments, clients, clientPackages]);

  // =================== UPCOMING APPOINTMENTS ===================
  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter(a => a.date >= today && (a.status === 'confirmed' || a.status === 'pending'))
      .sort((a, b) => a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [appointments, today]);

  // =================== QUICK STATS ===================
  const quickStats = useMemo(() => {
    // Active clients (visited in last 60 days)
    const sixtyDaysAgo = Date.now() - 60 * 86400000;
    const activeClients = clients.filter(c => {
      if (!c.lastVisit) return false;
      return new Date(c.lastVisit).getTime() >= sixtyDaysAgo;
    }).length;

    // Active packages
    const activePkgs = clientPackages.filter(cp => cp.status === 'active' || cp.status === 'expiring').length;

    // Total revenue this month
    const monthStart = new Date(); monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthRevenue = appointments
      .filter(a => a.date >= monthStartStr && a.date <= today && a.status === 'completed')
      .reduce((s, a) => s + a.price, 0);

    return { activeClients, activePkgs, monthRevenue };
  }, [clients, clientPackages, appointments, today]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Welcome */}
      <motion.div variants={item}>
        <h2 className="text-2xl font-display font-bold text-text-primary">
          {getGreeting()}, {user?.firstName} ✨
        </h2>
        <p className="text-text-secondary mt-1">
          Ecco il riepilogo della tua giornata
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard title="Fatturato Oggi" value={kpi.revenueToday} trend={kpi.revenueTrend} icon={Euro} isCurrency />
        <KPICard title="Appuntamenti Oggi" value={kpi.appointmentsToday} trend={kpi.appointmentsTrend} icon={Calendar} />
        <KPICard title="Nuovi Clienti" value={kpi.newClientsToday} trend={kpi.newClientsToday > 0 ? 100 : 0} icon={Users} />
        <KPICard title="Occupazione" value={`${kpi.occupancyRate}%`} trend={kpi.occupancyRate > 70 ? 5 : -10} icon={Activity} />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={item} className="xl:col-span-2 bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary">Andamento Fatturato</h3>
              <p className="text-sm text-text-secondary">Ultima settimana</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                <span className="text-text-secondary">Totale</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-accent-secondary" />
                <span className="text-text-secondary">Servizi</span>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientServices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EC4899" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#EC4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E3348" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8B92A5' }} tickFormatter={(v) => `€${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#A855F7" strokeWidth={2.5} fill="url(#gradientRevenue)" />
                <Area type="monotone" dataKey="services" stroke="#EC4899" strokeWidth={2} fill="url(#gradientServices)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Activity — LIVE */}
        <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-display font-semibold text-text-primary">Attività Recenti</h3>
          </div>
          <div className="space-y-1">
            {liveActivities.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">Nessuna attività recente</p>
            )}
            {liveActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-bg-hover transition-colors cursor-pointer">
                <div className="p-2 rounded-lg flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${activity.color}15`, color: activity.color }}>
                  {activityIcons[activity.icon] || <Activity className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{activity.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{activity.description}</p>
                </div>
                <span className="text-[11px] text-text-muted flex-shrink-0 mt-1">
                  {getRelativeTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Upcoming Appointments */}
      <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Prossimi Appuntamenti</h3>
            <p className="text-sm text-text-secondary">{upcomingAppointments.length} in programma</p>
          </div>
          <Link href="/dashboard/agenda"
            className="flex items-center gap-1 text-sm text-accent font-medium hover:underline">
            Vai all&apos;Agenda <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {upcomingAppointments.map((apt) => (
            <div key={apt.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/50 hover:border-border-light transition-all cursor-pointer">
              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: apt.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{apt.clientName}</p>
                <p className="text-xs text-text-secondary truncate">{apt.treatmentName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock className="w-3 h-3" />
                    {apt.date === today ? '' : `${apt.date.slice(5)} `}{apt.startTime} - {apt.endTime}
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${getStatusColor(apt.status)}15`, color: getStatusColor(apt.status) }}>
                    {getStatusLabel(apt.status)}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-text-muted">{apt.operatorName.split(' ')[0]}</p>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(apt.price)}</p>
              </div>
            </div>
          ))}
          {upcomingAppointments.length === 0 && (
            <p className="text-sm text-text-muted col-span-full text-center py-6">Nessun appuntamento in programma</p>
          )}
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-bg-secondary border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-text-primary">{kpi.noShowRate}%</p>
          <p className="text-xs text-text-secondary mt-1">No-Show Rate</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-text-primary">{formatCurrency(kpi.avgTicket)}</p>
          <p className="text-xs text-text-secondary mt-1">Scontrino Medio</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-text-primary">{quickStats.activeClients}</p>
          <p className="text-xs text-text-secondary mt-1">Clienti Attivi</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-bold text-accent">{formatCurrency(quickStats.monthRevenue)}</p>
          <p className="text-xs text-text-secondary mt-1">Fatturato Mese</p>
        </div>
      </motion.div>

      {/* RECENT TRANSACTIONS TABLE */}
      <motion.div variants={item} className="bg-bg-secondary border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-display font-semibold text-text-primary">Ultime Transazioni in Cassa</h3>
            <p className="text-sm text-text-secondary">Dettagli incassi registrati oggi</p>
          </div>
          <Link href="/dashboard/pos" className="flex items-center gap-1 text-sm text-accent font-medium hover:underline">
            Vai alla Cassa <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
                <th className="py-3 px-4">Ora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Articoli</th>
                <th className="py-3 px-4">Operatrice</th>
                <th className="py-3 px-4">Metodo</th>
                <th className="py-3 px-4 text-right">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-sm">
              {transactions.slice(0, 8).map(tx => (
                <tr key={tx.id} className="hover:bg-bg-hover transition-colors">
                  <td className="py-3 px-4 text-text-muted">{tx.time}</td>
                  <td className="py-3 px-4 font-medium text-text-primary">{tx.client}</td>
                  <td className="py-3 px-4 text-text-secondary max-w-[200px] truncate" title={tx.items}>{tx.items}</td>
                  <td className="py-3 px-4 text-text-secondary">{tx.operator}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-lg bg-bg-tertiary text-xs text-text-secondary font-medium">
                      {tx.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-text-primary">{formatCurrency(tx.total)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-muted">Nessuna transazione registrata</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
