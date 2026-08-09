/**
 * Listino per l'app: trattamenti divisi per categoria e pacchetti in vendita.
 *
 * I prezzi arrivano già scelti per la cliente che guarda: molti trattamenti
 * costano (e durano) diversamente per donna e uomo, e mandare all'app tutte le
 * varianti significherebbe farle scegliere a lei — cioè rischiare che mostri il
 * prezzo sbagliato. Chi in scheda non ha il sesso vede il prezzo base.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const g = String(cliente.gender || '').trim().toUpperCase();
  const sesso = g === 'F' ? 'F' : g === 'M' ? 'M' : null;

  const [trattamenti, pacchetti] = await Promise.all([
    prisma.treatment.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, category: true, description: true,
        price: true, priceMale: true, priceFemale: true,
        duration: true, durationMale: true, durationFemale: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.package.findMany({
      select: { id: true, name: true, type: true, price: true, totalSessions: true, description: true, treatmentName: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const prezzo = (t: (typeof trattamenti)[number]) =>
    (sesso === 'M' ? t.priceMale : sesso === 'F' ? t.priceFemale : null) ?? t.price;
  const durata = (t: (typeof trattamenti)[number]) =>
    (sesso === 'M' ? t.durationMale : sesso === 'F' ? t.durationFemale : null) ?? t.duration;

  // Raggruppati per categoria mantenendo l'ordine alfabetico già chiesto al db
  const perCategoria = new Map<string, { name: string; treatments: unknown[] }>();
  for (const t of trattamenti) {
    const cat = t.category || 'Altro';
    const gruppo = perCategoria.get(cat) || { name: cat, treatments: [] };
    gruppo.treatments.push({
      id: t.id,
      name: t.name,
      duration: durata(t),
      price: prezzo(t),
      description: t.description,
    });
    perCategoria.set(cat, gruppo);
  }

  return Response.json({
    gender: sesso,
    packages: pacchetti,
    categories: [...perCategoria.values()],
  });
}
