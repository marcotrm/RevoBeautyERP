/**
 * Primo passo dell'accesso all'app: la cliente scrive il numero, qui parte il
 * codice su WhatsApp.
 *
 * Il codice non torna mai nella risposta — se tornasse, chiunque conosca un
 * numero potrebbe entrare senza avere il telefono in mano. L'unica eccezione è
 * in sviluppo, dove WhatsApp non è configurato e senza codice non si potrebbe
 * provare nulla.
 *
 * Due strade per farlo arrivare, in quest'ordine:
 *
 *  1. Se la cliente ci ha scritto nelle ultime 24 ore la finestra di servizio
 *     Meta è aperta e basta un messaggio normale: arriva subito e non costa
 *     niente. È il caso di chi sta chattando col centro proprio in quel momento.
 *
 *  2. Fuori dalla finestra serve un template approvato. E qui c'è un vincolo
 *     che non dipende da noi: Meta pretende che un codice usa-e-getta stia in
 *     un template di categoria AUTHENTICATION (un UTILITY con dentro un codice
 *     viene respinto con INCORRECT_CATEGORY), e quella categoria è concessa
 *     solo alle aziende che hanno completato la verifica nel Business Manager.
 *     Finché la verifica non c'è, questa seconda strada non è percorribile.
 */

import { preparaCodice, OTP_DURATA_MIN } from '@/lib/mobileAuth';
import { sendD360Template, sendD360Text } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';
import { conversationWindow, logOutbound } from '@/lib/wa-conversations';
import { waProvider } from '@/lib/whatsapp';

/** Il messaggio a testo libero, quando la finestra è aperta. */
function testoCodice(codice: string): string {
  return [
    `Il tuo codice per entrare nell'app RevoBeauty è ${codice}`,
    `Vale ${OTP_DURATA_MIN} minuti e si usa una volta sola. Non condividerlo con nessuno: chi ce l'ha entra nel tuo account.`,
    'Se non hai chiesto tu di accedere, ignora questo messaggio.',
  ].join('\n');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const telefono = String(body?.telefono || body?.phone || '');

  const esito = await preparaCodice(telefono);
  if (!esito.ok) {
    const status = esito.code === 'USER_NOT_FOUND' ? 404 : esito.code === 'TOO_MANY' ? 429 : 400;
    return Response.json({ error: esito.error, code: esito.code, attesa: esito.attesa }, { status });
  }

  // Senza WhatsApp configurato (sviluppo) il codice si legge dai log del
  // server e torna nella risposta: è l'unico modo per provare il flusso.
  if (!waProvider()) {
    console.warn(`[app clienti] WhatsApp non configurato — codice per ${esito.phone}: ${esito.codice}`);
    return Response.json({
      ok: true,
      inviato: false,
      scadeTraMinuti: OTP_DURATA_MIN,
      codiceDiProva: esito.codice,
      avviso: 'WhatsApp non è configurato su questo server: il codice è qui perché siamo in sviluppo.',
    });
  }

  // 1) Finestra aperta: messaggio normale.
  const finestra = await conversationWindow(esito.phone);
  if (finestra.open) {
    // Si manda col client grezzo e si logga a parte: sendWhatsApp scriverebbe
    // il testo nel registro conversazioni, e quel registro lo legge lo staff
    // dal gestionale. Un codice di accesso non è cosa loro.
    const libero = await sendD360Text(esito.phone, testoCodice(esito.codice));
    await logOutbound({
      phone: esito.phone,
      text: "Codice di accesso all'app (non mostrato)",
      source: 'automation',
      messageId: libero.messageId,
      ok: libero.ok,
      error: libero.error,
    });
    if (libero.ok) {
      return Response.json({ ok: true, inviato: true, scadeTraMinuti: OTP_DURATA_MIN, nome: esito.nome });
    }
    console.error('[app clienti] testo libero fallito, provo col template:', libero.error);
  }

  // 2) Fuori dalla finestra: template approvato.
  const tpl = WA_TEMPLATES.codiceApp;
  const res = await sendD360Template(esito.phone, tpl.name, {
    language: tpl.language,
    bodyParams: [esito.codice],
  });

  await logOutbound({
    phone: esito.phone,
    text: 'Codice di accesso all\'app (non mostrato)',
    source: 'automation',
    messageId: res.messageId,
    ok: res.ok,
    error: res.error,
  });

  if (!res.ok) {
    return Response.json(
      { error: 'Non siamo riusciti a mandarti il codice su WhatsApp. Riprova fra poco.', code: 'UNKNOWN', dettaglio: res.error },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, inviato: true, scadeTraMinuti: OTP_DURATA_MIN, nome: esito.nome });
}
