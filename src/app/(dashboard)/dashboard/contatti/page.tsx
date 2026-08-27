import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { STATI_LEAD, etichettaStato } from '@/lib/lead';
import { isSendablePhone } from '@/lib/whatsapp';
import { getWaAutomationsConfig } from '@/lib/wa-automations';
import { Inbox, Phone, Mail, Globe, MessageSquare, AlertTriangle, CalendarCheck } from 'lucide-react';
import AzioniContatto from './AzioniContatto';

/**
 * I contatti lasciati dal sito, prima che diventino clienti.
 *
 * Esiste perché prima non esistevano: il modulo di revobeauty.it/contatti
 * mostrava «Messaggio Inviato!» e non inviava niente. Questa pagina è il posto
 * dove si vede che una persona ha chiesto qualcosa, se le abbiamo già scritto,
 * e come è andata a finire.
 */
export const dynamic = 'force-dynamic';

const COLORI: Record<string, string> = {
  nuovo: 'bg-warning/15 text-warning',
  contattato: 'bg-accent/15 text-accent',
  in_chat: 'bg-accent/15 text-accent',
  prenotato: 'bg-success/15 text-success',
  cliente: 'bg-success/15 text-success',
  perso: 'bg-bg-tertiary text-text-muted',
};

function quando(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default async function ContattiPage({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string }>;
}) {
  const sp = await searchParams;
  const filtro = sp?.stato && sp.stato in STATI_LEAD ? sp.stato : 'tutti';

  const [leads, cfg] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    getWaAutomationsConfig().catch(() => null),
  ]);

  const conteggi = new Map<string, number>();
  for (const l of leads) conteggi.set(l.status, (conteggi.get(l.status) || 0) + 1);

  const mostrati = filtro === 'tutti' ? leads : leads.filter(l => l.status === filtro);
  const daContattare = leads.filter(l => !l.contactedAt && isSendablePhone(l.phone)).length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Inbox className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Contatti dal sito</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Chi ha lasciato i suoi dati e non è ancora cliente. Il primo messaggio su WhatsApp
            verifica il numero e apre la conversazione; da lì continua la segretaria.
          </p>
        </div>
      </div>

      {/* Se la segretaria è spenta il primo messaggio non parte da solo: va
          detto qui, non scoperto fra tre giorni contando i contatti fermi. */}
      {cfg && !cfg.segretaria && daContattare > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            La <b>segretaria WhatsApp è spenta</b>, quindi il primo messaggio non parte da solo:
            ci sono <b>{daContattare}</b> contatti a cui non ha scritto nessuno. Puoi mandarlo a mano
            con il tasto ▶, oppure accenderla da{' '}
            <Link href="/dashboard/automazioni" className="text-accent underline">Automazioni</Link>.
          </p>
        </div>
      )}

      {/* Filtri */}
      <div className="flex flex-wrap gap-1.5">
        <Link href="/dashboard/contatti"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${filtro === 'tutti' ? 'bg-accent text-white border-accent' : 'bg-bg-secondary text-text-secondary border-border'}`}>
          Tutti ({leads.length})
        </Link>
        {Object.entries(STATI_LEAD).map(([k, label]) => (
          <Link key={k} href={`/dashboard/contatti?stato=${k}`}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${filtro === k ? 'bg-accent text-white border-accent' : 'bg-bg-secondary text-text-secondary border-border'}`}>
            {label} ({conteggi.get(k) || 0})
          </Link>
        ))}
      </div>

      {mostrati.length === 0 ? (
        <div className="p-8 rounded-xl bg-bg-secondary border border-border/50 text-center">
          <p className="text-sm text-text-muted">Nessun contatto qui.</p>
          <p className="text-[11px] text-text-muted/70 mt-1">
            Il modulo del sito deve postare su <code className="text-warning">/api/lead</code>.
            Le istruzioni per il tema stanno in <code>integrazioni/wordpress/</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mostrati.map(l => (
            <div key={l.id} className="p-3 rounded-xl bg-bg-secondary border border-border/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">
                      {`${l.firstName} ${l.lastName}`.trim() || 'Senza nome'}
                    </span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${COLORI[l.status] || COLORI.perso}`}>
                      {etichettaStato(l.status).toUpperCase()}
                    </span>
                    {l.service && (
                      <span className="text-[10px] text-text-secondary px-1.5 py-0.5 rounded-full bg-bg-tertiary">{l.service}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone || '—'}</span>
                    {l.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{l.email}</span>}
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{l.source}</span>
                    <span>{quando(l.createdAt)}</span>
                    {l.contactedAt && (
                      <span className="flex items-center gap-1 text-accent">
                        <MessageSquare className="w-3 h-3" />scritto il {quando(l.contactedAt)}
                      </span>
                    )}
                    {l.appointmentId && (
                      <span className="flex items-center gap-1 text-success"><CalendarCheck className="w-3 h-3" />ha prenotato</span>
                    )}
                  </div>

                  {l.message && (
                    <p className="text-[11px] text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed max-w-3xl">
                      {l.message}
                    </p>
                  )}
                  {l.notes && (
                    <p className="text-[10px] text-text-muted/70 mt-1.5 whitespace-pre-wrap leading-relaxed max-w-3xl">
                      {l.notes}
                    </p>
                  )}
                </div>

                <AzioniContatto
                  id={l.id}
                  stato={l.status}
                  giaContattato={Boolean(l.contactedAt)}
                  contattabile={isSendablePhone(l.phone)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
