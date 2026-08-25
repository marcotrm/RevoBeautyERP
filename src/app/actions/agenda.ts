'use server';

import { prisma } from '@/lib/prisma';
import { avanzaSfide } from '@/lib/challenge';
import { Appointment } from '@/types';
import { mockOperators, mockTreatments, mockClients } from '@/lib/mock-data';
import { notifyCancellazione, notifyNuovoAppuntamento, sendTelegram } from '@/lib/telegram';
import { eClienteNuova } from '@/lib/clienteNuova';
import { sendAppointmentConfirmation, sendAppointmentMoved } from '@/lib/wa-appointments';

export async function getAppointments() {
  const appointments = await prisma.appointment.findMany({
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' }
    ]
  });
  return appointments as unknown as Appointment[];
}

export async function createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
  const targetClientId = data.clientId || 'waitlist-client';

  // Ensure the client exists
  const existingClient = await prisma.client.findUnique({ where: { id: targetClientId } });
  if (!existingClient) {
    await prisma.client.create({
      data: {
        id: targetClientId,
        firstName: data.clientName.split(' ')[0] || 'Unknown',
        lastName: data.clientName.split(' ').slice(1).join(' ') || '',
        phone: '0000000000',
        createdAt: new Date().toISOString()
      }
    });
  }

  // Ensure the operator exists
  const existingOp = await prisma.operator.findUnique({ where: { id: data.operatorId } });
  if (!existingOp) {
    await prisma.operator.create({
      data: {
        id: data.operatorId,
        firstName: data.operatorName.split(' ')[0] || 'Operatrice',
        lastName: data.operatorName.split(' ').slice(1).join(' ') || '',
        color: '#A855F7',
        isActive: true,
        hireDate: new Date().toISOString().split('T')[0],
      }
    });
  }

  // Ensure the treatment exists
  const existingTr = await prisma.treatment.findUnique({ where: { id: data.treatmentId } });
  if (!existingTr) {
    await prisma.treatment.create({
      data: {
        id: data.treatmentId,
        name: data.treatmentName || 'Nuovo Trattamento',
        category: data.treatmentCategory || 'generico',
        duration: data.duration || 60,
        price: data.price || 0,
        color: data.color || '#F472B6',
        isActive: true,
        requiresRoom: false,
      }
    });
  }

  const { services, ...rest } = data;
  const appointment = await prisma.appointment.create({
    data: {
      ...rest,
      services: services ? JSON.parse(JSON.stringify(services)) : undefined,
      clientId: targetClientId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'dino',
    }
  });
  // Conferma WhatsApp al cliente (non blocca la creazione)
  sendAppointmentConfirmation(appointment.id).catch(() => {});

  // Notifica Telegram del nuovo appuntamento (non blocca la creazione)
  eClienteNuova(appointment.clientId, appointment.id)
    .then(nuova => notifyNuovoAppuntamento({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      price: appointment.price,
      source: 'dal gestionale',
      nuova,
    }))
    .catch(() => {});

  return appointment as unknown as Appointment;
}

/**
 * L'ora che riguarda la cliente: quando deve essere qui.
 *
 * Non è per forza l'ora del blocco in agenda. Quando i trattamenti di una
 * seduta vengono divisi fra due operatrici, uno dei due si porta dietro un
 * orario suo e il blocco principale si sposta più avanti: in agenda cambia
 * tutto, ma per chi deve venire l'appuntamento comincia sempre alla stessa
 * ora — la più presta fra tutte.
 */
function inizioPerLaCliente(a: {
  startTime: string;
  services?: unknown;
}): string {
  const orari: string[] = [a.startTime].filter(Boolean);
  const sv = Array.isArray(a.services) ? (a.services as { startTime?: string }[]) : [];
  for (const s of sv) if (s?.startTime) orari.push(s.startTime);
  return orari.sort()[0] || a.startTime;
}

