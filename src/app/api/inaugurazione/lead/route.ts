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
import { notifyNuovaIscrizione } from '@/lib/telegram';
import { ensureGiftPackage } from '@/lib/inaugurationGift';

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

  // Anti-doppione: se questa persona (stesso telefono o email) si è già iscritta,
  // non creiamo un secondo lead. Capita spesso: doppio invio del form o secondo tentativo.
  try {
    const normPhone = (p: string) => (p || '').replace(/[^\d]/g, '').slice(-9);
    const emailLc = (email || '').toLowerCase();
    const existing = await prisma.inaugurationLead.findMany({ select: { id: true, phone: true, email: true } });
    const dup = existing.find(l =>
      (normPhone(l.phone) && normPhone(l.phone) === normPhone(phone)) ||
      (l.email && emailLc && l.email.toLowerCase() === emailLc)
    );
    if (dup) {
      return Response.json(
        { success: true, id: dup.id, duplicate: true, message: 'Sei già iscritta: ti abbiamo già inviato il coupon.' },
        { status: 200, headers }
      );
    }
  } catch (err) {
    console.error('[inaugurazione/lead] dedup check failed', err);
    // in caso di errore nel controllo proseguiamo comunque con la creazione
  }

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

  // Registra automaticamente il contatto anche in anagrafica Clienti (senza duplicati),
  // così è già disponibile per essere selezionato.
  try {
    const normPhone = (p: string) => (p || '').replace(/[^\d]/g, '').slice(-9);
    const emailLc = (email || '').toLowerCase();
    const clients_full = await prisma.client.findMany({ select: { id: true, phone: true, email: true } });
    const clients = clients_full;
    const already = clients.some(c =>
      (normPhone(c.phone) && normPhone(c.phone) === normPhone(phone)) ||
      (c.email && emailLc && c.email.toLowerCase() === emailLc)
    );
    let clientId: string | null = null;
    if (!already) {
      const createdClient = await prisma.client.create({
        data: {
          firstName: firstName || 'Cliente',
          lastName: lastName || '',
          email: email || null,
          phone: phone || '',
          notes: `Da inaugurazione — interessata a ${treatmentLabel(treatment)}`,
          tags: ['Inaugurazione'],
          marketingConsent: true,
          createdAt: now.split('T')[0],
        },
      });
      clientId = createdClient.id;
    } else {
      const existing = clients_full.find(c =>
        (normPhone(c.phone) && normPhone(c.phone) === normPhone(phone)) ||
        (c.email && emailLc && c.email.toLowerCase() === emailLc)
      );
      clientId = existing?.id ?? null;
    }

    // Assegna subito il pacchetto OMAGGIO del trattamento scelto
    if (clientId) await ensureGiftPackage(clientId, treatment);
  } catch (err) {
    console.error('[inaugurazione/lead] auto-create client failed', err);
    // non blocchiamo la registrazione del lead
  }

  // Notifica Telegram: nuova iscrizione (non blocca la registrazione se fallisce)
  notifyNuovaIscrizione({
    name: `${firstName} ${lastName}`.trim(),
    phone,
    email,
    treatment: treatmentLabel(treatment),
  }).catch(() => {});

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
