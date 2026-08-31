export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Quali modelli ci dà davvero ogni chiave.
 *
 * I nomi dei modelli cambiano più in fretta della documentazione, e sbagliarne
 * uno non dà un risultato peggiore: dà un errore che sembra un giudizio sul
 * modello. Meglio chiedere all'anagrafe prima di correre.
 *
 * Nessuna chiave viene stampata: escono solo i nomi che tornano indietro.
 */
export async function GET() {
  const fuori: Record<string, unknown> = {};

  if (process.env.GEMINI_API_KEY) {
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } }
      );
      const d = (await r.json()) as { models?: Array<{ name?: string }> };
      fuori.gemini = r.ok
        ? (d.models || [])
            .map(m => (m.name || '').replace('models/', ''))
            .filter(n => n.includes('flash'))
        : { errore: r.status, corpo: JSON.stringify(d).slice(0, 300) };
    } catch (e) {
      fuori.gemini = { errore: e instanceof Error ? e.message : String(e) };
    }
  } else {
    fuori.gemini = 'manca GEMINI_API_KEY';
  }

  if (process.env.Z_AI_API) {
    try {
      const r = await fetch('https://api.z.ai/api/paas/v4/models', {
        headers: { Authorization: `Bearer ${process.env.Z_AI_API}` },
      });
      const d = (await r.json()) as { data?: Array<{ id?: string }> };
      fuori.zai = r.ok
        ? (d.data || []).map(m => m.id).filter(Boolean)
        : { errore: r.status, corpo: JSON.stringify(d).slice(0, 300) };
    } catch (e) {
      fuori.zai = { errore: e instanceof Error ? e.message : String(e) };
    }
  } else {
    fuori.zai = 'manca Z_AI_API';
  }

  fuori.anthropic = process.env.ANTHROPIC_API_KEY ? 'chiave presente' : 'manca ANTHROPIC_API_KEY';

  console.log(`banco di prova, modelli disponibili: ${JSON.stringify(fuori)}`);
  return Response.json(fuori);
}
