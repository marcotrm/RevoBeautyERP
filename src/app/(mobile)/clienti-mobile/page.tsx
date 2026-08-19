'use client';

/**
 * Le clienti, dal telefono.
 *
 * Quando si è fuori dal centro di una cliente servono tre cose: il numero per
 * chiamarla, quello che ha speso, e se c'è qualcosa da sapere prima di
 * parlarle — la corona, le disdette, la segnalazione. Il resto della scheda si
 * guarda dal computer.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Phone, MessageCircle, Crown, CalendarX, Frown, ChevronLeft, Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getClients } from '@/app/actions/clients';
import { getAppointments } from '@/app/actions/agenda';
import { clientiTop } from '@/app/actions/clientiTop';
import { chiaveNome, riassunto, type ClienteTop } from '@/lib/clientiTop';
import { clientiARischio, type ClienteARischio } from '@/app/actions/affidabilita';
import { clientiDifficili, type ClienteDifficile } from '@/app/actions/clientiDifficili';
import { riassuntoAffidabilita } from '@/lib/affidabilita';
import PromemoriaCliente from '@/components/PromemoriaCliente';
import { getInitials } from '@/lib/helpers';
import { NO_AUTOFILL } from '@/lib/noAutofill';
import type { Client, Appointment } from '@/types';

function euro(n: number) { return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }
/** Il numero come lo vuole WhatsApp: solo cifre, con il 39 davanti. */
function perWhatsApp(tel: string) {
  const n = (tel || '').replace(/\D/g, '');
  return n.startsWith('39') ? n : `39${n}`;
}

