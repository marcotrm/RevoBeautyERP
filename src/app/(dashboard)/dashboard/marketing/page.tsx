'use client';

/**
 * Marketing: solo cose che partono davvero.
 *
 * Qui dentro c'erano quattro campagne finte e cinque automazioni finte,
 * scritte nel codice: numeri di invii mai partiti e interruttori che non
 * accendevano niente. Sembrava tutto gia' fatto, e non c'era niente.
 *
 * Adesso le schermate stanno nell'ordine del lavoro: si chiede la recensione,
 * si legge quella arrivata, si scrive su WhatsApp, e — per chi su WhatsApp
 * non arriva — per email o SMS.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import CampagneWhatsApp from './CampagneWhatsApp';
import CampagneEmailSms from './CampagneEmailSms';
import RecensioniGoogle from './RecensioniGoogle';
import ChiediRecensioni from './ChiediRecensioni';

export default function MarketingPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">Marketing</h2>
          <p className="text-sm text-text-secondary">Recensioni, campagne e comunicazioni alle clienti</p>
        </div>
        <a href="/dashboard/automazioni"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-medium hover:bg-bg-hover transition-all">
          <Zap className="w-4 h-4 text-warning" /> Automazioni
        </a>
      </div>

      {/* Prima si chiede la recensione, poi si legge quella che e' arrivata:
          le due schermate stanno in quest'ordine perche' e' l'ordine del lavoro. */}
      <ChiediRecensioni />

      <RecensioniGoogle />

      <CampagneWhatsApp />

      <CampagneEmailSms />

    </motion.div>
  );
}