export async function updateAppointmentAction(id: string, updates: Partial<Appointment>) {
  const { services, ...rest } = updates;
  // Lo stato precedente serve in due casi: per notificare l'annullamento una
  // volta sola, e per far avanzare le sfide solo alla prima volta che
  // l'appuntamento viene completato (un check-out ripetuto non vale due passi).
  // Lo sconto entra qui perché il prezzo diverso dal listino va segnalato una
  // volta sola, quando viene deciso: rileggerlo dopo servirebbe a poco.
  // Lo spostamento si riconosce solo confrontando con com'era prima: se
  // cambia il giorno o l'ora, alla cliente va detto il nuovo orario.
  const guardaPrima = updates.status === 'cancelled' || updates.status === 'completed'
    || updates.discountAmount !== undefined
    || updates.date !== undefined || updates.startTime !== undefined || services !== undefined
    || updates.clientId !== undefined;
  const prev = guardaPrima
    ? await prisma.appointment.findUnique({
        where: { id },
        select: { status: true, clientId: true, discountAmount: true, price: true, date: true, startTime: true, services: true },
      })
    : null;
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...rest,
      ...(services !== undefined ? { services: services ? JSON.parse(JSON.stringify(services)) : null } : {}),
      updatedAt: new Date().toISOString()
    }
  });
  /*
    Orario cambiato: si avvisa la cliente.

    Prima non partiva niente e a lei restava in mano la conferma vecchia: si
    presentava all'ora vecchia, e chi aveva spostato l'appuntamento era
    convinto che lo sapesse. Vale per lo spostamento fatto dal gestionale
    (trascinando il blocco o modificando l'appuntamento); quando è la cliente a
    spostarlo da WhatsApp passa da un'altra strada, che le risponde già in chat.
  */
  /*
    Uno spostamento interno non è affare della cliente.

    È successo davvero: due trattamenti della stessa seduta sono stati divisi
    fra Michela e Rosaria, il blocco in agenda si è spostato di mezz'ora per
    far posto e alla cliente è partito "abbiamo spostato il tuo appuntamento"
    — mentre per lei non era cambiato niente. Un messaggio così fa richiamare
    il centro e toglie fiducia alle conferme vere.

    Quindi il confronto si fa sull'ora in cui lei deve essere qui, non su
    quella del blocco: se resta la stessa, in chat non parte niente.
  */
  if (prev) {
    const primaDate = prev.date;
    const dopoDate = appointment.date;
    const primaOra = inizioPerLaCliente(prev);
    const dopoOra = inizioPerLaCliente(appointment);
    if (primaDate !== dopoDate || primaOra !== dopoOra) {
      sendAppointmentMoved(appointment.id).catch(() => {});
    }
  }

  /*
    Appuntamento passato a un'altra cliente: la conferma va a lei.

    Capita quando al banco si sbaglia persona — con due omonime succede — e
    l'appuntamento si sposta sulla scheda giusta. Da quel momento la conferma
    che era partita non vale più per nessuno: la vecchia l'ha ricevuta per
    sbaglio, la nuova non sa di avere un posto. Qui gliela si manda, con lo
    stesso controllo di sempre che impedisce i doppioni.
  */
  if (prev && updates.clientId !== undefined && updates.clientId !== prev.clientId && appointment.clientId) {
    sendAppointmentConfirmation(appointment.id).catch(() => {});
  }

  /*
    Prezzo diverso dal listino: avviso su Telegram.

    Uno sconto è l'unica cosa che abbassa l'incasso senza che nessun numero
    diventi rosso: la giornata torna, la cassa torna, e la differenza si scopre
    solo mettendo in fila i listini a fine mese. Meglio saperlo mentre succede.
    Si avvisa solo quando lo sconto CAMBIA, non a ogni salvataggio.
  */
  if (updates.discountAmount !== undefined && (prev?.discountAmount || 0) !== (updates.discountAmount || 0)) {
    const listino = (appointment.services as { price?: number }[] | null)?.reduce((s, x) => s + (x?.price || 0), 0)
      || appointment.price + (updates.discountAmount || 0);
    const quando = `${appointment.date.split('-').reverse().join('/')} alle ${appointment.startTime}`;
    const chi = updates.discountBy || appointment.discountBy;
    const messaggio = updates.discountAmount
      ? `💸 <b>Prezzo diverso dal listino</b>\n` +
        `${appointment.clientName} — ${appointment.treatmentName}\n` +
        `Listino ${listino.toFixed(2)} € → paga <b>${appointment.price.toFixed(2)} €</b> (sconto ${(updates.discountAmount).toFixed(2)} €)\n` +
        `${appointment.discountReason ? `Motivo: ${appointment.discountReason}\n` : ''}` +
        `Appuntamento del ${quando}${chi ? `\nFatto da: ${chi}` : ''}`
      : `↩️ <b>Sconto tolto</b>\n${appointment.clientName} — ${appointment.treatmentName}\n` +
        `Torna a listino: ${appointment.price.toFixed(2)} €\nAppuntamento del ${quando}${chi ? `\nDa: ${chi}` : ''}`;
    // Un avviso che non parte deve lasciare traccia: oggi abbiamo già scoperto
    // cosa costa un errore ingoiato in silenzio.
    sendTelegram(messaggio)
      .then(r => { if (!r.ok) console.error('[sconto] avviso Telegram non inviato:', r.error); })
      .catch(e => console.error('[sconto] avviso Telegram fallito:', e));
  }

  // Appuntamento portato a termine: avanza le sfide legate alle visite.
  if (updates.status === 'completed' && prev?.status !== 'completed' && appointment.clientId) {
    avanzaSfide(appointment.clientId, 'appointments').catch(() => {});
  }
  // Disdetta: il posto resta vuoto, e un posto vuoto è incasso perso.
  //
  // Per ora la chiamata alle clienti NON parte da sola: si lancia a mano
  // dall'agenda, cliccando sul posto libero. È una scelta, non una cosa da
  // finire: l'interruttore è AVVIO_AUTOMATICO_SU_DISDETTA in lib/copriBuchi.ts
  // e quando si mette a `true` questo pezzo fa partire tutto da sé.
  if (updates.status === 'cancelled' && prev?.status !== 'cancelled') {
    void (async () => {
      try {
        const { creaCampagna, mandaGiro, chiudiCampagna, AVVIO_AUTOMATICO_SU_DISDETTA } = await import('@/lib/copriBuchi');
        if (!AVVIO_AUTOMATICO_SU_DISDETTA) return;
        const c = await creaCampagna({
          date: appointment.date, from: appointment.startTime, to: appointment.endTime,
          operatorId: appointment.operatorId, operatorName: appointment.operatorName,
          treatmentId: appointment.treatmentId, treatmentName: appointment.treatmentName,
          prezzo: appointment.price,
          origine: 'disdetta', disdettaDi: appointment.clientName,
        });
        const r = await mandaGiro(c);
        if (r.inviati === 0) {
          await chiudiCampagna(c.id, 'annullata', r.motivo || 'nessun messaggio partito');
          console.log(`[copri-buchi] non partita: ${r.motivo}`);
        } else {
          console.log(`[copri-buchi] ${c.id}: primo blocco, ${r.inviati} messaggi`);
        }
      } catch (e) {
        console.error('[copri-buchi] avvio da disdetta fallito', e);
      }
    })();
  }

  // Notifica Telegram all'annullamento (non alla modifica del solo motivo)
  if (updates.status === 'cancelled' && prev?.status !== 'cancelled') {
    notifyCancellazione({
      client: appointment.clientName,
      treatment: appointment.treatmentName,
      operator: appointment.operatorName,
      date: appointment.date,
      time: appointment.startTime,
      reason: appointment.cancelReason,
    }).catch(() => {});
  }
  return appointment as unknown as Appointment;
}

