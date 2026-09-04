'use client';

/**
 * Le istruzioni pre-appuntamento, trattamento per trattamento.
 *
 * Si scrivono una volta sul trattamento e da lì in poi ogni appuntamento
 * (anche futuro) le mostra da solo nell'app, e il promemoria parte con
 * l'anticipo scelto. Campi vuoti = nessuna preparazione, nessun avviso.
 */

import { useCallback, useEffect, useState } from 'react';

interface Preparazione {
  comePrepararsi: string; cosaEvitare: string; cosaPortare: string;
  oreAnticipo: number; avvertenze: string;
}
interface Trattamento { id: string; nome: string; categoria: string; preparazione: Preparazione | null }

const VUOTA: Preparazione = { comePrepararsi: '', cosaEvitare: '', cosaPortare: '', oreAnticipo: 24, avvertenze: '' };

export default function PreparazioniPage() {
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [q, setQ] = useState('');
  const [aperto, setAperto] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Preparazione>(VUOTA);
  const [salvato, setSalvato] = useState('');

  const carica = useCallback(async () => {
    const r = await fetch('/api/admin/preparazioni').then((r) => r.json()).catch(() => null);
    if (r?.trattamenti) setTrattamenti(r.trattamenti);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const filtrati = trattamenti.filter((t) =>
    `${t.nome} ${t.categoria}`.toLowerCase().includes(q.toLowerCase())
  );

  const apri = (t: Trattamento) => {
    setAperto(t.id);
    setBozza(t.preparazione ?? VUOTA);
    setSalvato('');
  };

  const salva = async (id: string, dati: Preparazione | null) => {
    await fetch('/api/admin/preparazioni', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, preparazione: dati ?? {} }),
    });
    setSalvato(id);
    await carica();
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Preparazione ai trattamenti</h1>
      <p className="text-sm text-gray-500 mb-4">
        Cosa deve sapere la cliente prima di venire: compare nella scheda dell&apos;appuntamento
        e in un promemoria con l&apos;anticipo che scegli. Un avviso solo, mai pubblicità.
      </p>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca trattamento…"
        className="w-full border rounded-lg px-3 py-2 mb-4 text-sm" />

      <div className="space-y-1">
        {filtrati.map((t) => (
          <div key={t.id} className="rounded-xl border bg-white">
            <button className="w-full text-left p-3 flex items-center gap-2" onClick={() => (aperto === t.id ? setAperto(null) : apri(t))}>
              <span className="flex-1 text-sm">{t.nome} <span className="text-gray-400">· {t.categoria}</span></span>
              {t.preparazione && <span className="text-xs bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">istruzioni attive · avviso {t.preparazione.oreAnticipo}h prima</span>}
              <span className="text-gray-400">{aperto === t.id ? '▾' : '▸'}</span>
            </button>
            {aperto === t.id && (
              <div className="border-t p-3 space-y-2">
                <textarea value={bozza.comePrepararsi} onChange={(e) => setBozza((b) => ({ ...b, comePrepararsi: e.target.value }))}
                  placeholder="Come prepararsi (es. arriva con la pelle pulita, bevi molta acqua…)" rows={2}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                <textarea value={bozza.cosaEvitare} onChange={(e) => setBozza((b) => ({ ...b, cosaEvitare: e.target.value }))}
                  placeholder="Cosa evitare (es. sole e lampade nelle 48h, creme profumate…)" rows={2}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                <input value={bozza.cosaPortare} onChange={(e) => setBozza((b) => ({ ...b, cosaPortare: e.target.value }))}
                  placeholder="Cosa portare (es. biancheria comoda…)"
                  className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                <textarea value={bozza.avvertenze} onChange={(e) => setBozza((b) => ({ ...b, avvertenze: e.target.value }))}
                  placeholder="Avvertenze (es. in caso di febbre o terapie in corso, avvisaci prima)" rows={2}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  Promemoria
                  <input type="number" min={0} max={168} value={bozza.oreAnticipo}
                    onChange={(e) => setBozza((b) => ({ ...b, oreAnticipo: Number(e.target.value) }))}
                    className="w-20 border rounded-lg px-2 py-1 text-sm text-right" />
                  ore prima (0 = nessun promemoria dedicato)
                </label>
                <div className="flex gap-2 items-center">
                  <button onClick={() => void salva(t.id, bozza)} className="text-sm bg-black text-white rounded-lg px-3 py-1.5">Salva</button>
                  {t.preparazione && (
                    <button onClick={() => { if (confirm('Togliere le istruzioni da questo trattamento?')) void salva(t.id, null); }}
                      className="text-sm text-red-600">Rimuovi</button>
                  )}
                  {salvato === t.id && <span className="text-xs text-emerald-600">Salvato ✓</span>}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtrati.length === 0 && <p className="text-sm text-gray-400">Nessun trattamento trovato.</p>}
      </div>
    </div>
  );
}
