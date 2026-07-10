'use client';

import React, { useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteInaugurationLead } from './actions';

export default function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (pending) return;
    if (!window.confirm(`Eliminare definitivamente il contatto "${name}"?`)) return;
    startTransition(async () => {
      await deleteInaugurationLead(id);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Elimina contatto"
      aria-label={`Elimina ${name}`}
      className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
