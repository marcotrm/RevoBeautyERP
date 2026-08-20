/**
 * Che versione del gestionale sta girando adesso sul server.
 *
 * Serve a un problema che si vede solo dal vivo: quando esce una versione
 * nuova, le pagine già aperte restano quelle vecchie e ogni tasto che parla col
 * server smette di funzionare in silenzio — Next non trova più le "azioni" di
 * quella build e risponde con un errore che l'utente non vede mai. Dall'altra
 * parte c'è una ragazza che preme "Crea Appuntamento" e non succede niente.
 *
 * Il valore è l'istante di avvio del container: ogni deploy fa ripartire il
 * server, quindi cambia da solo, senza doversi ricordare di aggiornare un
 * numero di versione a mano.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AVVIATO_ALLE = new Date().toISOString();

export async function GET() {
  return Response.json(
    { versione: AVVIATO_ALLE },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
