import { sendEmail, mailFrom } from '@/lib/mail';
import { sendWhatsApp, whatsappConfigured, whatsappMissingVars, normalizePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// GET → stato dei canali di notifica (quali sono configurati)
export async function GET() {
  return Response.json({
    email: {
      configured: Boolean(process.env.RESEND_API_KEY),
      from: mailFrom(),
      missing: process.env.RESEND_API_KEY ? [] : ['RESEND_API_KEY'],
    },
    whatsapp: {
      configured: whatsappConfigured(),
      missing: whatsappMissingVars(),
    },
    sms: { configured: false, missing: ['non ancora implementato'] },
  });
}

// POST { channel: 'email' | 'whatsapp', to: string } → invia un messaggio di prova
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const channel = body?.channel;
  const to = String(body?.to || '').trim();
  if (!to || !['email', 'whatsapp'].includes(channel)) {
    return Response.json({ error: 'Servono channel (email|whatsapp) e to' }, { status: 400 });
  }

  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

  if (channel === 'email') {
    const result = await sendEmail({
      to,
      subject: '🧪 Test notifiche RevoBeauty',
      html: `<!DOCTYPE html><html lang="it"><body style="margin:0;padding:32px;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(181,155,83,0.12);">
          <div style="background:#7a1230;padding:24px;text-align:center;">
            <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px;">REVO<span style="color:#b59b53;">BEAUTY</span></div>
          </div>
          <div style="padding:28px;">
            <h1 style="font-size:20px;margin:0 0 12px;color:#1a1a1a;">✅ Le email funzionano!</h1>
            <p style="font-size:14px;line-height:1.6;color:#4a4a4a;margin:0;">
              Questo è un messaggio di prova inviato dal gestionale RevoBeauty il ${now}.<br/><br/>
              Se lo stai leggendo, il canale email è configurato correttamente e possiamo usarlo per campagne marketing, promemoria appuntamenti e conferme.
            </p>
          </div>
        </div>
      </body></html>`,
    });
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }

  // whatsapp
  const number = normalizePhone(to);
  const result = await sendWhatsApp(
    number,
    `🧪 *Test notifiche RevoBeauty*\n\n✅ Se leggi questo messaggio, WhatsApp è configurato correttamente!\n\n🕒 ${now}\n\nPotremo usarlo per: promemoria appuntamenti, campagne promo, auguri di compleanno e recall clienti.`
  );
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
