'use client';

/**
 * I reclami anonimi delle clienti. Non c'è un mittente da mostrare:
 * è il punto — si legge il problema, non si cerca il colpevole di averlo detto.
 */

import { useCallback, useEffect, useState } from 'react';

interface Reclamo {
  id: string;
  categoria: string;
  testo: string;
  letto: boolean;
  createdAt: string;
}

const ETICHETTE: Record<string, string> = {
  servizio: 'Servizio ricevuto',
  personale: 'Personale',
  ambiente: 'Pulizia e ambiente',
  prezzi: 'Prezzi',
  app: "L'app",
  altro: 'Altro',
};

export default function ReclamiPage() {
  const [reclami, setReclami] = useState<Reclamo[]>([]);

  const carica = useCallback(async () => {
    const r = await fetch('/api/admin/reclami').then(r => r.json()).catch(() => null);
    if (r?.reclami) setReclami(r.reclami);
  }, []);
  useEffect(() => { void carica(); }, [carica]);

  const segnaLetto = async (id: string) => {
    await fetch('/api/admin/reclami', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    void carica();
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Reclami anonimi</h1>
      <p className="text-sm text-gray-500 mb-6">
        Arrivano dall&apos;app, senza mittente: nel database non c&apos;è scritto chi li manda.
        Sono un regalo — le clienti che non dicono niente, semplicemente non tornano.
      </p>

      <div className="space-y-3">
        {reclami.map(r => (
          <div key={r.id} className={`rounded-xl border bg-white p-4 ${r.letto ? 'opacity-60' : 'border-amber-300'}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100">
                {ETICHETTE[r.categoria] ?? r.categoria}
              </span>
              <span className="text-xs text-gray-400">{r.createdAt.slice(0, 10)}</span>
              {!r.letto && (
                <button onClick={() => void segnaLetto(r.id)} className="ml-auto text-xs text-gray-600 underline">
                  Segna letto
                </button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.testo}</p>
          </div>
        ))}
        {reclami.length === 0 ? (
          <p className="text-sm text-gray-400">Nessun reclamo. O va tutto bene, o l&apos;app è appena nata.</p>
        ) : null}
      </div>
    </div>
  );
}
