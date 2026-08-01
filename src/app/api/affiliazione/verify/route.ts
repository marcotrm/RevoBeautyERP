/**
 * Verifica del codice OTP: è il momento in cui il contatto diventa vero.
 *
 * A codice giusto succedono tre cose, tutte insieme:
 *  1. il lead passa a "verified" e nasce il voucher del trattamento gratuito;
 *  2. la persona entra in anagrafica clienti, marcata con l'affiliato che
 *     l'ha portata (referredBy) — legame permanente, non si cambia più;
 *  3. da qui in poi i suoi incassi in cassa maturano la commissione.
 */

import prisma from '@/lib/prisma';
import { nuovoVoucher, CENTRO } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TENTATIVI = 5;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const leadId = String(body?.leadId || '');
  const codice = String(body?.code || '').replace(/\D/g, '');
  const marketing = Boolean(body?.marketing);

  if (!leadId || codice.length !== 6) {
    return Response.json({ ok: false, error: 'Inserisci il codice a 6 cifre.' }, { status: 400 });
  }

  const lead = await prisma.affiliateLead.findUnique({
    where: { id: leadId },
    include: { affiliate: { select: { businessName: true } } },
  });
  if (!lead) return Response.json({ ok: false, error: 'Registrazione non trovata.' }, { status: 404 });

  if (lead.status === 'verified') {
    // Doppio tap sul bottone: si risponde con lo stesso voucher, senza errori.
    return Response.json({ ok: true, voucher: lead.voucherCode, centro: CENTRO });
  }
  if (lead.status !== 'otp') {
    return Response.json({ ok: false, error: 'Questa registrazione non è più valida.' }, { status: 410 });
  }
  if (lead.otpAttempts >= MAX_TENTATIVI) {
    return Response.json({ ok: false, error: 'Troppi tentativi. Richiedi un nuovo codice.' }, { status: 429 });
  }
  if (!lead.otpExpiresAt || new Date(lead.otpExpiresAt).getTime() < Date.now()) {
    return Response.json({ ok: false, error: 'Il codice è scaduto. Richiedine uno nuovo.' }, { status: 410 });
  }

  if (lead.otpCode !== codice) {
    await prisma.affiliateLead.update({ where: { id: lead.id }, data: { otpAttempts: { increment: 1 } } });
    const restanti = MAX_TENTATIVI - lead.otpAttempts - 1;
    return Response.json({
      ok: false,
      error: restanti > 0 ? `Codice sbagliato. Hai ancora ${restanti} tentativ${restanti === 1 ? 'o' : 'i'}.` : 'Codice sbagliato. Richiedi un nuovo codice.',
    }, { status: 401 });
  }

  // --- Codice giusto: cliente in anagrafica + voucher -------------------

  const adesso = new Date().toISOString();
  const cliente = await prisma.client.create({
    data: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      gdprConsent: true,
      marketingConsent: marketing,
      // Il legame con l'affiliato è permanente: si scrive qui e non si tocca più.
      referredBy: `Affiliato: ${lead.affiliate.businessName}`,
      tags: ['affiliazione'],
      createdAt: adesso.split('T')[0],
    },
  });

  const voucher = nuovoVoucher();
  await prisma.affiliateLead.update({
    where: { id: lead.id },
    data: {
      status: 'verified',
      verifiedAt: adesso,
      otpCode: null,
      voucherCode: voucher,
      clientId: cliente.id,
    },
  });

  return Response.json({ ok: true, voucher, centro: CENTRO });
}
