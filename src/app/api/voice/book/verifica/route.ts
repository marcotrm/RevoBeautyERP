import { isAuthorized, unauthorized } from '@/lib/voice';
import { firmaConferma } from '@/lib/conferma';
import { preparaPrenotazione } from '@/lib/vocePrenota';

export const runtime = 'nodejs';

/**
 * Il passo prima di prenotare: si controlla che l'orario regga e si ottiene la
 * frase da ripetere alla cliente, insieme al gettone da riportare indietro.
 *
 * L'assistente legge `riepilogo` così com'è — non lo riassume, non lo
 * riformula — e aspetta un sì. Se la cliente corregge qualcosa, si richiama
 * questa route con il dato corretto e si ottiene un gettone nuovo: quello
 * vecchio non serve più a niente.
 *
 * Nessuna scrittura: qui non si crea né la cliente né l'appuntamento. Se la
 * telefonata cade adesso, in agenda e in rubrica non resta traccia.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ ok: false, codice: 'VALIDATION', messaggio: 'Dati mancanti.' }, { status: 400 });

  const p = await preparaPrenotazione(b);
  if (!p.ok) {
    return Response.json({ ok: false, codice: p.codice, messaggio: p.messaggio }, { status: p.stato });
  }

  const tokenConferma = firmaConferma(p.dati);
  if (!tokenConferma) {
    return Response.json({ ok: false, codice: 'CONFIG', messaggio: 'Assistente non configurato.' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    riepilogo: p.riepilogo,
    /** Da dire alla lettera, aspettando la risposta. */
    domanda: `${p.riepilogo} Confermo?`,
    dettaglio: {
      cliente: p.nomeCliente,
      giaInRubrica: p.clienteId !== null,
      date: p.dati.date,
      startTime: p.slot.time,
      endTime: p.slot.endTime,
      durata: p.slot.durataTotale,
      prezzo: p.slot.prezzoTotale,
      trattamenti: p.slot.assegnazioni.map(a => ({
        nome: a.treatmentName, operatrice: a.operatorName, dalle: a.startTime,
      })),
    },
    tokenConferma,
  });
}
