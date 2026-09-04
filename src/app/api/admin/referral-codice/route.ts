/**
 * Il codice invito detto al banco: l'operatrice lo scrive nella scheda
 * della nuova cliente e il benvenuto (5 €) arriva subito nel suo wallet,
 * spendibile già alla prima cassa. Il premio di chi ha invitato matura
 * come sempre al primo incasso vero, in automatico.
 */

import { collegaCodiceInvito } from '@/lib/referral';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const esito = await collegaCodiceInvito({
    clientId: String(body?.clientId || ''),
    codice: String(body?.codice || ''),
    operatore: String(body?.operatore || '') || undefined,
  });
  if (!esito.ok) return Response.json({ error: esito.error }, { status: 400 });
  return Response.json(esito);
}
