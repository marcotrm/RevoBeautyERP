import { prisma } from '@/lib/prisma';
import { isAuthorized, unauthorized, badRequest, findClientByPhone, todayInItaly } from '@/lib/voice';
import { listMessages } from '@/lib/wa-conversations';
import { quandoParlato, dataParlata } from '@/lib/parlato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Chi sta chiamando: scheda, prossimi appuntamenti, e cosa si erano già detti
 * su WhatsApp.
 *
 * La chat serve più di quanto sembri. Una cliente che ieri ha scritto "quanto
 * costa il laser gambe?" e oggi telefona non deve ricominciare da capo: se
 * l'assistente sa già di cosa si parlava, la telefonata dura un minuto invece
 * di cinque. E se al centro le avevano promesso qualcosa in chat, quella
 * promessa deve valere anche al telefono — è lo stesso centro, e la cliente
 * non distingue i canali.
 *
 * Si mandano gli ultimi scambi, non tutto l'archivio: al modello serve il filo
 * del discorso, non la storia di due anni.
 */

/** Quanti messaggi bastano per capire di cosa si stava parlando. */
const QUANTI_MESSAGGI = 12;
/** Oltre questo, non è più "la conversazione in corso" ma archeologia. */
const GIORNI_INDIETRO = 45;

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.phone) return badRequest('Campo "phone" obbligatorio');

  const client = await findClientByPhone(body.phone);

  /*
    La chat si legge dal NUMERO, non dalla scheda: chi scrive su WhatsApp
    spesso non è ancora in rubrica, ed è proprio quella la conversazione che
    non va persa — è una cliente nuova che sta decidendo se venire.
  */
  const limite = new Date(Date.now() - GIORNI_INDIETRO * 86_400_000).toISOString();
  const chat = await listMessages(body.phone, 200)
    .then(righe => righe
      .filter(m => m.at >= limite && m.text.trim())
      .slice(-QUANTI_MESSAGGI)
      .map(m => ({
        chi: m.direction === 'in' ? 'cliente' : 'centro',
        testo: m.text,
        quando: dataParlata(m.at.slice(0, 10)),
      })))
    .catch(() => []);

  if (!client) {
    return Response.json({
      found: false,
      message: chat.length > 0
        ? 'Questo numero non è in rubrica, ma ha già scritto su WhatsApp: guarda la chat.'
        : 'Questo numero non è in rubrica. Chiedi nome e cognome e fatteli confermare.',
      chat,
    });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      clientId: client.id,
      date: { gte: todayInItaly() },
      status: { notIn: ['cancelled', 'no_show', 'completed'] },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true, date: true, startTime: true, endTime: true,
      treatmentName: true, operatorName: true, status: true,
    },
  });

  return Response.json({
    found: true,
    client: { id: client.id, firstName: client.firstName, lastName: client.lastName },
    appointments: appointments.map(a => ({
      ...a,
      // Già pronta da dire, così la data non la compone il modello.
      quandoParlato: quandoParlato(a.date, a.startTime),
    })),
    chat,
  });
}
