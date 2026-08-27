import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, todayInItaly } from '@/lib/voice';
import { leggiCentro, orariParlati, eChiuso } from '@/lib/centro';
import { dataParlata } from '@/lib/parlato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Quello che l'assistente deve sapere per rispondere alle domande di sempre:
 * a che ora aprite, dove siete, quanto costa, che cosa fate.
 *
 * È pensato per essere chiesto UNA volta a inizio telefonata e tenuto in
 * testa per tutta la conversazione, quindi deve stare stretto: qui ci sono le
 * categorie con la fascia di prezzo, non i duecento trattamenti del listino.
 * Il singolo prezzo si chiede a /api/voice/treatments quando serve davvero —
 * il listino intero come risposta a ogni battuta sarebbe venti chili di roba
 * per dire "la ceretta costa cinque euro".
 */

/** Le categorie come le chiama la gente, non come le chiama il database. */
const NOMI_CATEGORIA: Record<string, string> = {
  nails: 'unghie', laser: 'laser', waxing: 'ceretta', facial: 'viso',
  body: 'corpo', massage: 'massaggi', makeup: 'trucco',
  consultation: 'consulenza', hair: 'capelli',
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const oggi = todayInItaly();
  const [centro, treatments] = await Promise.all([
    leggiCentro(),
    prisma.treatment.findMany({
      where: { isActive: true },
      select: { category: true, price: true, priceFemale: true },
    }),
  ]);

  // Fascia di prezzo per categoria: "la ceretta va dai 5 ai 40 euro" è una
  // risposta utile; "non lo so, dipende" no.
  const perCategoria = new Map<string, number[]>();
  for (const t of treatments) {
    const p = t.priceFemale ?? t.price;
    const arr = perCategoria.get(t.category) || [];
    arr.push(p);
    perCategoria.set(t.category, arr);
  }

  const dow = new Date(oggi + 'T12:00:00').getDay();
  const orarioOggi = centro.orari?.[String(dow === 0 ? 7 : dow)] ?? null;

  return Response.json({
    centro: {
      nome: centro.nome,
      indirizzo: centro.indirizzo,
      telefono: centro.telefono,
      // Dove passare la chiamata quando non ne viene fuori. Se non e' stato
      // messo si ripiega sul numero pubblico.
      telefonoPassaggio: centro.telefonoPassaggio || centro.telefono || '',
      sito: centro.sito,
      orariParlati: orariParlati(centro.orari),
    },
    oggi: {
      data: oggi,
      giornoParlato: dataParlata(oggi, oggi),
      aperto: !eChiuso(centro, oggi),
      apre: orarioOggi?.apre ?? null,
      chiude: orarioOggi?.chiude ?? null,
    },
    /** Solo quelle che devono ancora arrivare: le ferie del mese scorso non servono. */
    chiusure: (centro.chiusure || []).filter(d => d >= oggi).sort(),
    categorie: [...perCategoria.entries()]
      .map(([key, prezzi]) => ({
        chiave: key,
        nome: NOMI_CATEGORIA[key] || key,
        quanti: prezzi.length,
        daEuro: Math.min(...prezzi),
        aEuro: Math.max(...prezzi),
      }))
      .sort((a, b) => b.quanti - a.quanti),
    note: centro.noteVoce || '',
  });
}
