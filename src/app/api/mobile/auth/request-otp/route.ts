/**
 * Primo passo dell'accesso all'app: la cliente scrive il numero, qui parte il
 * codice su WhatsApp.
 *
 * Il codice non torna mai nella risposta — se tornasse, chiunque conosca un
 * numero potrebbe entrare senza avere il telefono in mano. L'unica eccezione è
 * in sviluppo, dove WhatsApp non è configurato e senza codice non si potrebbe
 * provare nulla.
 */

import { preparaCodice, OTP_DURATA_MIN } from '@/lib/mobileAuth';
import { sendD360Template } from '@/lib/whatsapp360';
import { WA_TEMPLATES } from '@/lib/wa-templates';
import { logOutbound } from '@/lib/wa-conversations';
import { waProvider } from '@/lib/whatsapp';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const telefono = String(body?.telefono || body?.phone || '');

  const esito = await preparaCodice(telefono);
  if (!esito.ok) {
    const status = esito.code === 'USER_NOT_FOUND' ? 404 : esito.code === 'TOO_MANY' ? 429 : 400;
    return Response.json({ error: esito.error, code: esito.code, attesa: esito.attesa }, { status });
  }

  const tpl = WA_TEMPLATES.codiceApp;

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

  const res = await sendD360Template(esito.phone, tpl.name, {
    language: tpl.language,
    bodyParams: [esito.codice],
  });

  await logOutbound({
    phone: esito.phone,
    // Nel registro conversazioni non finisce il codice: quel registro lo legge
    // lo staff dal gestionale, e un codice di accesso non è cosa loro.
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
