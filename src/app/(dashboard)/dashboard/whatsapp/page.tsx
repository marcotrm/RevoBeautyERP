'use client';

import React from 'react';
import { motion } from 'framer-motion';
import WhatsAppChat from './WhatsAppChat';

export default function WhatsAppPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold text-text-primary">Conversazioni WhatsApp</h2>
        <p className="text-sm text-text-secondary">
          Tutti i messaggi del numero del centro: quelli dei clienti, le risposte automatiche e le tue.
        </p>
      </div>
      <WhatsAppChat />
    </motion.div>
  );
}
