/**
 * Chi è collegato adesso. L'app la chiama all'avvio per capire se la sessione
 * salvata sul telefono vale ancora: se no, si torna alla schermata di accesso.
 */

import { clienteDaToken, tokenDaRichiesta, passwordImpostata } from '@/lib/mobileAuth';
import { utenteApp } from '@/lib/mobileUser';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return Response.json({
    user: utenteApp(cliente),
    // L'app tiene chiusa la porta finché la password non c'è
    passwordDaImpostare: !(await passwordImpostata(cliente.id)),
  });
}
