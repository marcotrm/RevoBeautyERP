/**
 * Reclamo anonimo dall'app.
 *
 * La sessione serve solo a verificare che a scrivere sia una cliente vera
 * (contro lo spam): l'identità si butta via QUI, prima di salvare. Nel
 * database finiscono categoria, testo e data — nient'altro, e non c'è
 * modo di risalire a chi ha scritto.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

const CATEGORIE = ['servizio', 'personale', 'ambiente', 'prezzi', 'app', 'altro'];

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const categoria = String(body?.categoria || '');
  const testo = String(body?.testo || '').trim().slice(0, 2000);

  if (!CATEGORIE.includes(categoria)) {
    return Response.json({ error: 'Scegli una categoria.', code: 'VALIDATION' }, { status: 400 });
  }
  if (testo.length < 10) {
    return Response.json({ error: 'Racconta il problema in almeno due parole.', code: 'VALIDATION' }, { status: 400 });
  }

  // Da qui in giù `cliente` non si usa più: l'anonimato comincia adesso.
  await prisma.reclamo.create({
    data: { categoria, testo, createdAt: new Date().toISOString() },
  });

  return Response.json({ ok: true });
}
