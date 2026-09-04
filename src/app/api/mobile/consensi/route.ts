/**
 * I consensi dell'app: la cliente li vede, li dà e li revoca da sola.
 * Revocare è facile quanto concedere — è il punto di tutto il modulo.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { TESTI_CONSENSI, impostaConsenso, registraAccesso } from '@/lib/estetica';

const NOMI: Record<string, string> = {
  'checkup': 'Dati del check-up estetico',
  'foto-percorso': 'Fotografie del percorso',
  'riattivazione': 'Promemoria se non prenoto da tempo',
};

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const righe = await prisma.consensoApp.findMany({ where: { clientId: cliente.id } });
  const perTipo = new Map(righe.map((r) => [r.tipo, r]));

  return Response.json({
    consensi: Object.keys(TESTI_CONSENSI).map((tipo) => {
      const r = perTipo.get(tipo);
      return {
        tipo,
        nome: NOMI[tipo] ?? tipo,
        testo: TESTI_CONSENSI[tipo],
        concesso: Boolean(r?.concesso),
        concessoIl: r?.concessoIl ?? null,
        revocatoIl: r?.revocatoIl ?? null,
      };
    }),
  });
}

export async function POST(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tipo = String(body?.tipo ?? '');
  const concesso = body?.concesso === true;

  if (!TESTI_CONSENSI[tipo]) {
    return Response.json({ error: 'Consenso sconosciuto.' }, { status: 400 });
  }

  await impostaConsenso(cliente.id, tipo, concesso);
  await registraAccesso('cliente', cliente.id, concesso ? 'consenso-concesso' : 'consenso-revocato', tipo);

  return Response.json({ ok: true });
}
