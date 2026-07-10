import { prisma } from '@/lib/prisma';
import {
  validateLead,
  checkIngestSecret,
  corsHeaders,
  generateConfirmToken,
  confirmUrl,
  treatmentLabel,
} from '@/lib/inaugurazione';
import { sendEmail, confirmEmailHtml } from '@/lib/mail';

export const runtime = 'nodejs';

// Preflight CORS (per il fallback lato browser dal sito)
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// Ingestione di un nuovo lead coupon dal sito revobeauty.it
export async function POST(request: Request) {
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };

  if (!checkIngestSecret(request)) {
    return Response.json({ success: false, message: 'Non autorizzato' }, { status: 401, headers });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateLead(body);
  if (!parsed.ok) {
    return Response.json({ success: false, message: parsed.error }, { status: 400, headers });
  }

  const { firstName, lastName, phone, email, treatment, source } = parsed.data;
  const now = new Date().toISOString();
  const token = generateConfirmToken();

  let lead;
  try {
    lead = await prisma.inaugurationLead.create({
      data: {
        firstName,
        lastName,
        phone,
        email,
        treatment,
        source: source ?? null,
        status: 'pending',
        confirmToken: token,
        createdAt: now,
      },
    });
  } catch (err) {
    console.error('[inaugurazione/lead] create failed', err);
    return Response.json({ success: false, message: 'Errore nel salvataggio' }, { status: 500, headers });
  }

  // Invio email di conferma (double opt-in). Il salvataggio è già avvenuto:
  // anche se l'email fallisce, il lead resta tracciato come "non confermato".
  const email_result = await sendEmail({
    to: email,
    subject: 'Conferma il tuo coupon — Inaugurazione RevoBeauty',
    html: confirmEmailHtml({
      firstName,
      treatmentLabel: treatmentLabel(treatment),
      confirmUrl: confirmUrl(token),
    }),
  });

  return Response.json(
    { success: true, id: lead.id, emailSent: email_result.ok },
    { status: 201, headers }
  );
}