export default function ClientiMobilePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [idratato, setIdratato] = useState(false);
  const [clienti, setClienti] = useState<Client[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<Appointment[]>([]);
  const [top, setTop] = useState<ClienteTop[]>([]);
  const [rischi, setRischi] = useState<ClienteARischio[]>([]);
  const [segnalate, setSegnalate] = useState<ClienteDifficile[]>([]);
  const [cerca, setCerca] = useState('');
  const [apertaId, setApertaId] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);

  useEffect(() => {
    const stop = useAuthStore.persist.onFinishHydration(() => setIdratato(true));
    setIdratato(useAuthStore.persist.hasHydrated());
    return () => stop();
  }, []);
  useEffect(() => { if (idratato && !isAuthenticated) router.push('/login'); }, [idratato, isAuthenticated, router]);

  useEffect(() => {
    Promise.all([
      getClients(), getAppointments(),
      clientiTop().catch(() => []),
      clientiARischio().catch(() => []),
      clientiDifficili().catch(() => []),
    ])
      .then(([c, a, t, r, s]) => { setClienti(c as Client[]); setAppuntamenti(a); setTop(t); setRischi(r); setSegnalate(s); })
      .catch(() => {})
      .finally(() => setCaricando(false));
  }, []);

  const trovate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const lista = [...clienti].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    if (!q) return lista.slice(0, 40);
    return lista.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.phone || '').includes(q),
    ).slice(0, 60);
  }, [clienti, cerca]);

  const aperta = clienti.find(c => c.id === apertaId) || null;

  const segniDi = (c: Client) => ({
    corona: top.find(t => chiaveNome(t.nome) === chiaveNome(`${c.firstName} ${c.lastName}`)) || null,
    rischio: rischi.find(r => r.clientId === c.id) || null,
    segnalata: segnalate.find(s => s.clientId === c.id) || null,
  });

  if (!idratato || !isAuthenticated) return null;

  /* La scheda: si apre sopra l'elenco invece di cambiare pagina, così tornare
     indietro non fa ricaricare tutto. */
  if (aperta) {
    const { corona, rischio, segnalata } = segniDi(aperta);
    const suoi = appuntamenti
      .filter(a => a.clientId === aperta.id && a.status !== 'cancelled')
      .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
    const oggi = new Date().toISOString().slice(0, 10);
    const prossimo = suoi.filter(a => a.date >= oggi).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];
    const ultimo = suoi.find(a => a.date < oggi);

    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setApertaId(null)} className="p-2 -ml-2 rounded-xl active:bg-bg-tertiary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {getInitials(aperta.firstName, aperta.lastName)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-display font-bold truncate">{aperta.firstName} {aperta.lastName}</p>
            <p className="text-[11px] text-text-muted">{aperta.phone || 'nessun numero'}</p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Chiamare e scrivere: sono i due motivi per cui si apre una scheda
              dal telefono, quindi stanno prima di tutto il resto. */}
          <div className="grid grid-cols-2 gap-3">
            <a href={`tel:${aperta.phone}`}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-bg-secondary border border-border text-sm font-semibold">
              <Phone className="w-4 h-4 text-accent" /> Chiama
            </a>
            <a href={`https://wa.me/${perWhatsApp(aperta.phone)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500/10 border border-green-500/30 text-sm font-semibold text-green-400">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </div>

          {corona && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-warning/10 border border-warning/30">
              <Crown className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Fra le clienti che spendono di più</p>
                <p className="text-xs text-text-secondary">{riassunto(corona)} negli ultimi 12 mesi.</p>
              </div>
            </div>
          )}

          {rischio && (
            <div className={`flex items-start gap-2.5 p-3 rounded-2xl ${rischio.livello === 'rischio' ? 'bg-error/10 border border-error/30' : 'bg-warning/10 border border-warning/30'}`}>
              <CalendarX className={`w-4 h-4 flex-shrink-0 mt-0.5 ${rischio.livello === 'rischio' ? 'text-error' : 'text-warning'}`} />
              <div>
                <p className="text-sm font-semibold">{rischio.livello === 'rischio' ? 'Salta spesso gli appuntamenti' : 'Ha cominciato a saltare gli appuntamenti'}</p>
                <p className="text-xs text-text-secondary">{riassuntoAffidabilita(rischio)}</p>
              </div>
            </div>
          )}

          {segnalata && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-error/10 border border-error/30">
              <Frown className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Cliente segnalata</p>
                <p className="text-xs text-text-secondary">{segnalata.motivo}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {segnalata.segnalataDa ? `da ${segnalata.segnalataDa}` : ''} il {segnalata.quando.slice(8, 10)}/{segnalata.quando.slice(5, 7)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-bg-secondary border border-border">
              <p className="text-[11px] text-text-muted">Prossimo</p>
              <p className="text-sm font-semibold">
                {prossimo ? `${prossimo.date.slice(8, 10)}/${prossimo.date.slice(5, 7)} · ${prossimo.startTime}` : '—'}
              </p>
              {prossimo && <p className="text-[11px] text-text-muted truncate">{prossimo.treatmentName}</p>}
            </div>
            <div className="p-3 rounded-2xl bg-bg-secondary border border-border">
              <p className="text-[11px] text-text-muted">Ultima volta</p>
              <p className="text-sm font-semibold">
                {ultimo ? `${ultimo.date.slice(8, 10)}/${ultimo.date.slice(5, 7)}` : '—'}
              </p>
              {ultimo && <p className="text-[11px] text-text-muted truncate">{ultimo.treatmentName}</p>}
            </div>
          </div>

          {/* I promemoria si scrivono anche da qui: l'idea viene in mente
              quando si è fuori, non davanti al computer. */}
          <div className="p-3 rounded-2xl bg-bg-secondary border border-border">
            <PromemoriaCliente clientId={aperta.id} conStorico />
          </div>

          {aperta.notes && (
            <div className="p-3 rounded-2xl bg-bg-secondary border border-border">
              <p className="text-[11px] text-text-muted mb-1">Note</p>
              <p className="text-sm text-text-secondary">{aperta.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="sticky top-0 z-20 bg-bg-secondary/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-display font-bold">Clienti</h1>
          <span className="ml-auto text-xs text-text-muted">{clienti.length} in tutto</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={cerca} onChange={e => setCerca(e.target.value)} {...NO_AUTOFILL}
            placeholder="Nome o numero di telefono"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-bg-tertiary border border-border text-sm placeholder-text-muted" />
        </div>
      </div>

      <div className="p-4 space-y-2">
        {caricando && <p className="text-sm text-text-muted text-center py-8">Sto caricando…</p>}
        {!caricando && trovate.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Nessuna cliente con questo nome.</p>
        )}
        {trovate.map(c => {
          const { corona, rischio, segnalata } = segniDi(c);
          return (
            <button key={c.id} onClick={() => setApertaId(c.id)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-bg-secondary border border-border text-left active:bg-bg-tertiary">
              <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {getInitials(c.firstName, c.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {c.firstName} {c.lastName}
                  {corona && <Crown className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
                  {rischio && <CalendarX className={`w-3.5 h-3.5 flex-shrink-0 ${rischio.livello === 'rischio' ? 'text-error' : 'text-warning'}`} />}
                  {segnalata && <Frown className="w-3.5 h-3.5 text-error flex-shrink-0" />}
                  {segnalata?.motivo && (
                    <span className="text-[10px] text-error/90 font-normal truncate">({segnalata.motivo})</span>
                  )}
                </p>
                <p className="text-[11px] text-text-muted">{c.phone || 'nessun numero'}</p>
              </div>
              {corona && <span className="text-[11px] text-warning flex-shrink-0">{euro(corona.speso)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
