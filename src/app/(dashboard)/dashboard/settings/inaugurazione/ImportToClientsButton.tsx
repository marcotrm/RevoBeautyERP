'use client';

import React, { useState, useTransition } from 'react';
import { UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { importInaugurationLeadsToClients } from './actions';

export default function ImportToClientsButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const handleClick = () => {
    if (pending) return;
    startTransition(async () => {
      const res = await importInaugurationLeadsToClients();
      if (res.ok) {
        setResult(res.created > 0 ? `${res.created} nuovi clienti aggiunti` : 'Già tutti in anagrafica');
        setTimeout(() => setResult(null), 4000);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-success font-medium">{result}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : result ? <CheckCircle2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
        Aggiungi a Clienti
      </button>
    </div>
  );
}
