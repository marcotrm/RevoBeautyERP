/**
 * I percorsi estetici, lato pannello: qui l'operatrice crea il percorso,
 * registra le sedute coi progressi e gestisce le foto. Tutto quello che
 * scrive porta autore e data — «di nessuno» non esiste.
 */

import { prisma } from '@/lib/prisma';
import { registraAccesso } from '@/lib/estetica';
import { salvaFoto, eliminaFotoStorage, urlFoto } from '@/lib/fotoStorage';

const adesso = () => new Date().toISOString();
const testo = (v: unknown, max = 2000) => String(v ?? '').trim().slice(0, max) || null;

export async function GET(request: Request) {
  const url = new URL(request.url);

  // ?clienti=maria → ricerca in anagrafica per il modulo "nuovo percorso".
  const cerca = url.searchParams.get('clienti');
  if (cerca !== null) {
    const q = cerca.trim();
    if (q.length < 2) return Response.json({ clienti: [] });
    const clienti = await prisma.client.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      take: 8,
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    return Response.json({
      clienti: clienti.map((c) => ({ id: c.id, nome: `${c.firstName} ${c.lastName}`.trim(), telefono: c.phone })),
    });
  }

  const clientId = url.searchParams.get('clientId');

  const percorsi = await prisma.percorsoEstetico.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: {
      sedute: { orderBy: { numero: 'asc' } },
      foto: { orderBy: { scattataIl: 'asc' }, select: { id: true, area: true, scattataIl: true, origine: true, sedutaId: true, immagine: true } },
    },
  });

  // Le chiavi del bucket diventano link firmati anche per il pannello.
  const conUrl = await Promise.all(percorsi.map(async (p) => ({
    ...p,
    foto: await Promise.all(p.foto.map(async (f) => ({ ...f, immagine: await urlFoto(f.immagine) }))),
  })));
  return Response.json({ percorsi: conUrl });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Richiesta vuota.' }, { status: 400 });

  const azione = String(body.azione ?? '');
  const operatrice = String(body.operatrice ?? '').trim() || 'centro';
  const ora = adesso();

  // ── Nuovo percorso ──
  if (azione === 'crea') {
    const clientId = String(body.clientId ?? '');
    const cliente = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!cliente) return Response.json({ error: 'Cliente non trovata.' }, { status: 404 });

    const nome = testo(body.nome, 120);
    const obiettivo = testo(body.obiettivo, 500);
    const seduteTotali = Math.max(1, Math.min(60, Number(body.seduteTotali) || 0));
    if (!nome || !obiettivo || !body.seduteTotali) {
      return Response.json({ error: 'Servono nome, obiettivo e numero di sedute.' }, { status: 400 });
    }

    const percorso = await prisma.percorsoEstetico.create({
      data: {
        clientId, clientName: `${cliente.firstName} ${cliente.lastName}`.trim(),
        nome, obiettivo,
        descrizione: testo(body.descrizione),
        trattamenti: (Array.isArray(body.trattamenti) ? body.trattamenti : [])
          .map((t: unknown) => ({ nome: String((t as { nome?: string })?.nome ?? t).trim() }))
          .filter((t: { nome: string }) => t.nome) as unknown as object,
        seduteTotali,
        frequenza: testo(body.frequenza, 120),
        dataInizio: String(body.dataInizio ?? ora.slice(0, 10)).slice(0, 10),
        tappe: (Array.isArray(body.tappe) ? body.tappe : [])
          .map((t: { titolo?: string; dopoSeduta?: number }) => ({
            titolo: String(t?.titolo ?? '').trim().slice(0, 120),
            dopoSeduta: Math.max(1, Number(t?.dopoSeduta) || 1),
          }))
          .filter((t: { titolo: string }) => t.titolo) as unknown as object,
        noteCliente: testo(body.noteCliente),
        noteInterne: testo(body.noteInterne),
        mantenimento: testo(body.mantenimento),
        creatoDa: operatrice, createdAt: ora, updatedAt: ora,
      },
    });
    await registraAccesso(operatrice, clientId, 'percorso-creato', percorso.id);
    return Response.json({ ok: true, id: percorso.id });
  }

  // ── Aggiorna un percorso (stato, note, tappe, mantenimento…) ──
  if (azione === 'aggiorna') {
    const id = String(body.id ?? '');
    const esiste = await prisma.percorsoEstetico.findUnique({ where: { id }, select: { id: true, clientId: true } });
    if (!esiste) return Response.json({ error: 'Percorso non trovato.' }, { status: 404 });

    const dati: Record<string, unknown> = { updatedAt: ora };
    if (body.stato !== undefined) {
      const stato = String(body.stato);
      if (!['attivo', 'in_pausa', 'completato', 'mantenimento', 'interrotto'].includes(stato)) {
        return Response.json({ error: 'Stato non valido.' }, { status: 400 });
      }
      dati.stato = stato;
    }
    for (const campo of ['nome', 'descrizione', 'obiettivo', 'frequenza', 'noteCliente', 'noteInterne', 'mantenimento'] as const) {
      if (body[campo] !== undefined) dati[campo] = testo(body[campo], campo === 'nome' ? 120 : 2000);
    }
    if (body.seduteTotali !== undefined) dati.seduteTotali = Math.max(1, Math.min(60, Number(body.seduteTotali) || 1));
    if (body.tappe !== undefined) {
      dati.tappe = (Array.isArray(body.tappe) ? body.tappe : [])
        .map((t: { titolo?: string; dopoSeduta?: number }) => ({
          titolo: String(t?.titolo ?? '').trim().slice(0, 120),
          dopoSeduta: Math.max(1, Number(t?.dopoSeduta) || 1),
        }))
        .filter((t: { titolo: string }) => t.titolo);
    }

    await prisma.percorsoEstetico.update({ where: { id }, data: dati });
    await registraAccesso(operatrice, esiste.clientId, 'percorso-modificato', id);
    return Response.json({ ok: true });
  }

  // ── Registra o aggiorna una seduta (scheda + progressi verificati) ──
  if (azione === 'seduta') {
    const percorsoId = String(body.percorsoId ?? '');
    const percorso = await prisma.percorsoEstetico.findUnique({
      where: { id: percorsoId },
      select: { id: true, clientId: true, seduteTotali: true, stato: true, sedute: { select: { numero: true } } },
    });
    if (!percorso) return Response.json({ error: 'Percorso non trovato.' }, { status: 404 });

    const comuni = {
      data: String(body.data ?? adesso().slice(0, 10)).slice(0, 10),
      ora: testo(body.oraSeduta, 5),
      operatrice,
      trattamento: testo(body.trattamento, 160) ?? 'Trattamento',
      area: testo(body.area, 120),
      durataMinuti: body.durataMinuti ? Math.max(1, Math.min(600, Number(body.durataMinuti))) : null,
      appointmentId: testo(body.appointmentId, 60),
      osservazioni: testo(body.osservazioni),
      rispostaCliente: testo(body.rispostaCliente),
      misurazioni: (Array.isArray(body.misurazioni) ? body.misurazioni : [])
        .map((m: { nome?: string; valore?: string; unita?: string }) => ({
          nome: String(m?.nome ?? '').trim().slice(0, 60),
          valore: String(m?.valore ?? '').trim().slice(0, 30),
          unita: String(m?.unita ?? '').trim().slice(0, 15),
        }))
        .filter((m: { nome: string; valore: string }) => m.nome && m.valore) as unknown as object,
      indicazioniDopo: testo(body.indicazioniDopo),
      noteInterne: testo(body.noteInterne),
      condivisa: body.condivisa !== false,
      statoControllo: ['da_fissare', 'fissato', 'fatto'].includes(String(body.statoControllo))
        ? String(body.statoControllo) : null,
      updatedAt: ora,
    };

    const idSeduta = String(body.sedutaId ?? '');
    if (idSeduta) {
      const sua = await prisma.sedutaPercorso.findFirst({ where: { id: idSeduta, percorsoId } });
      if (!sua) return Response.json({ error: 'Seduta non trovata.' }, { status: 404 });
      await prisma.sedutaPercorso.update({ where: { id: idSeduta }, data: comuni });
      await registraAccesso(operatrice, percorso.clientId, 'seduta-modificata', idSeduta);
      return Response.json({ ok: true, id: idSeduta });
    }

    const numero = Math.max(0, ...percorso.sedute.map((s) => s.numero)) + 1;
    const seduta = await prisma.sedutaPercorso.create({
      data: { ...comuni, percorsoId, clientId: percorso.clientId, numero, createdAt: ora },
    });
    // Se con questa seduta il percorso è al completo, lo stato segue da solo
    // (ma resta modificabile a mano: la regola serve, l'automatismo no).
    if (numero >= percorso.seduteTotali && percorso.stato === 'attivo') {
      await prisma.percorsoEstetico.update({ where: { id: percorsoId }, data: { stato: 'completato', updatedAt: ora } });
    }
    await registraAccesso(operatrice, percorso.clientId, 'seduta-registrata', seduta.id);
    return Response.json({ ok: true, id: seduta.id, numero });
  }

  // ── Foto dal pannello ──
  if (azione === 'fotoCarica') {
    const percorsoId = String(body.percorsoId ?? '');
    const percorso = await prisma.percorsoEstetico.findUnique({
      where: { id: percorsoId }, select: { id: true, clientId: true },
    });
    if (!percorso) return Response.json({ error: 'Percorso non trovato.' }, { status: 404 });

    const consenso = await prisma.consensoApp.findUnique({
      where: { clientId_tipo: { clientId: percorso.clientId, tipo: 'foto-percorso' } },
    });
    if (!consenso?.concesso) {
      return Response.json(
        { error: 'La cliente non ha (o ha revocato) il consenso alle foto: falle prima firmare il consenso dall\'app.' },
        { status: 403 }
      );
    }

    const immagine = String(body.immagine ?? '');
    if (!immagine.startsWith('data:image/') || immagine.length > 500 * 1024) {
      return Response.json({ error: 'La foto non è valida o è troppo grande.' }, { status: 400 });
    }
    const nelBucket = await salvaFoto(immagine, `percorsi/${percorsoId}`).catch(() => null);
    const foto = await prisma.fotoPercorso.create({
      data: {
        percorsoId, clientId: percorso.clientId,
        sedutaId: testo(body.sedutaId, 60),
        area: testo(body.area, 60) ?? 'Area trattata',
        immagine: nelBucket ?? immagine,
        scattataIl: String(body.scattataIl ?? ora.slice(0, 10)).slice(0, 10),
        origine: operatrice, createdAt: ora,
      },
    });
    await registraAccesso(operatrice, percorso.clientId, 'foto-caricata', foto.id);
    return Response.json({ ok: true, id: foto.id });
  }

  if (azione === 'fotoElimina') {
    const id = String(body.id ?? '');
    const foto = await prisma.fotoPercorso.findUnique({ where: { id }, select: { id: true, clientId: true, immagine: true } });
    if (!foto) return Response.json({ error: 'Foto non trovata.' }, { status: 404 });
    await prisma.fotoPercorso.delete({ where: { id } });
    await eliminaFotoStorage(foto.immagine);
    await registraAccesso(operatrice, foto.clientId, 'foto-eliminata', id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Azione sconosciuta.' }, { status: 400 });
}
