/**
 * La cliente crea (o cambia) la propria password, da dentro l'app.
 * Serve la sessione: la password la imposta chi è già entrato — la prima
 * volta con il numero, poi per cambiarla quando vuole.
 */

import { clienteDaToken, tokenDaRichiesta, impostaPassword, passwordValida } from '@/lib/mobileAuth';

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password || '');
  if (!passwordValida(password)) {
    return Response.json({ error: 'La password deve avere almeno 8 caratteri.', code: 'VALIDATION' }, { status: 400 });
  }

  const salvata = await impostaPassword(cliente.id, password);
  if (!salvata) {
    return Response.json({ error: 'Non siamo riusciti a salvare la password.', code: 'UNKNOWN' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
