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

import { preparaCodice, entraDirettamente, serveIlCodice, eNumeroDiProva, statoPassword, OTP_DURATA_MIN } from '@/lib/mobileAuth';
import { utenteApp } from '@/lib/mobileUser';
import { prisma } from '@/lib/prisma';
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

  /*
    La password, quando c'è, viene prima di tutto: il numero da solo dice
    chi sei, non che sei tu — chiunque conosca il numero di una cliente
    potrebbe entrarle nell'account. Chi l'ha creata entra da
    /auth/login-password; l'app, vedendo `richiedePassword`, mostra il
    campo. Il codice WhatsApp resta la via di recupero.
  */
  const stato = await statoPassword(telefono);
  if (stato.ok && stato.haPassword) {
    return Response.json({ ok: true, richiedePassword: true, inviato: false, scadeTraMinuti: 0, nome: stato.nome });
  }

  /*
    Accesso col solo numero.

    Il centro l'ha chiesto: chi scarica l'app e' gia' cliente, e il codice su
    WhatsApp arrivava solo a chi aveva scritto nelle ultime 24 ore. Fuori da
    quella finestra serve un modello approvato da Meta che non esiste, e la
    richiesta moriva con "(#132001) Template name does not exist": tutte le
    altre restavano fuori senza capire perche'.

    La sessione nasce qui, e la risposta ha la stessa forma di quella di
    verify-otp piu' il contrassegno `accessoDiretto`. L'app che lo vede entra
    e basta; una versione vecchia non lo legge e mostra la schermata del
    codice, cioe' esattamente quello che faceva prima.

    Si rimette il codice con APP_CLIENTI_CHIEDI_CODICE=1, senza ricompilare
    l'app: vedi `serveIlCodice`.
  */
  if (!serveIlCodice()) {
    const entrata = await entraDirettamente(telefono);
    if (!entrata.ok) {
      const status = entrata.code === 'USER_NOT_FOUND' ? 404 : 400;
      return Response.json({ error: entrata.error, code: entrata.code }, { status });
    }
    const cliente = await prisma.client.findUnique({ where: { id: entrata.clientId } });
    if (!cliente) {
      return Response.json({ error: 'Scheda cliente non trovata.', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    // Traccia dell'ingresso: senza codice questa riga e' l'unica cosa che
    // resta per ricostruire chi e' entrato e quando, il giorno che serve.
    console.log(`[app clienti] accesso diretto · ${entrata.clientId} · ${entrata.nome}`);
    return Response.json({
      ok: true,
      accessoDiretto: true,
      inviato: false,
      scadeTraMinuti: 0,
      nome: entrata.nome,
      token: entrata.token,
      user: utenteApp(cliente),
      // Prima volta senza password: l'app la fa creare subito
      passwordDaImpostare: true,
    });
  }

  const esito = await preparaCodice(telefono);
  if (!esito.ok) {
    const status = esito.code === 'USER_NOT_FOUND' ? 404 : esito.code === 'TOO_MANY' ? 429 : 400;
    return Response.json({ error: esito.error, code: esito.code, attesa: esito.attesa }, { status });
  }

  // Il numero della verifica Apple: il codice e' gia' quello fisso, e non deve
  // partire nessun messaggio. Chi rivede l'app lo legge dalla scheda su App
  // Store Connect, non dal telefono.
  if (eNumeroDiProva(esito.phone)) {
    return Response.json({ ok: true, inviato: false, scadeTraMinuti: OTP_DURATA_MIN, nome: esito.nome });
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
