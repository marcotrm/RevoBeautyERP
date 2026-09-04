import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Le spunte «chi lo fa» del listino, in forma pulita.
 * Vuoto = lo fanno tutte (stessa regola del motore degli orari).
 */
function leggiAbili(grezzo: unknown): string[] {
  if (!Array.isArray(grezzo)) return [];
  return grezzo
    .map(v => (v && typeof v === 'object' && 'operatorId' in v ? String((v as { operatorId: unknown }).operatorId || '') : ''))
    .filter(Boolean);
}

// Elenco pubblico dei trattamenti prenotabili (app clienti e pagina di prenotazione online).
export async function GET() {
  const righe = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, category: true,
      price: true, duration: true,
      priceMale: true, priceFemale: true, durationMale: true, durationFemale: true,
      operatorSkills: true,
    },
  });
  // «Chi lo fa» viaggia col trattamento: la tendina delle operatrici si
  // filtra da sola, oggi e per ogni trattamento futuro — è la stessa
  // colonna del listino, non una copia da tenere allineata.
  const treatments = righe.map(({ operatorSkills, ...t }) => ({
    ...t,
    abili: leggiAbili(operatorSkills),
  }));
  return Response.json({ treatments });
}
