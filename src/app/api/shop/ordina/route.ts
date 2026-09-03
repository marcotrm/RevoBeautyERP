/** Una cliente ordina dei prodotti da ritirare in centro. */
import { creaOrdine } from '@/app/actions/ordini';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: 'Dati mancanti' }, { status: 400 });

  const righe = Array.isArray(b.righe)
    ? b.righe
        .filter((r: unknown) => r && typeof r === 'object')
        .map((r: { productId?: unknown; qty?: unknown }) => ({
          productId: String(r.productId || ''),
          qty: Number(r.qty) || 1,
        }))
        .filter((r: { productId: string }) => r.productId)
    : [];

  const esito = await creaOrdine({
    clientName: String(b.clientName || ''),
    phone: String(b.phone || ''),
    email: b.email ? String(b.email) : null,
    note: b.note ? String(b.note) : undefined,
    righe,
  });
  return Response.json(esito, { status: esito.ok ? 200 : 400 });
}
