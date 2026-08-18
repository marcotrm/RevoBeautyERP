'use client';

/**
 * La casa del telefono.
 *
 * Serve a una cosa sola: aprire il gestionale dal telefono e in due secondi
 * sapere com'è andata la giornata e chi c'è in agenda, senza pizzicare lo
 * schermo su una pagina pensata per un monitor.
 *
 * Le pagine sotto esistevano già. Quello che mancava era la porta d'ingresso.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Euro, Users, Vault, MessageSquare, Monitor, ChevronRight, Bell,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAppointments } from '@/app/actions/agenda';
import { getTodayTransactions } from '@/app/actions/pos';

function euro(n: number) { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
function oggiStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export default function CasaMobilePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [idratato, setIdratato] = useState(false);
  const [caricando, setCaricando] = useState(true);
  const [dati, setDati] = useState({ incasso: 0, appuntamenti: 0, restano: 0, prossimo: '' });

  useEffect(() => {
    const stop = useAuthStore.persist.onFinishHydration(() => setIdratato(true));
    setIdratato(useAuthStore.persist.hasHydrated());
    return () => stop();
  }, []);
  useEffect(() => { if (idratato && !isAuthenticated) router.push('/login'); }, [idratato, isAuthenticated, router]);

  useEffect(() => {
    const oggi = oggiStr();
    const ora = new Date();
    const adesso = ora.getHours() * 60 + ora.getMinutes();
    Promise.all([getAppointments(), getTodayTransactions()])
      .then(([app, tx]) => {
        const diOggi = app.filter(a => a.date === oggi && a.status !== 'cancelled' && a.status !== 'no_show');
        const futuri = diOggi
          .filter(a => { const [h, m] = a.startTime.split(':').map(Number); return h * 60 + m >= adesso; })
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        setDati({
          // Come nella pagina Incassi: i resi arrivano già col totale negativo.
          incasso: tx.reduce((s, t) => s + t.total, 0),
          appuntamenti: diOggi.length,
          restano: futuri.length,
          prossimo: futuri[0] ? `${futuri[0].startTime} · ${futuri[0].clientName}` : '',
        });
      })
      .catch(() => {})
      .finally(() => setCaricando(false));
  }, []);

  if (!idratato || !isAuthenticated) return null;

  const oggi = new Date();
  const scorciatoie = [
    { href: '/agenda-mobile', titolo: 'Agenda', sotto: dati.restano > 0 ? `${dati.restano} ancora da fare oggi` : 'la giornata, ora per ora', icona: CalendarDays, colore: 'text-accent' },
    { href: '/dashboard-mobile', titolo: 'Incassi di oggi', sotto: 'scontrini e scontrino medio', icona: Euro, colore: 'text-success' },
    { href: '/clienti-mobile', titolo: 'Clienti', sotto: 'cerca, chiama, scrivi su WhatsApp', icona: Users, colore: 'text-pink-400' },
    { href: '/cassaforte-mobile', titolo: 'Cassaforte', sotto: 'quanto c’è e chi ha prelevato', icona: Vault, colore: 'text-warning' },
    { href: '/dashboard/whatsapp', titolo: 'WhatsApp', sotto: 'i messaggi delle clienti', icona: MessageSquare, colore: 'text-green-400' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="px-4 pt-6 pb-4">
        <p className="text-xs text-text-muted capitalize">{GIORNI[oggi.getDay()]} {oggi.getDate()} {MESI[oggi.getMonth()]}</p>
        <h1 className="text-2xl font-display font-bold mt-0.5">
          Ciao{user?.firstName ? ` ${user.firstName}` : ''}
        </h1>
      </div>

      {/* I due numeri che si guardano da fuori: quanto è entrato e quanto manca. */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-bg-secondary border border-border p-4">
          <p className="text-2xl font-display font-bold text-success">{caricando ? '—' : euro(dati.incasso)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">incassato oggi</p>
        </div>
        <div className="rounded-2xl bg-bg-secondary border border-border p-4">
          <p className="text-2xl font-display font-bold">{caricando ? '—' : dati.appuntamenti}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            appuntamenti oggi{dati.restano > 0 ? ` · ne restano ${dati.restano}` : ''}
          </p>
        </div>
      </div>

      {dati.prossimo && (
        <div className="px-4 mt-3">
          <Link href="/agenda-mobile" className="flex items-center gap-2.5 p-3 rounded-2xl bg-accent/10 border border-accent/30">
            <Bell className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted">Il prossimo</p>
              <p className="text-sm font-semibold truncate">{dati.prossimo}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted ml-auto flex-shrink-0" />
          </Link>
        </div>
      )}

      <div className="px-4 mt-5 space-y-2.5">
        {scorciatoie.map(s => {
          const Icona = s.icona;
          return (
            <Link key={s.href} href={s.href}
              className="flex items-center gap-3 p-4 rounded-2xl bg-bg-secondary border border-border active:bg-bg-tertiary">
              <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                <Icona className={`w-5 h-5 ${s.colore}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.titolo}</p>
                <p className="text-[11px] text-text-muted truncate">{s.sotto}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted ml-auto flex-shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Il gestionale intero resta a un tocco: sul telefono si stringe, ma
          quando serve una cosa che qui non c'è è meglio del niente. */}
      <div className="px-4 mt-4">
        <Link href="/dashboard"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-border text-xs font-semibold text-text-secondary">
          <Monitor className="w-4 h-4" /> Apri il gestionale completo
        </Link>
      </div>
    </div>
  );
}
