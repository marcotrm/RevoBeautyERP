/**
 * Il listino, per le clienti.
 *
 * "Quanto viene la pulizia viso?" è la domanda del banco, e finora la risposta
 * era a voce o su un foglio stampato che invecchia il giorno dopo. Questa
 * pagina legge i trattamenti veri: si alza un prezzo in gestionale e cambia
 * qui, anche nei messaggi mandati tre mesi fa.
 *
 * È pubblica apposta — si manda su WhatsApp e si fa inquadrare col QR al
 * banco — quindi mostra solo quello che una cliente vedrebbe comunque in
 * vetrina: nomi, durate e prezzi. Nient'altro del gestionale passa di qui.
 */

import React from 'react';
import prisma from '@/lib/prisma';
import { CENTRO } from '@/lib/centro';
import ListinoClient, { type VoceListino } from './ListinoClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Listino — ${CENTRO.nome}`,
  description: 'Trattamenti, durate e prezzi aggiornati.',
};

export default async function ListinoPage() {
  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, category: true, duration: true,
      price: true, priceFemale: true, priceMale: true,
      durationFemale: true, durationMale: true,
    },
  });

  const voci: VoceListino[] = treatments.map(t => ({
    id: t.id,
    nome: t.name,
    categoria: t.category || 'altro',
    prezzoDonna: t.priceFemale ?? t.price,
    prezzoUomo: t.priceMale ?? t.priceFemale ?? t.price,
    minutiDonna: t.durationFemale ?? t.duration,
    minutiUomo: t.durationMale ?? t.durationFemale ?? t.duration,
  }));

  return <ListinoClient voci={voci} centro={CENTRO} />;
}
