/**
 * Gli altri due modi di arrivare a una cliente: email e SMS.
 *
 * Finora si andava solo di WhatsApp, e va benissimo finche' funziona. Il
 * problema e' chi non risponde: numero cambiato, WhatsApp mai installato,
 * messaggio finito in un archivio che non apre mai. Quella persona era
 * irraggiungibile, e nessuno se ne accorgeva.
 *
 * Qui dentro non c'e' nessun servizio in particolare: c'e' un modo solo di
 * dire "manda questo", e sotto due fornitori che si accendono quando qualcuno
 * incolla le chiavi. Senza chiavi non si finge di aver mandato: si risponde
 * "non configurato", e chi guarda lo legge.
 *
 * Email: Resend (https://resend.com) — API HTTP, niente SMTP da configurare.
 * SMS: Skebby (https://skebby.it) — italiano, mittente personalizzabile,
 * costo per SMS basso e nessun abbonamento.
 */

export interface EsitoInvio {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface ConfigCanali {
  /** Email */
  emailAttiva: boolean;
  resendApiKey: string;
  emailMittente: string;   // "RevoBeauty <ciao@revobeauty.it>"
  emailRispostaA: string;
  /** SMS */
  smsAttivo: boolean;
  skebbyUser: string;
  skebbyPassword: string;
  smsMittente: string;     // massimo 11 caratteri, alfanumerico
}

export const CONFIG_CANALI_DEFAULT: ConfigCanali = {
  emailAttiva: false,
  resendApiKey: '',
  emailMittente: '',
  emailRispostaA: '',
  smsAttivo: false,
  skebbyUser: '',
  skebbyPassword: '',
  smsMittente: '',
};

/** Un'email, mandata davvero. */
export async function mandaEmail(cfg: ConfigCanali, p: {
  a: string; oggetto: string; testo: string; html?: string;
}): Promise<EsitoInvio> {
  /*
    La chiave puo' stare in due posti: incollata in Impostazioni, oppure gia'
    presente fra le variabili del server (ci arrivavano le email
    dell'inaugurazione). Quella scritta a mano vince, ma se non c'e' si usa
    l'altra invece di dire che non e' configurato niente.
  */
  const chiave = cfg.resendApiKey || process.env.RESEND_API_KEY || '';
  const mittente = cfg.emailMittente || process.env.INAUGURAZIONE_FROM || '';
  if (!cfg.emailAttiva || !chiave || !mittente) {
    return { ok: false, error: 'Email non configurata' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.a)) {
    return { ok: false, error: 'Indirizzo email non valido' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chiave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mittente,
        to: [p.a],
        subject: p.oggetto,
        text: p.testo,
        ...(p.html ? { html: p.html } : {}),
        ...(cfg.emailRispostaA ? { reply_to: cfg.emailRispostaA } : {}),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d as { message?: string }).message || `Resend ha risposto ${res.status}` };
    return { ok: true, id: (d as { id?: string }).id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invio non riuscito' };
  }
}

/**
 * Il numero come lo vuole Skebby: prefisso internazionale, solo cifre.
 * I numeri in rubrica sono quasi tutti italiani e senza prefisso.
 */
export function numeroPerSms(numero: string): string {
  const cifre = String(numero || '').replace(/\D/g, '');
  if (!cifre) return '';
  if (cifre.startsWith('00')) return cifre.slice(2);
  if (cifre.startsWith('39')) return cifre;
  return `39${cifre.replace(/^0+/, '')}`;
}

/** Un SMS. Costa: si manda quando WhatsApp non e' arrivato, non al posto suo. */
export async function mandaSms(cfg: ConfigCanali, p: {
  a: string; testo: string;
}): Promise<EsitoInvio> {
  if (!cfg.smsAttivo || !cfg.skebbyUser || !cfg.skebbyPassword) {
    return { ok: false, error: 'SMS non configurati' };
  }
  const numero = numeroPerSms(p.a);
  if (numero.length < 10) return { ok: false, error: 'Numero non valido' };

  try {
    // Skebby vuole prima un token di sessione, poi l'invio.
    const login = await fetch(
      `https://api.skebby.it/API/v1.0/REST/login?username=${encodeURIComponent(cfg.skebbyUser)}&password=${encodeURIComponent(cfg.skebbyPassword)}`,
    );
    if (!login.ok) return { ok: false, error: `Skebby non ha accettato le credenziali (${login.status})` };
    const [userKey, sessionKey] = (await login.text()).trim().split(';');
    if (!userKey || !sessionKey) return { ok: false, error: 'Skebby non ha restituito la sessione' };

    const res = await fetch('https://api.skebby.it/API/v1.0/REST/sms', {
      method: 'POST',
      headers: { user_key: userKey, Session_key: sessionKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // GP = qualita' alta con mittente personalizzato; e' quella che serve
        // per far arrivare "RevoBeauty" invece di un numero sconosciuto.
        message_type: 'GP',
        message: p.testo,
        recipient: [numero],
        ...(cfg.smsMittente ? { sender: cfg.smsMittente.slice(0, 11) } : {}),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d as { error?: string }).error || `Skebby ha risposto ${res.status}` };
    return { ok: true, id: (d as { order_id?: string }).order_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invio non riuscito' };
  }
}

/**
 * Il vestito dell'email: una cornice sobria attorno al testo.
 *
 * Niente immagini remote e niente stili complicati: le caselle di posta li
 * tagliano, e un'email che si apre storta fa piu' danno di un'email non
 * mandata.
 */
export function emailHtml(p: { titolo: string; testo: string; bottone?: { testo: string; link: string }; centro: string }): string {
  const paragrafi = p.testo.split('\n').filter(Boolean)
    .map(r => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3a45">${escapeHtml(r)}</p>`)
    .join('');
  const bottone = p.bottone
    ? `<a href="${escapeHtml(p.bottone.link)}" style="display:inline-block;margin-top:8px;padding:13px 26px;border-radius:12px;background:#A855F7;color:#fff;font-weight:700;font-size:15px;text-decoration:none">${escapeHtml(p.bottone.testo)}</a>`
    : '';
  return `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#faf7fd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;border:1px solid #ece6f4"><tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:21px;color:#241f2b">${escapeHtml(p.titolo)}</h1>
${paragrafi}${bottone}
<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #f0ebf7;font-size:12px;color:#9a94a3">${escapeHtml(p.centro)}</p>
</td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
