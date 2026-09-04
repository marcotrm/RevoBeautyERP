/**
 * Revo AI: l'assistente personale della cliente.
 *
 * Non un chatbot generico: conosce la sua scheda (nome, storia, punti,
 * appuntamenti) e ha due strumenti veri — il listino e il motore di
 * prenotazione — così una domanda («sabato ho un matrimonio») diventa un
 * consiglio con orari reali. Non prenota da sola: propone, e la cliente
 * conferma dalla schermata Prenota. I limiti (niente diagnosi, niente
 * promesse, prezzi solo di listino) stanno nel prompt E nella struttura:
 * i prezzi arrivano dallo strumento, non dalla fantasia del modello.
 *
 * GET  → lo storico della conversazione
 * POST → un messaggio; torna la risposta completa (niente stream in v1)
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { chiedi, type StrumentoAI } from '@/lib/ai/gateway';
import { cercaSlot } from '@/lib/bookingEngine';

const MAX_STORIA = 20;
const MAX_AL_GIORNO = 40; // freno ai costi: nessuno chiacchiera 40 volte per bene

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const messaggi = await prisma.aiMessage.findMany({
    where: { clientId: cliente.id },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: { id: true, ruolo: true, testo: true, createdAt: true },
  });
  return Response.json({ messaggi });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const testo = String(body?.testo || '').trim().slice(0, 1000);
  if (!testo) {
    return Response.json({ error: 'Scrivi un messaggio.', code: 'VALIDATION' }, { status: 400 });
  }

  const oggiInizio = new Date();
  oggiInizio.setHours(0, 0, 0, 0);
  const oggiCount = await prisma.aiMessage.count({
    where: { clientId: cliente.id, ruolo: 'cliente', createdAt: { gte: oggiInizio.toISOString() } },
  });
  if (oggiCount >= MAX_AL_GIORNO) {
    return Response.json(
      { error: 'Per oggi Revo ha bisogno di riposare 💆‍♀️ Riprova domani o scrivici in chat.', code: 'TOO_MANY' },
      { status: 429 }
    );
  }

  // ── Il contesto: chi è, dove sta nel percorso ──
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
  const [prossimo, ultime, pacchetti, storiaChat] = await Promise.all([
    prisma.appointment.findFirst({
      where: { clientId: cliente.id, date: { gte: oggi }, status: { in: ['confirmed', 'pending'] } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { date: true, startTime: true, treatmentName: true, operatorName: true },
    }),
    prisma.appointment.findMany({
      where: { clientId: cliente.id, status: 'completed' },
      orderBy: { date: 'desc' },
      take: 5,
      select: { date: true, treatmentName: true },
    }),
    prisma.clientPackage.findMany({
      where: { clientId: cliente.id, status: 'active' },
      select: { packageName: true, usedSessions: true, totalSessions: true },
    }),
    prisma.aiMessage.findMany({
      where: { clientId: cliente.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_STORIA,
      select: { ruolo: true, testo: true },
    }),
  ]);

  const gender = String(cliente.gender).toUpperCase() === 'M' ? 'male' as const : 'female' as const;

  // ── Gli strumenti: dati veri, mai inventati ──
  const strumenti: StrumentoAI[] = [
    {
      nome: 'listino',
      descrizione: 'Cerca trattamenti nel listino del centro per nome o categoria. Restituisce nome, durata e prezzo GIUSTO per questa cliente.',
      parametri: {
        type: 'object',
        properties: { cerca: { type: 'string', description: 'Parola da cercare (es. "viso", "laser", "manicure")' } },
        required: ['cerca'],
      },
      esegui: async (input) => {
        const q = String(input.cerca || '').trim();
        const trattamenti = await prisma.treatment.findMany({
          where: {
            isActive: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
          select: { id: true, name: true, category: true, price: true, priceMale: true, priceFemale: true, duration: true },
        });
        if (trattamenti.length === 0) return 'Nessun trattamento trovato con questo nome.';
        return trattamenti
          .map((t) => {
            const prezzo = (gender === 'male' ? t.priceMale : t.priceFemale) ?? t.price;
            return `${t.name} (${t.category}) — ${t.duration} min — ${prezzo}€ — id:${t.id}`;
          })
          .join('\n');
      },
    },
    {
      nome: 'disponibilita',
      descrizione: 'Cerca gli orari davvero liberi per un trattamento nei prossimi giorni. Usa l\'id del trattamento ottenuto dallo strumento listino.',
      parametri: {
        type: 'object',
        properties: {
          treatmentId: { type: 'string' },
          entroGiorni: { type: 'number', description: 'Quanti giorni guardare avanti (max 21)' },
        },
        required: ['treatmentId'],
      },
      esegui: async (input) => {
        const giorni = Math.min(Number(input.entroGiorni) || 10, 21);
        const esito = await cercaSlot({
          dateFrom: oggi,
          giorni,
          gender,
          services: [{ treatmentId: String(input.treatmentId) }],
          maxPerGiorno: 2,
        });
        const righe = esito.giorni
          .flatMap((g) => g.slots.map((s) => `${g.date} alle ${s.time} con ${s.assegnazioni[0]?.operatorName ?? '—'}`))
          .slice(0, 6);
        return righe.length ? righe.join('\n') : 'Nessun orario libero in questi giorni.';
      },
    },
  ];

  const sistema = [
    'Sei Revo, l\'assistente personale del centro estetico RevoBeauty (Via Caudina 30, Maddaloni).',
    'Parli in italiano, con calore e concretezza, dando del tu. Risposte brevi: 2-6 frasi.',
    `Oggi è ${oggi}. La cliente si chiama ${cliente.firstName}.`,
    prossimo
      ? `Prossimo appuntamento: ${prossimo.date} alle ${prossimo.startTime}, ${prossimo.treatmentName} con ${prossimo.operatorName}.`
      : 'Non ha appuntamenti in programma.',
    ultime.length ? `Ultime sedute: ${ultime.map((u) => `${u.treatmentName} (${u.date})`).join('; ')}.` : '',
    pacchetti.length
      ? `Pacchetti attivi: ${pacchetti.map((p) => `${p.packageName} ${p.usedSessions}/${p.totalSessions}`).join('; ')}.`
      : '',
    'REGOLE FERREE:',
    '- Mai diagnosi o consigli medici: per pelle irritata, dolori o dubbi di salute, invita a parlarne in negozio o dal medico.',
    '- Mai promettere risultati; i trattamenti si consigliano come possibilità.',
    '- Prezzi e orari SOLO dagli strumenti: se non li hai usati, non li dici.',
    '- Non puoi prenotare tu: proponi gli orari e dille di confermare dalla schermata Prenota (o rispondi che la chat del centro può aiutarla).',
    '- Non parli mai di altre clienti né di dati che non ti riguardano.',
  ]
    .filter(Boolean)
    .join('\n');

  // ── Il giro con l'AI ──
  const adesso = new Date().toISOString();
  await prisma.aiMessage.create({
    data: { clientId: cliente.id, ruolo: 'cliente', testo, createdAt: adesso },
  });

  try {
    const risposta = await chiedi({
      sistema,
      strumenti,
      messaggi: [...storiaChat.reverse().map((m) => ({ ruolo: m.ruolo as 'cliente' | 'revo', testo: m.testo })), { ruolo: 'cliente', testo }],
    });

    const salvata = await prisma.aiMessage.create({
      data: {
        clientId: cliente.id,
        ruolo: 'revo',
        testo: risposta.testo,
        strumenti: risposta.strumentiUsati,
        modello: risposta.modello,
        costoUsd: risposta.costoUsd,
        createdAt: new Date().toISOString(),
      },
    });

    return Response.json({
      messaggio: { id: salvata.id, ruolo: 'revo', testo: risposta.testo, createdAt: salvata.createdAt },
    });
  } catch (err) {
    console.error('[revo-ai] errore:', err);
    return Response.json(
      { error: 'Revo ha avuto un contrattempo. Riprova, o scrivici nella chat del centro.', code: 'UNKNOWN' },
      { status: 502 }
    );
  }
}
