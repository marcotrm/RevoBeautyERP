import { NextResponse, type NextRequest } from 'next/server';

/**
 * Intestazioni CORS per le API usate dall'app clienti.
 *
 * L'app installata sul telefono non ne ha bisogno — React Native non applica
 * le regole di origine del browser — ma la stessa app girata come pagina web
 * (Expo web, che è il modo più rapido per provarla dal computer) parte da una
 * porta diversa da quella del gestionale: senza queste intestazioni il browser
 * blocca ogni chiamata e a schermo si legge solo "impossibile contattare il
 * server", che non dice niente su cosa sia successo davvero.
 *
 * Aprire a qualsiasi origine qui non espone niente: queste API si autenticano
 * col token nell'header `Authorization`, non con i cookie, quindi un sito
 * ostile non può farsi passare per la cliente collegata semplicemente
 * chiamandole dal browser di lei. Stesso discorso per /api/booking, che è già
 * pubblico perché lo usa la pagina di prenotazione del sito. Il resto del
 * gestionale non è toccato.
 */
export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';

  const intestazioni = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  // Richiesta di verifica che il browser manda prima di quella vera
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: intestazioni });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(intestazioni)) res.headers.set(k, v);
  return res;
}

export const config = {
  // L'app clienti non usa solo /api/mobile: l'elenco dei trattamenti e gli
  // orari liberi arrivano da /api/booking, gli stessi che serve il sito.
  matcher: ['/api/mobile/:path*', '/api/booking/:path*'],
};
