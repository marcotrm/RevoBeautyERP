import { prisma } from '@/lib/prisma';
import { siteBaseUrl } from '@/lib/inaugurazione';

export const runtime = 'nodejs';

// Conferma email (double opt-in): l'utente clicca il link ricevuto via email.
// Aggiorna lo stato del lead a "confirmed" e reindirizza al sito con esito.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const site = siteBaseUrl();

  const redirect = (stato: string) =>
    Response.redirect(`${site}/coupon/?stato=${stato}`, 302);

  if (!token) return redirect('nonvalido');

  const lead = await prisma.inaugurationLead.findUnique({ where: { confirmToken: token } });
  if (!lead) return redirect('nonvalido');

  if (lead.status === 'confirmed') return redirect('gia-confermato');

  try {
    await prisma.inaugurationLead.update({
      where: { id: lead.id },
      data: { status: 'confirmed', confirmedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[inaugurazione/confirm] update failed', err);
    return redirect('errore');
  }

  return redirect('confermato');
}
