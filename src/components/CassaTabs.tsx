'use client';

/**
 * Schede della sezione Cassa.
 *
 * Nel menu c'è una voce sola ("Cassa"): vendite e cassetto contanti restano due
 * schermate diverse, ma si passa dall'una all'altra da qui invece di cercarle
 * in due voci di menu separate.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Banknote } from 'lucide-react';

const TABS = [
  { href: '/dashboard/pos', label: 'Vendite', icon: ShoppingBag },
  { href: '/dashboard/cassa-contanti', label: 'Contanti', icon: Banknote },
];

export default function CassaTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 p-1 rounded-2xl bg-bg-secondary border border-border w-fit">
      {TABS.map(t => {
        const attiva = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link key={t.href} href={t.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              attiva ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'
            }`}>
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
