/**
 * Le clienti che stanno scivolando via, per il pannello del gestionale.
 * Protetta dal segreto dei job: è roba della titolare, non del pubblico.
 */

import { clientiARischio } from '@/lib/engines/churn';

export async function GET(request: Request) {
  const secret = process.env.JOBS_SECRET || process.env.VOICE_API_SECRET;
  const header = request.headers.get('authorization') || '';
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const rischi = await clientiARischio();
  return Response.json({
    totale: rischi.length,
    alto: rischi.filter((r) => r.rischio === 'alto').length,
    clienti: rischi,
  });
}
