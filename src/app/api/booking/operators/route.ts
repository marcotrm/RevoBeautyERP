import { operatriciSelezionabili } from '@/lib/bookingEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Le operatrici che la cliente può chiedere nella prenotazione online. */
export async function GET() {
  return Response.json({ operators: await operatriciSelezionabili() });
}
