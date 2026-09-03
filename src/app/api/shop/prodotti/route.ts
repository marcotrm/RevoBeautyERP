/** I prodotti ordinabili dalla pagina pubblica: attivi, con giacenza e prezzo. */
import { prodottiOrdinabili } from '@/app/actions/ordini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const prodotti = await prodottiOrdinabili();
  return Response.json({ prodotti });
}
