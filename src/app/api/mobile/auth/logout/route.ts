/**
 * Uscita dall'app: il token viene invalidato lato server, non solo cancellato
 * dal telefono — altrimenti chi se lo fosse copiato continuerebbe a entrare.
 */

import { chiudiSessione, tokenDaRichiesta } from '@/lib/mobileAuth';

export async function POST(req: Request) {
  const token = tokenDaRichiesta(req);
  if (token) await chiudiSessione(token);
  return Response.json({ success: true });
}
