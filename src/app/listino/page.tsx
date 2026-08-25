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
import ListinoClient, { type VoceListino, type VocePacchetto } from './ListinoClient';

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

  /*
    Anche i pacchetti, col loro risparmio.

    Una cliente che guarda "20 € a seduta" non sa che dieci sedute ne costano
    ottanta: il pacchetto è la cosa che conviene di più a lei e al centro, e
    finché resta scritto solo dentro al gestionale non lo compra nessuno.
    Il risparmio si calcola sul prezzo vero del trattamento a listino, quindi
    non si può sbagliare: se cambia il listino cambia anche lui.
  */
  const packages = await prisma.package.findMany({ orderBy: { price: 'asc' } });
  const prezzoDi = new Map(treatments.map(t => [t.name.trim().toLowerCase(), t.priceFemale ?? t.price]));

  const pacchetti: VocePacchetto[] = packages.map(p => {
    const singolo = prezzoDi.get((p.treatmentName || '').trim().toLowerCase());
    const pieno = singolo ? singolo * p.totalSessions : null;
    const risparmio = pieno && pieno > p.price ? Math.round((pieno - p.price) * 100) / 100 : null;
    return {
      id: p.id,
      nome: p.name.replace(/\s+/g, ' ').trim(),
      sedute: p.totalSessions,
      prezzo: p.price,
      trattamento: p.treatmentName || '',
      aSeduta: p.totalSessions > 0 ? Math.round((p.price / p.totalSessions) * 100) / 100 : p.price,
      risparmio,
    };
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

  return <ListinoClient voci={voci} pacchetti={pacchetti} centro={CENTRO} />;
}
