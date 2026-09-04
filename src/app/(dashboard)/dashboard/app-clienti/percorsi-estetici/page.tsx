'use client';

/**
 * Il banco di lavoro dei percorsi estetici: consulenze in arrivo, check-up
 * da verificare, percorsi con sedute e foto, coda di riattivazione.
 *
 * Tutto in una pagina a schede perché è UN flusso: la consulenza diventa
 * percorso, il percorso accumula sedute, chi si ferma finisce in coda.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

// ------------------------------------------------------------
// Tipi (specchiano le API admin)
// ------------------------------------------------------------

interface Seduta {
  id: string; numero: number; data: string; ora: string | null; operatrice: string;
  trattamento: string; area: string | null; durataMinuti: number | null;
  osservazioni: string | null; rispostaCliente: string | null;
  misurazioni: { nome: string; valore: string; unita: string }[] | null;
  indicazioniDopo: string | null; noteInterne: string | null;
  condivisa: boolean; statoControllo: string | null;
}
interface Foto { id: string; area: string; scattataIl: string; origine: string; sedutaId: string | null; immagine: string }
interface Percorso {
  id: string; clientId: string; clientName: string; nome: string; descrizione: string | null;
  obiettivo: string; trattamenti: { nome: string }[]; seduteTotali: number; frequenza: string | null;
  dataInizio: string; stato: string; tappe: { titolo: string; dopoSeduta: number }[] | null;
  noteCliente: string | null; noteInterne: string | null; mantenimento: string | null;
  creatoDa: string; sedute: Seduta[]; foto: Foto[];
}
interface Consulenza {
  id: string; clientId: string; clientName: string; aree: string[]; desiderio: string;
  stato: string; presaDa: string | null; percorsoId: string | null; createdAt: string;
}
interface Checkup {
  id: string; clientId: string; nome: string; telefono: string; daValutare: boolean;
  risposte: { obiettivi?: string[]; aree?: string[]; abitudini?: string[]; condizioni?: string[];
    trattamentiPrecedenti?: string; preferenze?: string; note?: string };
  verificatoDa: string | null; verificatoIl: string | null; noteInterne: string | null; createdAt: string;
}
interface Proposta {
  id: string; clientId: string; nome: string; motivo: string; dettaglio: string;
  messaggio: string; stato: string; canale: string | null; inviataIl: string | null; createdAt: string;
}

const STATI_PERCORSO: Record<string, string> = {
  attivo: '🟢 Attivo', in_pausa: '⏸️ In pausa', completato: '✅ Completato',
  mantenimento: '🌿 Mantenimento', interrotto: '⛔ Interrotto',
};

async function comprimiFoto(file: File): Promise<string> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const MAX = 900;
  const scala = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(img.height * scala);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', 0.7);
}

const invia = (url: string, body: object) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Errore'); return j; });

export default function PercorsiEsteticiPage() {
  const user = useAuthStore((s) => s.user);
  const operatrice = user ? `${user.firstName} ${user.lastName}`.trim() : 'centro';

  const [scheda, setScheda] = useState<'percorsi' | 'consulenze' | 'checkup' | 'riattivazione'>('percorsi');
  const [percorsi, setPercorsi] = useState<Percorso[]>([]);
  const [consulenze, setConsulenze] = useState<Consulenza[]>([]);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [proposte, setProposte] = useState<Proposta[]>([]);
  const [errore, setErrore] = useState('');

  const carica = useCallback(async () => {
    const [p, c, k, r] = await Promise.all([
      fetch('/api/admin/percorsi-estetici').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/consulenze-app').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/checkups-estetici').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/riattivazione').then((r) => r.json()).catch(() => null),
    ]);
    if (p?.percorsi) setPercorsi(p.percorsi);
    if (c?.consulenze) setConsulenze(c.consulenze);
    if (k?.checkups) setCheckups(k.checkups);
    if (r?.proposte) setProposte(r.proposte);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const azione = async (fn: () => Promise<unknown>) => {
    setErrore('');
    try { await fn(); await carica(); }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Errore'); }
  };

  const nConsulenze = consulenze.filter((c) => c.stato === 'nuova').length;
  const nCheckup = checkups.filter((c) => !c.verificatoIl).length;
  const nProposte = proposte.filter((p) => p.stato === 'proposta').length;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Percorsi estetici</h1>
      <p className="text-sm text-gray-500 mb-4">
        Dalla consulenza al percorso, seduta dopo seduta. Le note interne restano qui: la cliente vede solo ciò che è condiviso.
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ['percorsi', `Percorsi (${percorsi.length})`],
          ['consulenze', `Consulenze${nConsulenze ? ` · ${nConsulenze} nuove` : ''}`],
          ['checkup', `Check-up${nCheckup ? ` · ${nCheckup} da verificare` : ''}`],
          ['riattivazione', `Riattivazione${nProposte ? ` · ${nProposte}` : ''}`],
        ] as const).map(([id, testo]) => (
          <button key={id} onClick={() => setScheda(id)}
            className={`text-sm rounded-lg px-3 py-1.5 border ${scheda === id ? 'bg-black text-white border-black' : 'bg-white'}`}>
            {testo}
          </button>
        ))}
      </div>

      {errore && <p className="text-sm text-red-600 mb-4">{errore}</p>}

      {scheda === 'percorsi' && (
        <SchedaPercorsi percorsi={percorsi} operatrice={operatrice} azione={azione} />
      )}
      {scheda === 'consulenze' && (
        <SchedaConsulenze consulenze={consulenze} percorsi={percorsi} operatrice={operatrice} azione={azione} />
      )}
      {scheda === 'checkup' && (
        <SchedaCheckup checkups={checkups} operatrice={operatrice} azione={azione} />
      )}
      {scheda === 'riattivazione' && (
        <SchedaRiattivazione proposte={proposte} operatrice={operatrice} azione={azione} ricarica={carica} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Percorsi: creazione, sedute, foto
// ------------------------------------------------------------

function SchedaPercorsi({ percorsi, operatrice, azione }: {
  percorsi: Percorso[]; operatrice: string;
  azione: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [nuovo, setNuovo] = useState(false);
  const [aperto, setAperto] = useState<string | null>(null);

  return (
    <div>
      <button onClick={() => setNuovo(!nuovo)} className="text-sm bg-black text-white rounded-lg px-3 py-1.5 mb-4">
        {nuovo ? 'Chiudi' : '+ Nuovo percorso'}
      </button>
      {nuovo && <NuovoPercorso operatrice={operatrice} azione={azione} chiudi={() => setNuovo(false)} />}

      <div className="space-y-2">
        {percorsi.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white">
            <button className="w-full text-left p-3 flex items-center gap-3"
              onClick={() => setAperto(aperto === p.id ? null : p.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.clientName} — {p.nome}</p>
                <p className="text-xs text-gray-500">
                  {STATI_PERCORSO[p.stato] ?? p.stato} · {p.sedute.length}/{p.seduteTotali} sedute · dal {p.dataInizio}
                </p>
              </div>
              <span className="text-gray-400">{aperto === p.id ? '▾' : '▸'}</span>
            </button>
            {aperto === p.id && <DettaglioPercorso p={p} operatrice={operatrice} azione={azione} />}
          </div>
        ))}
        {percorsi.length === 0 && <p className="text-sm text-gray-400">Nessun percorso ancora: crea il primo.</p>}
      </div>
    </div>
  );
}

function NuovoPercorso({ operatrice, azione, chiudi }: {
  operatrice: string; azione: (fn: () => Promise<unknown>) => Promise<void>; chiudi: () => void;
}) {
  const [q, setQ] = useState('');
  const [clienti, setClienti] = useState<{ id: string; nome: string; telefono: string }[]>([]);
  const [cliente, setCliente] = useState<{ id: string; nome: string } | null>(null);
  const [dati, setDati] = useState({
    nome: '', obiettivo: '', descrizione: '', seduteTotali: '8', frequenza: '',
    dataInizio: new Date().toISOString().slice(0, 10), trattamenti: '', tappe: '',
    noteCliente: '', noteInterne: '', mantenimento: '',
  });

  useEffect(() => {
    if (cliente) return;
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setClienti([]); return; }
      const r = await fetch(`/api/admin/percorsi-estetici?clienti=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => null);
      setClienti(r?.clienti ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, cliente]);

  const campo = (k: keyof typeof dati, extra?: object) => ({
    value: dati[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDati((d) => ({ ...d, [k]: e.target.value })),
    className: 'w-full border rounded-lg px-3 py-2 text-sm',
    ...extra,
  });

  return (
    <div className="rounded-xl border bg-gray-50 p-4 mb-4 space-y-3">
      {!cliente ? (
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca la cliente (nome o telefono)…"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          {clienti.map((c) => (
            <button key={c.id} onClick={() => setCliente(c)}
              className="block w-full text-left text-sm px-3 py-2 hover:bg-white rounded-lg">
              {c.nome} · {c.telefono}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm font-medium">Percorso per <b>{cliente.nome}</b>{' '}
          <button onClick={() => setCliente(null)} className="text-xs text-gray-500 underline">cambia</button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <input {...campo('nome')} placeholder="Nome del percorso *" />
        <input {...campo('obiettivo')} placeholder="Obiettivo concordato *" />
        <input {...campo('seduteTotali')} placeholder="Sedute previste *" type="number" min={1} />
        <input {...campo('frequenza')} placeholder="Frequenza (es. ogni 7-10 giorni)" />
        <input {...campo('dataInizio')} type="date" />
        <input {...campo('trattamenti')} placeholder="Trattamenti previsti (separati da virgola)" />
      </div>
      <textarea {...campo('descrizione')} placeholder="Descrizione (visibile alla cliente)" rows={2} />
      <input {...campo('tappe')} placeholder="Tappe: titolo@seduta, es. Prima valutazione@3, Metà percorso@6" />
      <textarea {...campo('noteCliente')} placeholder="Note visibili alla cliente" rows={2} />
      <textarea {...campo('noteInterne')} placeholder="Note interne (solo staff)" rows={2} className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm" />
      <input {...campo('mantenimento')} placeholder="Piano di mantenimento (es. 1 seduta al mese)" />

      <button
        disabled={!cliente || !dati.nome || !dati.obiettivo}
        onClick={() => void azione(async () => {
          await invia('/api/admin/percorsi-estetici', {
            azione: 'crea', operatrice, clientId: cliente!.id,
            nome: dati.nome, obiettivo: dati.obiettivo, descrizione: dati.descrizione,
            seduteTotali: Number(dati.seduteTotali), frequenza: dati.frequenza, dataInizio: dati.dataInizio,
            trattamenti: dati.trattamenti.split(',').map((t) => ({ nome: t.trim() })).filter((t) => t.nome),
            tappe: dati.tappe.split(',').map((t) => {
              const [titolo, dopo] = t.split('@');
              return { titolo: (titolo ?? '').trim(), dopoSeduta: Number(dopo) || 1 };
            }).filter((t) => t.titolo),
            noteCliente: dati.noteCliente, noteInterne: dati.noteInterne, mantenimento: dati.mantenimento,
          });
          chiudi();
        })}
        className="text-sm bg-black text-white rounded-lg px-4 py-2 disabled:opacity-40">
        Crea percorso
      </button>
    </div>
  );
}

function DettaglioPercorso({ p, operatrice, azione }: {
  p: Percorso; operatrice: string; azione: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [seduta, setSeduta] = useState(false);

  return (
    <div className="border-t p-3 space-y-4">
      <div className="text-sm space-y-1">
        <p><b>Obiettivo:</b> {p.obiettivo}</p>
        {p.frequenza && <p><b>Frequenza:</b> {p.frequenza}</p>}
        {p.mantenimento && <p><b>Mantenimento:</b> {p.mantenimento}</p>}
        {p.noteCliente && <p><b>Note per la cliente:</b> {p.noteCliente}</p>}
        {p.noteInterne && <p className="text-amber-700 bg-amber-50 rounded px-2 py-1"><b>Interne:</b> {p.noteInterne}</p>}
        {(p.tappe?.length ?? 0) > 0 && (
          <p><b>Tappe:</b> {p.tappe!.map((t) => `${t.titolo} (dopo ${t.dopoSeduta}ª)${p.sedute.length >= t.dopoSeduta ? ' ✓' : ''}`).join(' · ')}</p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(STATI_PERCORSO).map((s) => (
          <button key={s} disabled={p.stato === s}
            onClick={() => void azione(() => invia('/api/admin/percorsi-estetici', { azione: 'aggiorna', operatrice, id: p.id, stato: s }))}
            className={`text-xs rounded-lg px-2 py-1 border ${p.stato === s ? 'bg-black text-white' : 'bg-white'}`}>
            {STATI_PERCORSO[s]}
          </button>
        ))}
      </div>

      {/* ── Sedute ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Sedute ({p.sedute.length}/{p.seduteTotali})</h3>
          <button onClick={() => setSeduta(!seduta)} className="text-xs bg-black text-white rounded-lg px-2 py-1">
            {seduta ? 'Chiudi' : '+ Registra seduta'}
          </button>
        </div>
        {seduta && <FormSeduta percorsoId={p.id} operatrice={operatrice} azione={azione} chiudi={() => setSeduta(false)} />}
        <div className="space-y-1">
          {p.sedute.map((s) => (
            <div key={s.id} className="text-xs bg-gray-50 rounded-lg p-2">
              <p className="font-medium">
                #{s.numero} · {s.data}{s.ora ? ` ${s.ora}` : ''} · {s.trattamento}{s.area ? ` (${s.area})` : ''} · {s.operatrice}
                {!s.condivisa && <span className="text-amber-600"> · non condivisa</span>}
                {s.statoControllo && <span> · controllo: {s.statoControllo.replace('_', ' ')}</span>}
              </p>
              {s.osservazioni && <p>Osservazioni: {s.osservazioni}</p>}
              {s.rispostaCliente && <p>Risposta cliente: {s.rispostaCliente}</p>}
              {(s.misurazioni?.length ?? 0) > 0 && (
                <p>Misure: {s.misurazioni!.map((m) => `${m.nome} ${m.valore}${m.unita}`).join(' · ')}</p>
              )}
              {s.indicazioniDopo && <p>Indicazioni: {s.indicazioniDopo}</p>}
              {s.noteInterne && <p className="text-amber-700">Interne: {s.noteInterne}</p>}
            </div>
          ))}
          {p.sedute.length === 0 && <p className="text-xs text-gray-400">Nessuna seduta registrata.</p>}
        </div>
      </div>

      {/* ── Foto ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Foto ({p.foto.length})</h3>
          <label className="text-xs bg-black text-white rounded-lg px-2 py-1 cursor-pointer">
            + Carica foto
            <input type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const area = prompt('Area fotografata (es. Addome):') || 'Area trattata';
                const immagine = await comprimiFoto(f);
                void azione(() => invia('/api/admin/percorsi-estetici', { azione: 'fotoCarica', operatrice, percorsoId: p.id, area, immagine }));
                e.target.value = '';
              }} />
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          {p.foto.map((f) => (
            <div key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.immagine} alt={f.area} className="h-24 w-24 object-cover rounded-lg border" />
              <p className="text-[10px] text-gray-500 text-center">{f.area} · {f.scattataIl}</p>
              <button
                onClick={() => { if (confirm('Eliminare questa foto?')) void azione(() => invia('/api/admin/percorsi-estetici', { azione: 'fotoElimina', operatrice, id: f.id })); }}
                className="absolute top-0 right-0 bg-white/90 rounded-bl-lg px-1 text-red-600 text-xs">✕</button>
            </div>
          ))}
          {p.foto.length === 0 && (
            <p className="text-xs text-gray-400">
              Nessuna foto. Serve il consenso della cliente (lo dà dall&apos;app, nei suoi consensi).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FormSeduta({ percorsoId, operatrice, azione, chiudi }: {
  percorsoId: string; operatrice: string;
  azione: (fn: () => Promise<unknown>) => Promise<void>; chiudi: () => void;
}) {
  const [d, setD] = useState({
    data: new Date().toISOString().slice(0, 10), oraSeduta: '', trattamento: '', area: '',
    durataMinuti: '', osservazioni: '', rispostaCliente: '', misure: '',
    indicazioniDopo: '', noteInterne: '', condivisa: true, statoControllo: '',
  });
  const campo = (k: keyof typeof d, extra?: object) => ({
    value: String(d[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value })),
    className: 'w-full border rounded-lg px-2 py-1.5 text-xs',
    ...extra,
  });

  return (
    <div className="rounded-lg border bg-gray-50 p-3 mb-2 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <input {...campo('data')} type="date" />
        <input {...campo('oraSeduta')} placeholder="Ora (es. 15:30)" />
        <input {...campo('durataMinuti')} placeholder="Durata (min)" type="number" />
        <input {...campo('trattamento')} placeholder="Trattamento / tecnologia *" className="col-span-2 w-full border rounded-lg px-2 py-1.5 text-xs" />
        <input {...campo('area')} placeholder="Area trattata" />
      </div>
      <textarea {...campo('osservazioni')} placeholder="Osservazioni professionali (condivise se la seduta è condivisa)" rows={2} />
      <input {...campo('rispostaCliente')} placeholder="Risposta percepita/comunicata dalla cliente" />
      <input {...campo('misure')} placeholder="Misure a mano: nome valore unità; es. Giro vita 78 cm; Plica 12 mm" />
      <input {...campo('indicazioniDopo')} placeholder="Indicazioni per il dopo (visibili alla cliente)" />
      <textarea {...campo('noteInterne')} placeholder="Note interne (solo staff)" rows={2} className="w-full border border-amber-300 bg-amber-50 rounded-lg px-2 py-1.5 text-xs" />
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={d.condivisa} onChange={(e) => setD((x) => ({ ...x, condivisa: e.target.checked }))} />
          Condivisa con la cliente
        </label>
        <select {...campo('statoControllo')} className="border rounded-lg px-2 py-1 text-xs w-auto">
          <option value="">Controllo successivo…</option>
          <option value="da_fissare">Da fissare</option>
          <option value="fissato">Fissato</option>
          <option value="fatto">Fatto</option>
        </select>
      </div>
      <button
        disabled={!d.trattamento}
        onClick={() => void azione(async () => {
          await invia('/api/admin/percorsi-estetici', {
            azione: 'seduta', operatrice, percorsoId,
            data: d.data, oraSeduta: d.oraSeduta, trattamento: d.trattamento, area: d.area,
            durataMinuti: d.durataMinuti ? Number(d.durataMinuti) : null,
            osservazioni: d.osservazioni, rispostaCliente: d.rispostaCliente,
            misurazioni: d.misure.split(';').map((m) => {
              const parti = m.trim().split(/\s+/);
              if (parti.length < 2) return null;
              const unita = parti.length > 2 ? parti[parti.length - 1] : '';
              const valore = unita ? parti[parti.length - 2] : parti[parti.length - 1];
              const nome = parti.slice(0, unita ? -2 : -1).join(' ');
              return { nome, valore, unita };
            }).filter(Boolean),
            indicazioniDopo: d.indicazioniDopo, noteInterne: d.noteInterne,
            condivisa: d.condivisa, statoControllo: d.statoControllo || null,
          });
          chiudi();
        })}
        className="text-xs bg-black text-white rounded-lg px-3 py-1.5 disabled:opacity-40">
        Salva seduta
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// Consulenze
// ------------------------------------------------------------

function SchedaConsulenze({ consulenze, percorsi, operatrice, azione }: {
  consulenze: Consulenza[]; percorsi: Percorso[]; operatrice: string;
  azione: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const STATI: Record<string, string> = {
    nuova: '🆕 Nuova', in_carico: '👩‍💼 In carico', trasformata: '✨ Trasformata', chiusa: 'Chiusa',
  };
  return (
    <div className="space-y-2">
      {consulenze.map((c) => {
        const suoiPercorsi = percorsi.filter((p) => p.clientId === c.clientId);
        return (
          <div key={c.id} className="rounded-xl border bg-white p-3">
            <p className="text-sm font-semibold">{c.clientName} <span className="font-normal text-gray-500">· {STATI[c.stato] ?? c.stato} · {c.createdAt.slice(0, 10)}</span></p>
            <p className="text-sm mt-1"><b>Vorrebbe migliorare:</b> {(c.aree ?? []).join(', ')}</p>
            {c.desiderio && <p className="text-sm text-gray-600 mt-1">«{c.desiderio}»</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              {c.stato === 'nuova' && (
                <button onClick={() => void azione(() => invia('/api/admin/consulenze-app', { azione: 'prendi', operatrice, id: c.id }))}
                  className="text-xs bg-black text-white rounded-lg px-2 py-1">Prendi in carico</button>
              )}
              {['nuova', 'in_carico'].includes(c.stato) && suoiPercorsi.length > 0 && (
                <select className="text-xs border rounded-lg px-2 py-1" defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void azione(() => invia('/api/admin/consulenze-app', { azione: 'trasforma', operatrice, id: c.id, percorsoId: e.target.value }));
                  }}>
                  <option value="">Collega a un percorso…</option>
                  {suoiPercorsi.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              )}
              {['nuova', 'in_carico'].includes(c.stato) && (
                <button onClick={() => void azione(() => invia('/api/admin/consulenze-app', { azione: 'chiudi', operatrice, id: c.id }))}
                  className="text-xs text-gray-500">Chiudi senza percorso</button>
              )}
            </div>
            {c.stato === 'in_carico' && suoiPercorsi.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">Per trasformarla, crea prima il percorso nella scheda Percorsi.</p>
            )}
          </div>
        );
      })}
      {consulenze.length === 0 && <p className="text-sm text-gray-400">Nessuna richiesta di consulenza dall&apos;app.</p>}
    </div>
  );
}

// ------------------------------------------------------------
// Check-up
// ------------------------------------------------------------

function SchedaCheckup({ checkups, operatrice, azione }: {
  checkups: Checkup[]; operatrice: string;
  azione: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  return (
    <div className="space-y-2">
      {checkups.map((c) => (
        <div key={c.id} className={`rounded-xl border bg-white p-3 ${c.daValutare && !c.verificatoIl ? 'border-amber-400' : ''}`}>
          <p className="text-sm font-semibold">
            {c.nome} <span className="font-normal text-gray-500">· {c.telefono} · {c.createdAt.slice(0, 10)}</span>
            {c.daValutare && <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">⚠️ da valutare</span>}
            {c.verificatoIl && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">✓ verificato da {c.verificatoDa}</span>}
          </p>
          <div className="text-xs text-gray-700 mt-2 space-y-0.5">
            {(c.risposte.obiettivi?.length ?? 0) > 0 && <p><b>Obiettivi:</b> {c.risposte.obiettivi!.join(', ')}</p>}
            {(c.risposte.aree?.length ?? 0) > 0 && <p><b>Aree:</b> {c.risposte.aree!.join(', ')}</p>}
            {(c.risposte.abitudini?.length ?? 0) > 0 && <p><b>Abitudini:</b> {c.risposte.abitudini!.join(', ')}</p>}
            {(c.risposte.condizioni?.length ?? 0) > 0 && <p className="text-amber-700"><b>Condizioni segnalate:</b> {c.risposte.condizioni!.join(', ')}</p>}
            {c.risposte.trattamentiPrecedenti && <p><b>Trattamenti precedenti:</b> {c.risposte.trattamentiPrecedenti}</p>}
            {c.risposte.preferenze && <p><b>Preferenze:</b> {c.risposte.preferenze}</p>}
            {c.risposte.note && <p><b>Note della cliente:</b> {c.risposte.note}</p>}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={note[c.id] ?? c.noteInterne ?? ''} onChange={(e) => setNote((n) => ({ ...n, [c.id]: e.target.value }))}
              placeholder="Note interne…" className="flex-1 border rounded-lg px-2 py-1 text-xs" />
            <button
              onClick={() => void azione(() => invia('/api/admin/checkups-estetici', {
                id: c.id, operatrice, noteInterne: note[c.id] ?? c.noteInterne ?? '', verificato: true,
              }))}
              className="text-xs bg-black text-white rounded-lg px-2 py-1">
              {c.verificatoIl ? 'Aggiorna note' : 'Segna verificato'}
            </button>
          </div>
        </div>
      ))}
      {checkups.length === 0 && <p className="text-sm text-gray-400">Nessun check-up compilato dall&apos;app.</p>}
    </div>
  );
}

// ------------------------------------------------------------
// Riattivazione
// ------------------------------------------------------------

function SchedaRiattivazione({ proposte, operatrice, azione, ricarica }: {
  proposte: Proposta[]; operatrice: string;
  azione: (fn: () => Promise<unknown>) => Promise<void>; ricarica: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<Record<string, string>>({});
  const MOTIVI: Record<string, string> = {
    'ritmo-interrotto': '⏱️ Ritmo interrotto', 'percorso-interrotto': '🛑 Percorso a metà', 'mantenimento': '🌿 Mantenimento mai partito',
  };
  const aperte = proposte.filter((p) => p.stato === 'proposta');
  const decise = proposte.filter((p) => p.stato !== 'proposta').slice(0, 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          Il sistema propone, tu decidi: nessun messaggio parte da solo. Le clienti che hanno disattivato i promemoria non compaiono.
        </p>
        <button
          onClick={() => void azione(async () => { await fetch('/api/admin/riattivazione?rigenera=1'); await ricarica(); })}
          className="text-xs bg-black text-white rounded-lg px-3 py-1.5 shrink-0">↻ Rigenera lista</button>
      </div>

      <div className="space-y-2">
        {aperte.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-3">
            <p className="text-sm font-semibold">{p.nome} <span className="font-normal text-gray-500">· {MOTIVI[p.motivo] ?? p.motivo}</span></p>
            <p className="text-xs text-gray-500">{p.dettaglio}</p>
            <textarea
              value={msg[p.id] ?? p.messaggio}
              onChange={(e) => setMsg((m) => ({ ...m, [p.id]: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-2 py-1.5 text-xs mt-2" />
            <div className="flex gap-2 mt-1">
              <button onClick={() => void azione(() => invia('/api/admin/riattivazione', { azione: 'invia', operatrice, id: p.id, messaggio: msg[p.id] ?? p.messaggio }))}
                className="text-xs bg-black text-white rounded-lg px-3 py-1.5">Approva e invia (push app)</button>
              <button onClick={() => navigator.clipboard.writeText(msg[p.id] ?? p.messaggio)}
                className="text-xs border rounded-lg px-3 py-1.5">Copia per WhatsApp</button>
              <button onClick={() => void azione(() => invia('/api/admin/riattivazione', { azione: 'scarta', operatrice, id: p.id }))}
                className="text-xs text-red-600">Scarta</button>
            </div>
          </div>
        ))}
        {aperte.length === 0 && <p className="text-sm text-gray-400">Coda vuota: prova «Rigenera lista».</p>}
      </div>

      {decise.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Storico</h3>
          {decise.map((p) => (
            <p key={p.id} className="text-xs text-gray-500">
              {p.nome} · {MOTIVI[p.motivo] ?? p.motivo} · {p.stato}{p.inviataIl ? ` il ${p.inviataIl.slice(0, 10)} via ${p.canale}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