export async function deleteAppointmentAction(id: string) {
  await prisma.appointment.delete({
    where: { id }
  });
  return true;
}

export async function seedAgendaData() {
  console.log('Seeding initial data for agenda...');
  
  // Seed Clients
  for (const client of mockClients) {
    const exists = await prisma.client.findUnique({ where: { id: client.id } });
    if (!exists) {
      await prisma.client.create({
        data: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email || null,
          phone: client.phone,
          birthDate: client.birthDate || null,
          gender: client.gender || null,
          address: client.address || null,
          city: client.city || null,
          notes: client.notes || null,
          privateNotes: client.privateNotes || null,
          allergies: client.allergies || null,
          vipLevel: client.vipLevel || 0,
          loyaltyPoints: client.loyaltyPoints || 0,
          createdAt: client.createdAt,
          lastVisit: client.lastVisit || null,
          totalSpent: client.totalSpent || 0,
          visitCount: client.visitCount || 0
        }
      });
    }
  }

  // Seed Operators
  for (const operator of mockOperators) {
    const exists = await prisma.operator.findUnique({ where: { id: operator.id } });
    if (!exists) {
      await prisma.operator.create({
        data: {
          id: operator.id,
          firstName: operator.firstName,
          lastName: operator.lastName,
          color: operator.color,
          isActive: operator.isActive,
          hireDate: operator.hireDate,
        }
      });
    }
  }

  // Seed Treatments
  for (const treatment of mockTreatments) {
    const exists = await prisma.treatment.findUnique({ where: { id: treatment.id } });
    if (!exists) {
      await prisma.treatment.create({
        data: {
          id: treatment.id,
          name: treatment.name,
          category: treatment.category,
          duration: treatment.duration,
          price: treatment.price,
          description: treatment.description || null,
          requiresRoom: treatment.requiresRoom,
          color: treatment.color,
          isActive: treatment.isActive
        }
      });
    }
  }

  return true;
}
