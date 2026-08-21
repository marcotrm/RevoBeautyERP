/**
 * "Pina Minerva 🆕": è la prima volta che entra.
 *
 * Sull'avviso Telegram di ogni nuovo appuntamento, sapere se la cliente è
 * appena arrivata cambia la giornata: una faccia nuova si accoglie in un altro
 * modo, e se la prima volta va bene torna. Prima quel dato c'era solo in
 * anagrafica, e per saperlo bisognava andarselo a cercare.
 *
 * Nuova vuol dire due cose insieme: la scheda è stata creata oggi — cioè
 * l'hanno scritta al momento di prendere l'appuntamento, non l'hanno pescata
 * dalla rubrica — e questo è il suo primo appuntamento. La seconda condizione
 * serve a non ripetere "nuova" su tutti gli appuntamenti presi lo stesso
 * giorno: la notizia è una sola, e si dà una volta.
 */

import { prisma } from '@/lib/prisma';
import { todayRome } from '@/lib/date';

export async function eClienteNuova(clientId: string | null | undefined, appointmentId: string): Promise<boolean> {
  if (!clientId) return false;
  try {
    const cliente = await prisma.client.findUnique({
      where: { id: clientId },
      select: { createdAt: true },
    });
    // La data è scritta in due formati diversi a seconda di dove nasce la
    // scheda (dal gestionale solo il giorno, dal sito l'istante intero):
    // i primi dieci caratteri sono il giorno in tutti e due i casi.
    if (!cliente?.createdAt || cliente.createdAt.slice(0, 10) !== todayRome()) return false;
    const altri = await prisma.appointment.count({
      where: { clientId, id: { not: appointmentId }, status: { notIn: ['cancelled'] } },
    });
    return altri === 0;
  } catch {
    // Un avviso senza etichetta è meglio di un avviso che non parte.
    return false;
  }
}
