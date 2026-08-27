/**
 * Il modulo del sito che finisce in gestionale.
 *
 * Prima di questa route il modulo di revobeauty.it/contatti non inviava
 * niente: mostrava «Messaggio Inviato!» e svuotava i campi. Chi ha scritto dal
 * sito non ha mai ricevuto risposta perché la richiesta non è mai arrivata.
 *
 * Accetta sia JSON sia il classico invio di form (`application/x-www-form-urlencoded`
 * o `multipart/form-data`): il tema di WordPress può postare in PHP lato server
 * — la via consigliata, perché non dipende dal CORS e non espone niente — o in
 * JavaScript dal browser, e questa route regge entrambe.
 *
 * Risponde sempre in fretta: il messaggio WhatsApp parte per conto suo. Un
 * modulo che resta a girare tre secondi perché sta aspettando Meta è un modulo
 * che la gente ricarica, e ricaricare significa mandarlo due volte.
 */

import { after } from 'next/server';
import {
  validaContatto, salvaLead, avvisaCentro, contattaLead, corsLead, segretoLeadValido,
} from '@/lib/lead';
import { getWaAutomationsConfig } from '@/lib/wa-automations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsLead(request.headers.get('origin')) });
}

/** Il corpo, qualunque forma abbia scelto il sito. */
async function leggiCorpo(request: Request): Promise<Record<string, unknown> | null> {
  const tipo = request.headers.get('content-type') || '';
  try {
    if (tipo.includes('application/json')) {
      return (await request.json()) as Record<string, unknown>;
    }
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const headers = { ...corsLead(request.headers.get('origin')), 'Content-Type': 'application/json' };

  if (!segretoLeadValido(request)) {
    return Response.json({ ok: false, message: 'Non autorizzato' }, { status: 401, headers });
  }

  const corpo = await leggiCorpo(request);
  const parsed = validaContatto(corpo);

  if (!parsed.ok) {
    // Al robot si risponde come se fosse andato tutto bene: dirgli che è stato
    // riconosciuto è l'unico modo per aiutarlo a non farsi riconoscere.
    if ('robot' in parsed) {
      return Response.json({ ok: true, message: 'Grazie, ti ricontattiamo a breve.' }, { status: 200, headers });
    }
    return Response.json({ ok: false, message: parsed.errore }, { status: 400, headers });
  }

  let esito;
  try {
    esito = await salvaLead(parsed.dati);
  } catch (err) {
    console.error('[api/lead] salvataggio fallito', err);
    return Response.json(
      { ok: false, message: 'Non siamo riusciti a salvare la richiesta. Riprova o chiamaci.' },
      { status: 500, headers }
    );
  }

  /*
    L'avviso al centro e il primo messaggio girano DOPO la risposta.

    Non è solo per la velocità: una promessa lasciata a penzolare dopo che la
    route ha già restituito la risposta non ha nessuna garanzia di arrivare
    fino in fondo, e il messaggio che dovrebbe verificare il numero potrebbe
    semplicemente non partire mai. `after` è la promessa che il lavoro finisce.
  */
  const dati = parsed.dati;
  const leadId = esito.id;
  const duplicato = esito.duplicato;

  after(async () => {
    avvisaCentro(dati);

    /*
      Il primo messaggio parte solo se la segretaria è accesa.

      Con la segretaria spenta aprirebbe una conversazione a cui non risponde
      nessuno finché il centro non apre il gestionale: meglio il contatto in
      elenco, con l'avviso in pagina che dice di scrivergli, che un «ciao,
      dimmi pure» lasciato a metà per due giorni.
    */
    const cfg = await getWaAutomationsConfig().catch(() => null);
    if (cfg?.segretaria && !duplicato) {
      const inviato = await contattaLead(leadId).catch(err => {
        console.error('[api/lead] primo contatto fallito', err);
        return null;
      });
      if (inviato && !inviato.inviato) {
        console.log(`[api/lead] ${leadId}: primo messaggio non partito (${inviato.motivo})`);
      }
    }
  });

  return Response.json(
    {
      ok: true,
      id: esito.id,
      duplicato: esito.duplicato,
      message: esito.duplicato
        ? 'Abbiamo già la tua richiesta: ti ricontattiamo a breve.'
        : 'Grazie! Ti scriviamo su WhatsApp per fissare l\'appuntamento.',
    },
    { status: esito.duplicato ? 200 : 201, headers }
  );
}
