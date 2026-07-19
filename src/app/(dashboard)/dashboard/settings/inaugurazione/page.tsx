import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { treatmentLabel, TREATMENTS } from '@/lib/inaugurazione';
import { PartyPopper, CheckCircle2, Clock, Users, Mail, Phone, RefreshCw } from 'lucide-react';
import DeleteLeadButton from './DeleteLeadButton';
import ImportToClientsButton from './ImportToClientsButton';

// Pagina protetta dal gate client-side del layout dashboard (come il resto dell'ERP).
export const dynamic = 'force-dynamic';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type Filter = 'all' | 'pending' | 'confirmed';

export default async function InaugurazionePage({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp?.stato;
  const filter: Filter = raw === 'pending' || raw === 'confirmed' ? raw : 'all';

  const leads = await prisma.inaugurationLead.findMany({
    where: filter === 'all' ? {} : { status: filter },
    orderBy: { createdAt: 'desc' },
  });

  const [total, confirmed, pending] = await Promise.all([
    prisma.inaugurationLead.count(),
    prisma.inaugurationLead.count({ where: { status: 'confirmed' } }),
    prisma.inaugurationLead.count({ where: { status: 'pending' } }),
  ]);

  const stats = [
    { label: 'Contatti totali', value: total, icon: Users, tone: 'text-accent' },
    { label: 'Confermati', value: confirmed, icon: CheckCircle2, tone: 'text-success' },
    { label: 'In attesa', value: pending, icon: Clock, tone: 'text-warning' },
  ];

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tutti' },
    { id: 'pending', label: 'Non confermati' },
    { id: 'confirmed', label: 'Confermati' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-accent flex items-center justify-center">
            <PartyPopper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Inaugurazione</h1>
            <p className="text-sm text-text-muted">Contatti dal coupon “Nuova Apertura” del sito</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportToClientsButton />
          <Link
            href="/dashboard/settings/inaugurazione"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-bg-secondary border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-bg-tertiary flex items-center justify-center">
                <Icon className={`w-5 h-5 ${s.tone}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtri */}
      <div className="flex items-center gap-2">
        {tabs.map((t) => {
          const active = t.id === filter;
          const href = t.id === 'all'
            ? '/dashboard/settings/inaugurazione'
            : `/dashboard/settings/inaugurazione?stato=${t.id}`;
          return (
            <Link
              key={t.id}
              href={href}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tabella */}
      <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-primary font-medium">Nessun contatto</p>
            <p className="text-sm text-text-muted mt-1">
              I contatti che compilano il coupon sul sito compariranno qui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="px-4 py-3 font-medium">Contatto</th>
                  <th className="px-4 py-3 font-medium">Recapiti</th>
                  <th className="px-4 py-3 font-medium">Trattamento</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Data richiesta</th>
                  <th className="px-4 py-3 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/60 last:border-0 hover:bg-bg-hover/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">
                        {lead.firstName} {lead.lastName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-text-secondary">
                        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                          <Mail className="w-3.5 h-3.5" /> {lead.email}
                        </a>
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 hover:text-accent">
                          <Phone className="w-3.5 h-3.5" /> {lead.phone}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-bg-tertiary text-text-primary text-xs font-medium">
                        {treatmentLabel(lead.treatment)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confermato
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 text-warning text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" /> Non confermato
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteLeadButton id={lead.id} name={`${lead.firstName} ${lead.lastName}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Trattamenti disponibili nel coupon: {Object.values(TREATMENTS).join(' · ')}.
      </p>
    </div>
  );
}
