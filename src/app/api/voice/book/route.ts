import { prisma } from '@/lib/prisma';
import { notifyNuovoAppuntamento } from '@/lib/telegram';
import { eClienteNuova } from '@/lib/clienteNuova';
import { omonimoInRubrica } from '@/lib/omonimi';
import { sendAppointmentConfirmation } from '@/lib/wa-appointments';
import { quandoParlato } from '@/lib/parlato';
import { leggiConferma } from '@/lib/conferma';
import { preparaPrenotazione, metaTrattamenti, type DatiPrenotazione } from '@/lib/vocePrenota';
import { isAuthorized, unauthorized } from '@/lib/voice';

export const runtime = 'nodejs';

/**
 * L'appuntamento preso al telefono.
 *
 * Si entra solo con il gettone rilasciato da /api/voice/book/verifica, e i dati
 * si prendono da LÌ, non dal corpo della richiesta: fra il "sì, corretto" della
 * cliente e la riga scritta in agenda non deve poter cambiare niente. È anche
 * la ragione per cui l'assistente non può prenotare senza aver prima letto il
 * riepilogo ad alta voce — non è una regola scritta nelle istruzioni, che un
 * modello di fretta salta, è la forma della porta.
 *
 * La disponibilità si ricontrolla comunque: fra la conferma e adesso sono
 * passati dei secondi, e al banco intanto qualcuno può aver preso quel posto.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ success: false, code: 'VALIDATION', message: 'Dati mancanti.' }, { status: 400 });

  const confermato = leggiConferma<DatiPrenotazione>(b.tokenConferma);
  if (!confermato) {
    return Response.json({
      success: false,
      code: 'SERVE_CONFERMA',
      message: b.tokenConferma
        ? 'La conferma è scaduta. Ripeti l\'appuntamento alla cliente e fattelo confermare di nuovo.'
        : 'Prima chiama /api/voice/book/verifica, leggi il riepilogo alla cliente e fattelo confermare.',
    }, { status: 428 });
  }

  const p = await preparaPrenotazione(confermato);
  if (!p.ok) {
    return Response.json({ success: false, code: p.codice, message: p.messaggio }, { status: p.stato });
  }
  const { slot } = p;

  /*
    La scheda della cliente si crea adesso, non prima: se la telefonata si
    fosse incagliata sull'orario, in rubrica non doveva restare la scheda vuota
    di qualcuno che non ha prenotato niente.
  */
  const client = p.clienteId
    ? { id: p.clienteId, nome: p.nomeCliente }
    : await prisma.client.create({
        data: {
          firstName: p.nomeCliente.split(/\s+/)[0],
          lastName: p.nomeCliente.split(/\s+/).slice(1).join(' '),
          phone: confermato.phone,
          gender: confermato.gender === 'male' ? 'M' : 'F',
          createdAt: new Date().toISOString(),
        },
        select: { id: true },
      }).then(c => ({ id: c.id, nome: p.nomeCliente }));

  const metaDi = await metaTrattamenti(slot);
  const principale = slot.assegnazioni[0];
  const adesso = new Date().toISOString();

  const appointment = await prisma.appointment.create({
    data: {
      clientId: client.id,
      clientName: client.nome,
      operatorId: principale.operatorId,
      operatorName: principale.operatorName,
      treatmentId: principale.treatmentId,
      treatmentName: slot.assegnazioni.map(a => a.treatmentName).join(' + '),
      treatmentCategory: metaDi.get(principale.treatmentId)?.category || 'body',
      date: confermato.date,
      startTime: slot.time,
      endTime: slot.endTime,
      duration: slot.durataTotale,
      status: 'confirmed',
      price: slot.prezzoTotale,
      services: slot.assegnazioni.map(a => ({
        treatmentId: a.treatmentId,
        treatmentName: a.treatmentName,
        treatmentCategory: metaDi.get(a.treatmentId)?.category || 'body',
        duration: a.duration,
        price: a.price,
        gender: confermato.gender,
        operatorId: a.operatorId,
        operatorName: a.operatorName,
      })),
      color: metaDi.get(principale.treatmentId)?.color || '#A855F7',
      notes: 'Prenotazione al telefono',
      createdAt: adesso,
      updatedAt: adesso,
      createdBy: 'voice-assistant',
    },
  });

  // Conferma WhatsApp alla cliente (non blocca la prenotazione)
  sendAppointmentConfirmation(appointment.id).catch(() => {});

  /*
    Chi prenota da fuori non sceglie una scheda: la sua nasce dal numero. Se
    però quel nome in rubrica c'è già con un altro numero, è un possibile
    doppione e va detto stasera, non fra sei mesi.
  */
  Promise.all([
    eClienteNuova(appointment.clientId, appointment.id),
    omonimoInRubrica(prisma, appointment.clientId),
  ])
    .then(([nuova, omonimi]) => notifyNuovoAppuntamento({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      price: appointment.price,
      source: 'assistente vocale',
      nuova,
      omonima: omonimi.length > 0 ? omonimi.map(o => o.phone).join(', ') : null,
    }))
    .catch(() => {});

  return Response.json({
    success: true,
    // Frase già pronta: la data la compone il gestionale, non il modello.
    message: `Fatto: ${quandoParlato(appointment.date, appointment.startTime)} `
      + `con ${appointment.operatorName.split(' ')[0]}.`,
    appointment: {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      treatmentName: appointment.treatmentName,
      operatorName: appointment.operatorName,
      clientName: appointment.clientName,
      price: appointment.price,
    },
  });
}
