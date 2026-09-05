/**
 * Le foto del percorso, dal telefono della cliente.
 *
 * Regole ferree: serve il consenso attivo, il percorso deve essere SUO,
 * e può eliminare solo le foto che ha caricato lei — quelle scattate in
 * centro le gestisce il centro. Ogni tocco finisce nell'audit.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { consensoAttivo, registraAccesso } from '@/lib/estetica';
import { salvaFoto, eliminaFotoStorage } from '@/lib/fotoStorage';

const MAX_BYTE = 500 * 1024; // base64 già compressa dal telefono

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!(await consensoAttivo(cliente.id, 'foto-percorso'))) {
    return Response.json(
      { error: 'Per caricare le foto serve il consenso, che puoi dare o revocare dai tuoi consensi.', code: 'CONSENSO_MANCANTE' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const percorsoId = String(body?.percorsoId ?? '');
  const area = String(body?.area ?? '').trim().slice(0, 60);
  const immagine = String(body?.immagine ?? '');

  if (!percorsoId || !area) {
    return Response.json({ error: 'Indica il percorso e l\'area fotografata.' }, { status: 400 });
  }
  if (!immagine.startsWith('data:image/') || immagine.length > MAX_BYTE) {
    return Response.json({ error: 'La foto non è valida o è troppo grande.' }, { status: 400 });
  }

  // Il percorso deve appartenere a chi carica: senza questo controllo un
  // token valido potrebbe scrivere nel percorso di un'altra.
  const percorso = await prisma.percorsoEstetico.findFirst({
    where: { id: percorsoId, clientId: cliente.id },
    select: { id: true },
  });
  if (!percorso) {
    return Response.json({ error: 'Percorso non trovato.' }, { status: 404 });
  }

  const ora = new Date().toISOString();
  // Nel bucket se c'è, in tabella se no: la cliente non deve saperlo.
  const nelBucket = await salvaFoto(immagine, `percorsi/${percorsoId}`).catch(() => null);
  const foto = await prisma.fotoPercorso.create({
    data: {
      percorsoId, clientId: cliente.id, area, immagine: nelBucket ?? immagine,
      scattataIl: ora.slice(0, 10), origine: 'cliente', createdAt: ora,
    },
  });
  await registraAccesso('cliente', cliente.id, 'foto-caricata', foto.id);

  return Response.json({ ok: true, id: foto.id });
}

export async function DELETE(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? '');

  const foto = await prisma.fotoPercorso.findFirst({
    where: { id, clientId: cliente.id },
    select: { id: true, origine: true },
  });
  if (!foto) {
    return Response.json({ error: 'Foto non trovata.' }, { status: 404 });
  }
  if (foto.origine !== 'cliente') {
    return Response.json(
      { error: 'Questa foto è stata scattata in centro: chiedi a noi e la togliamo subito.', code: 'PERMESSO_NEGATO' },
      { status: 403 }
    );
  }

  const daCancellare = await prisma.fotoPercorso.findUnique({ where: { id: foto.id }, select: { immagine: true } });
  await prisma.fotoPercorso.delete({ where: { id: foto.id } });
  if (daCancellare) await eliminaFotoStorage(daCancellare.immagine);
  await registraAccesso('cliente', cliente.id, 'foto-eliminata', id);

  return Response.json({ ok: true });
}
