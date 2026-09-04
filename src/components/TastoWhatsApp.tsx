'use client';

/**
 * WhatsApp in alto, accanto alla chat dell'app e al trillo.
 *
 * Stava nella colonna di sinistra, dodicesima voce su venti: per accorgersi
 * che una cliente aveva scritto bisognava avere l'occhio nel posto giusto
 * mentre si guardava l'agenda — cioe' quasi mai.
 *
 * Qui sta accanto alle altre due cose che si fanno cento volte al giorno,
 * ed e' l'unica delle tre che puo' avere qualcuno che aspetta: il numerino
 * compare appena arriva un messaggio, il verde lampeggia solo quando c'e'
 * qualcuno che aspetta da piu' di dieci minuti. Sono due informazioni
 * diverse e servono tutte e due.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useWaInboxStore } from '@/stores/useWaInboxStore';

export default function TastoWhatsApp() {
  const pathname = usePathname();
  const daLeggere = useWaInboxStore(s => s.chats.length);
  const inAttesa = useWaInboxStore(s => s.inAttesa);
  const qui = pathname?.startsWith('/dashboard/whatsapp');

  return (
    <Link href="/dashboard/whatsapp" title="WhatsApp" aria-label="Apri WhatsApp"
      className={`relative p-2 rounded-xl transition-colors flex-shrink-0 ${
        qui ? 'bg-accent/10 text-accent'
          : inAttesa > 0 ? 'text-success animate-pulse'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}>
      <MessageCircle className="w-5 h-5" />
      {daLeggere > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
          inAttesa > 0 ? 'bg-error text-white' : 'bg-success text-white'}`}>
          {daLeggere > 9 ? '9+' : daLeggere}
        </span>
      )}
    </Link>
  );
}
