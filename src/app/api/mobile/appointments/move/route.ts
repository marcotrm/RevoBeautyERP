/**
 * Spostare un appuntamento dall'app: la richiesta più frequente della vita
 * vera ("non ce la faccio, posso venire giovedì?").
 *
 * Regole:
 *  - vale la stessa soglia della disdetta (24 ore): sotto, si passa dal
 *    telefono — spostare È disdire e riprenotare;
 *  - il nuovo orario si ricontrolla ADESSO con il motore vero, escludendo
 *    l'appuntamento stesso dal conteggio degli occupati (altrimenti il suo
 *    stesso posto vecchio non risulterebbe mai libero per operatrice/cabina);
 *  - si AGGIORNA la stessa riga (stesso id, stesso prezzo, stesse note):
 *    così pacchetto, caparra e storia restano attaccati all'appuntamento.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { disdettabile } from '@/lib/mobileAppuntamenti';
import { slotDisponibili } from '@/lib/bookingEngine';
import { todayInItaly } from '@/lib/voice';
import { notifyNuovoAppuntamento } from '@/lib/telegram';
import { soloNome } from '@/lib/nomiPropri';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.appointmentId || '');
  const date = String(body?.date || '');
  const time = String(body?.time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return Response.json({ error: 'Scegli data e orario.', code: 'VALIDATION' }, { status: 400 });
  }
  if (date < todayInItaly()) {
    return Response.json({ error: 'La data è nel passato.', code: 'VALIDATION' }, { status: 400 });
  }

  // Suo, e ancora spostabile con le regole della disdetta.
  const appuntamento = await prisma.appointment.findFirst({
    where: { id, clientId: cliente.id },
  });
  if (!appuntamento) {
    return Response.json({ error: 'Appuntamento non trovato.', code: 'NOT_FOUND' }, { status: 404 });
  }
  const esito = disdettabile(appuntamento);
  if (!esito.ok) {
    return Response.json({ error: esito.error.replace('disdetto', 'spostato').replace('disdire', 'spostare'), code: esito.code }, { status: 409 });
  }

  // I trattamenti della seduta, per rifare la ricerca con gli stessi servizi.
  const servizi = Array.isArray(appuntamento.services) && (appuntamento.services as unknown[]).length > 0
    ? (appuntamento.services as { treatmentId?: string; operatorId?: string }[])
        .filter((s) => s?.treatmentId)
        .map((s) => ({ treatmentId: String(s.treatmentId), operatorId: s.operatorId ? String(s.operatorId) : null }))
    : [{ treatmentId: appuntamento.treatmentId, operatorId: null }];

  const genere = cliente.gender === 'M' ? 'male' as const : 'female' as const;
  const { slots } = await slotDisponibili({
    date, services: servizi, gender: genere, oraDa: time,
    ignoraAppointmentId: appuntamento.id,
  });
  const slot = slots.find((s) => s.time === time);
  if (!slot) {
    return Response.json(
      { error: 'Questo orario non è più disponibile: scegline un altro.', code: 'TOO_LATE' },
      { status: 409 }
    );
  }

  const principale = slot.assegnazioni[0];
  const adesso = new Date().toISOString();
  const vecchia = `${appuntamento.date} ${appuntamento.startTime}`;

  const aggiornato = await prisma.appointment.update({
    where: { id: appuntamento.id },
    data: {
      date,
      startTime: slot.time,
      endTime: slot.endTime,
      operatorId: principale.operatorId,
      operatorName: principale.operatorName,
      services: (appuntamento.services as object) ?? undefined,
      notes: `${appuntamento.notes ?? ''} · spostato dall'app (era ${vecchia})`.replace(/^ · /, ''),
      updatedAt: adesso,
    },
  });

  // Il centro lo deve sapere stasera, non scoprirlo domattina in agenda.
  notifyNuovoAppuntamento({
    client: appuntamento.clientName,
    treatment: `SPOSTATO: ${appuntamento.treatmentName}`,
    operator: aggiornato.operatorName,
    date,
    time: slot.time,
    price: appuntamento.price,
    source: `spostato dall'app (era ${vecchia})`,
    nuova: false,
    omonima: null,
  }).catch(() => {});

  return Response.json({
    ok: true,
    appointment: {
      id: aggiornato.id,
      date: aggiornato.date,
      startTime: aggiornato.startTime,
      endTime: aggiornato.endTime,
      treatmentName: aggiornato.treatmentName,
      operatorName: soloNome(aggiornato.operatorName),
    },
  });
}
