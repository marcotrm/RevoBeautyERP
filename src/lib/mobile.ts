import { prisma } from '@/lib/prisma';

// Autenticazione dell'app clienti: il token di sessione arriva nell'header
// Authorization ("Bearer <token>") o, in alternativa, in "x-session-token".
export async function getAccountFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const sessionToken = bearerToken || request.headers.get('x-session-token');

  if (!sessionToken) return null;

  const account = await prisma.mobileAccount.findUnique({
    where: { sessionToken },
    include: { client: true },
  });

  return account;
}

export function unauthorized() {
  return Response.json({ error: 'Non autorizzato.', code: 'UNAUTHORIZED' }, { status: 401 });
}
