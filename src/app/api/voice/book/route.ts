import { leggiConferma } from '@/lib/conferma';
import { scriviAppuntamento, confermaSuWhatsApp, type DatiPrenotazione } from '@/lib/vocePrenota';
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
 * La riga in agenda la scrive `scriviAppuntamento`, che è la stessa usata dalla
 * segretaria su WhatsApp: due copie di quel codice divergono, e il centro si
 * ritrova due tipi di appuntamento che si comportano diversamente senza che
 * nessuno l'abbia deciso.
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

  const esito = await scriviAppuntamento(confermato, {
    createdBy: 'voice-assistant',
    nota: 'Prenotazione al telefono',
    canale: 'assistente vocale',
  });

  if (!esito.ok) {
    return Response.json({ success: false, code: esito.codice, message: esito.messaggio }, { status: esito.stato });
  }

  // Conferma WhatsApp alla cliente (non blocca la prenotazione). Al telefono
  // serve: la cliente non ha niente di scritto in mano.
  confermaSuWhatsApp(esito.appuntamento.id);

  return Response.json({
    success: true,
    message: esito.messaggio,
    appointment: esito.appuntamento,
  });
}
