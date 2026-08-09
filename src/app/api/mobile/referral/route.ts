/** Codice invito, statistiche e registrazione di un nuovo invito. */
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { riepilogoReferral, registraInvito } from '@/lib/referral';
import { leggiConfig } from '@/lib/appSettings';
import { traccia } from '@/lib/appEvents';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const config = await leggiConfig();
  if (!config.funzioni.referral) return Response.json({ error: 'Funzione non attiva.', code: 'NOT_FOUND' }, { status: 404 });

  await traccia({ clientId: cliente.id, type: 'view', surface: 'referral' });
  return Response.json(await riepilogoReferral(cliente.id));
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const esito = await registraInvito({
    inviterClientId: cliente.id,
    nome: body?.nome ? String(body.nome) : undefined,
    telefono: String(body?.telefono || ''),
  });

  if (!esito.ok) return Response.json({ error: esito.error, code: 'VALIDATION' }, { status: 409 });

  await traccia({ clientId: cliente.id, type: 'click', surface: 'referral', itemId: esito.id });
  return Response.json({ ok: true });
}
