/**
 * Il listino in JSON, per il sito.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ ESISTE
 *
 * Le pagine dei servizi su revobeauty.it sono scritte a mano, e sono
 * invecchiate. Il confronto del 27 agosto 2026, pagina per pagina:
 *
 *   Bendaggi Corpo                  sito 49,90 €   gestionale 20,00 €
 *   Radiofrequenza Corpo 30 minuti  sito 29,90 €   gestionale 60,00 €
 *   Pressoterapia con Bendaggio     sito 34,90 €   gestionale 25,00 €
 *   Ricostruzione Acrygel o Gel     sito 45,00 €   gestionale 50,00 €
 *
 * Più una ventina di voci che differiscono di dieci centesimi — il sito usa i
 * prezzi che finiscono in 90, il gestionale quelli tondi — e qualche durata
 * che non combacia.
 *
 * Finché sono due elenchi scritti da due persone in due posti, torneranno a
 * divergere: nessuno aggiorna WordPress il giorno che cambia un prezzo in
 * gestionale. Da qui il sito può leggere il listino vero, e allora il
 * gestionale è il punto di riferimento davvero — non per modo di dire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COSA ESPONE, E PERCHÉ SI PUÒ
 *
 * Nomi, categorie, durate e prezzi dei trattamenti attivi, più i pacchetti.
 * Esattamente quello che la pagina `/listino` mostra già in chiaro a chiunque
 * abbia il link, e quello che una cliente leggerebbe comunque in vetrina.
 * Niente clienti, niente agenda, niente prezzi riservati: quelli sono di chi
 * scrive, e restano dentro la conversazione.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { corsLead } from '@/lib/lead';
import { leggiCentro } from '@/lib/centro';

export const dynamic = 'force-dynamic';

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsLead(request.headers.get('origin')) });
}

export async function GET(request: Request) {
  const [treatments, packages, centro] = await Promise.all([
    prisma.treatment.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, category: true, duration: true,
        price: true, priceFemale: true, priceMale: true,
        durationFemale: true, durationMale: true,
      },
    }),
    prisma.package.findMany({ orderBy: { price: 'asc' } }),
    leggiCentro(),
  ]);

  const voci = treatments.map(t => ({
    id: t.id,
    nome: t.name,
    categoria: t.category,
    donna: { prezzo: t.priceFemale ?? t.price, durata: t.durationFemale ?? t.duration },
    uomo: {
      prezzo: t.priceMale ?? t.priceFemale ?? t.price,
      durata: t.durationMale ?? t.durationFemale ?? t.duration,
    },
  }));

  const categorie = [...new Set(voci.map(v => v.categoria))].sort();

  return NextResponse.json(
    {
      aggiornatoIl: new Date().toISOString(),
      // I dati del centro che il sito stampa in chiaro: orari nel footer,
      // indirizzo nella mappa, telefono nel bottone di chiamata. Solo i campi
      // pubblici — telefonoPassaggio, emailReport e le note per l'assistente
      // restano dentro il gestionale.
      centro: {
        nome: centro.nome,
        indirizzo: centro.indirizzo,
        telefono: centro.telefono,
        orari: centro.orari,
        chiusure: centro.chiusure,
      },
      categorie,
      trattamenti: voci,
      pacchetti: packages.map(p => ({
        nome: p.name,
        sedute: p.totalSessions,
        prezzo: p.price,
        trattamento: p.treatmentName || undefined,
      })),
    },
    {
      headers: {
        ...corsLead(request.headers.get('origin')),
        // Un minuto di cache: il sito non deve interrogare il gestionale a
        // ogni visita, e un prezzo cambiato arriva comunque entro un minuto.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  );
}
