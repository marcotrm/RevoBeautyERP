/**
 * Tutto quello che serve alla schermata iniziale, in una chiamata sola.
 *
 * Sei chiamate separate su rete mobile significano sei attese e sei modi di
 * fallire a metà: la Home resterebbe montata a pezzi davanti alla cliente.
 * Qui si paga una query in più lato server per avere una schermata che o c'è
 * tutta o non c'è.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { utenteApp } from '@/lib/mobileUser';
import { saldoWallet, saldoPunti } from '@/lib/wallet';
import { livelloCliente } from '@/lib/club';
import { leggiConfig } from '@/lib/appSettings';
import { generaProposte } from '@/lib/proposte';
import { tracciaMolti } from '@/lib/appEvents';
import { leggiPreTrattamento } from '@/lib/estetica';
import { soloNome } from '@/lib/nomiPropri';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const config = await leggiConfig();
  const oggi = new Date().toISOString().slice(0, 10);

  const [prossimo, wallet, punti, livello, proposte, pacchetti, percorsoEstetico] = await Promise.all([
    prisma.appointment.findFirst({
      where: { clientId: cliente.id, date: { gte: oggi }, status: { notIn: ['cancelled', 'completed'] } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true, date: true, startTime: true, endTime: true, treatmentName: true, operatorName: true, price: true,
        treatment: { select: { preTrattamento: true } },
      },
    }),
    config.funzioni.wallet ? saldoWallet(cliente.id) : Promise.resolve(null),
    saldoPunti(cliente.id),
    config.funzioni.club ? livelloCliente(cliente.id) : Promise.resolve(null),
    generaProposte({ clientId: cliente.id, nome: cliente.firstName, config }),
    config.funzioni.percorsi
      ? prisma.clientPackage.findMany({
          where: { clientId: cliente.id, status: 'active' },
          select: { id: true, packageName: true, packageColor: true, totalSessions: true, usedSessions: true, expiryDate: true },
        })
      : Promise.resolve([]),
    prisma.percorsoEstetico.findFirst({
      where: { clientId: cliente.id, stato: { in: ['attivo', 'mantenimento'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, nome: true, obiettivo: true, seduteTotali: true, stato: true, sedute: { select: { id: true } } },
    }),
  ]);

  const daMostrare = proposte.slice(0, config.home.maxProposte);

  // Si registra cosa è stato davvero mostrato: senza le viste, il tasso di
  // conversione delle proposte non si può calcolare.
  await tracciaMolti(
    daMostrare.map(p => ({
      clientId: cliente.id, type: 'view' as const, surface: 'per_te' as const,
      itemId: p.id, meta: { tipo: p.tipo },
    }))
  );

  return Response.json({
    user: utenteApp(cliente),
    messaggio: config.home.messaggio || null,
    prossimoAppuntamento: prossimo && {
      id: prossimo.id, date: prossimo.date, startTime: prossimo.startTime, endTime: prossimo.endTime,
      treatmentName: prossimo.treatmentName, operatorName: soloNome(prossimo.operatorName), price: prossimo.price,
      // Se il trattamento ha una preparazione, la Home la mette in evidenza.
      preparazione: leggiPreTrattamento(prossimo.treatment?.preTrattamento),
    },
    percorsoEstetico: percorsoEstetico && {
      id: percorsoEstetico.id, nome: percorsoEstetico.nome, obiettivo: percorsoEstetico.obiettivo,
      stato: percorsoEstetico.stato,
      seduteFatte: percorsoEstetico.sedute.length, seduteTotali: percorsoEstetico.seduteTotali,
    },
    // Per il richiamo "ci manchi" quando non c'è nulla in agenda
    ultimaVisita: cliente.lastVisit || null,
    // Recapiti in fondo alla Home: modificabili dal gestionale, non dal codice
    centro: config.centro,
    punti,
    wallet: wallet && {
      totale: wallet.totale,
      perTasca: wallet.perTasca,
      inScadenza: wallet.inScadenza,
    },
    club: livello && {
      attuale: livello.attuale,
      prossimo: livello.prossimo,
      avanzamento: livello.avanzamento,
      spesaTotale: livello.spesaTotale,
    },
    percorsi: pacchetti
      .map(p => ({
        id: p.id, nome: p.packageName, colore: p.packageColor,
        fatte: p.usedSessions, totali: p.totalSessions,
        residue: p.totalSessions - p.usedSessions, scadenza: p.expiryDate,
      }))
      .filter(p => p.residue > 0),
    proposte: daMostrare,
    /** Quante ce ne sarebbero in tutto: alimenta "Cosa posso fare oggi". */
    proposteTotali: proposte.length,
    funzioni: config.funzioni,
  });
}
