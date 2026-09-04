/**
 * Il profilo della cliente, da completare come in una vera app.
 *
 * GET  → i campi che può vedere e modificare (foto compresa)
 * POST → aggiorna quello che manda; il resto non si tocca. La cliente
 *        modifica solo cose SUE (foto, email, nascita, indirizzo): nome
 *        e telefono sono l'identità del suo account e si cambiano in
 *        negozio, non da un campo di testo.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return Response.json({
    profilo: {
      nome: cliente.firstName,
      cognome: cliente.lastName,
      telefono: cliente.phone,
      email: cliente.email || '',
      birthDate: cliente.birthDate || '',
      address: cliente.address || '',
      city: cliente.city || '',
      gender: cliente.gender || null,
      avatar: cliente.avatar || null,
    },
  });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Dati mancanti.', code: 'VALIDATION' }, { status: 400 });

  const dati: Record<string, string | null> = {};

  if (typeof body.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Email non valida.', code: 'VALIDATION' }, { status: 400 });
    }
    dati.email = email || null;
  }
  if (typeof body.birthDate === 'string') {
    const d = body.birthDate.trim();
    if (d && !/^\d{2}\/\d{2}\/\d{4}$/.test(d) && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return Response.json({ error: 'Data di nascita nel formato GG/MM/AAAA.', code: 'VALIDATION' }, { status: 400 });
    }
    dati.birthDate = d || null;
  }
  if (typeof body.address === 'string') dati.address = body.address.trim().slice(0, 120) || null;
  if (typeof body.city === 'string') dati.city = body.city.trim().slice(0, 60) || null;
  if (body.gender === 'F' || body.gender === 'M') dati.gender = body.gender;

  if (typeof body.avatar === 'string') {
    if (body.avatar === '') {
      dati.avatar = null; // la foto si può anche togliere
    } else if (body.avatar.startsWith('data:image/') && body.avatar.length <= 300_000) {
      dati.avatar = body.avatar;
    } else {
      return Response.json({ error: 'Foto non valida o troppo pesante.', code: 'VALIDATION' }, { status: 400 });
    }
  }

  if (Object.keys(dati).length === 0) {
    return Response.json({ error: 'Niente da salvare.', code: 'VALIDATION' }, { status: 400 });
  }

  await prisma.client.update({ where: { id: cliente.id }, data: dati });
  return Response.json({ ok: true });
}
