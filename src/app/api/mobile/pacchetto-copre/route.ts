/**
 * "Questa seduta è inclusa nel mio pacchetto?" — la domanda che l'app fa
 * mentre la cliente sceglie il trattamento, per mostrare 0 € e la scritta
 * giusta PRIMA della conferma. Stesso criterio della prenotazione vera.
 */

import { prisma } from '@/lib/prisma';
import { clienteDaToken, tokenDaRichiesta } from '@/lib/mobileAuth';
import { pacchettiAttivi, pacchettoCheCopre } from '@/lib/pacchettoInPrenotazione';

export async function GET(req: Request) {
  const cliente = await clienteDaToken(tokenDaRichiesta(req));
  if (!cliente) {
    return Response.json({ error: 'Sessione scaduta.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const ids = (new URL(req.url).searchParams.get('treatmentIds') || '')
    .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (ids.length === 0) return Response.json({ coperture: {} });

  const [trattamenti, pacchetti] = await Promise.all([
    prisma.treatment.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    pacchettiAttivi(cliente.id),
  ]);

  // Stessa prenotazione = le sedute promesse si scalano man mano, come al
  // create. La risposta è NELL'ORDINE della richiesta: due pressoterapie
  // nella stessa seduta hanno lo stesso id ma coperture diverse.
  const impegnate = new Map<string, number>();
  const coperture = ids.map((id) => {
    const t = trattamenti.find((x) => x.id === id);
    const cov = t ? pacchettoCheCopre(cliente.id, t.name, pacchetti, impegnate) : null;
    if (cov) impegnate.set(cov.packageName, (impegnate.get(cov.packageName) ?? 0) + 1);
    return cov ? { pacchetto: cov.packageName, rimaste: cov.rimaste } : null;
  });

  return Response.json({ coperture });
}
