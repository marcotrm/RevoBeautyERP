/**
 * Invio email transazionali via Resend (REST API, nessuna dipendenza extra).
 *
 * Richiede la variabile d'ambiente RESEND_API_KEY.
 * Il mittente si configura con INAUGURAZIONE_FROM (default: noreply@revobeauty.it),
 * il dominio deve essere verificato su Resend.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function mailFrom(): string {
  return process.env.INAUGURAZIONE_FROM || 'RevoBeauty <noreply@revobeauty.it>';
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Nessuna chiave configurata: non blocchiamo il salvataggio del lead.
    console.warn('[mail] RESEND_API_KEY non impostata: email non inviata.');
    return { ok: false, error: 'RESEND_API_KEY mancante' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[mail] Resend error', res.status, text);
      return { ok: false, error: `Resend ${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[mail] Resend fetch failed', err);
    return { ok: false, error: 'Invio email fallito' };
  }
}

// ── Template email di conferma coupon inaugurazione ──────────────────
export function confirmEmailHtml(params: {
  firstName: string;
  treatmentLabel: string;
  confirmUrl: string;
}): string {
  const { firstName, treatmentLabel, confirmUrl } = params;
  const gold = '#b59b53';
  const dark = '#7a1230'; // bordeaux banner
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(181,155,83,0.12);">
        <tr><td style="background:${dark};padding:28px 32px;text-align:center;">
          <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">REVO<span style="color:${gold};">BEAUTY</span></div>
          <div style="color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:6px;">Innovazione &amp; Bellezza</div>
        </td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${gold};margin:0 0 12px;font-weight:bold;">Nuova Apertura</p>
          <h1 style="font-size:24px;margin:0 0 16px;color:#1a1a1a;">Ciao ${escapeHtml(firstName)}, conferma il tuo coupon</h1>
          <p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 12px;">
            Grazie per aver richiesto il tuo <strong>trattamento in omaggio</strong> per l'inaugurazione RevoBeauty.
          </p>
          <p style="font-size:15px;line-height:1.6;color:#4a4a4a;margin:0 0 24px;">
            Trattamento scelto: <strong style="color:${dark};">${escapeHtml(treatmentLabel)}</strong>.<br/>
            Conferma il tuo indirizzo email per attivare il coupon:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;"><tr><td align="center" style="border-radius:10px;background:${gold};">
            <a href="${confirmUrl}" style="display:inline-block;padding:15px 40px;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:10px;">Conferma il coupon</a>
          </td></tr></table>
          <p style="font-size:12px;line-height:1.6;color:#9a9a9a;margin:0 0 8px;">
            Se il pulsante non funziona, copia e incolla questo link nel browser:<br/>
            <a href="${confirmUrl}" style="color:${gold};word-break:break-all;">${confirmUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f0ebe0;">
          <p style="font-size:11px;line-height:1.6;color:#b0b0b0;margin:12px 0 0;">
            Se non hai richiesto tu questo coupon puoi ignorare questa email.<br/>
            &copy; RevoBeauty — Innovazione &amp; Bellezza
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
