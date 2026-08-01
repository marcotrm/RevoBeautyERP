/**
 * Registrazione dalla landing di un QR affiliato.
 *
 * Qui vive l'antifrode: la scansione da sola non vale niente, e prima ancora
 * di mandare l'OTP si scartano i casi che non devono generare commissioni:
 *  - numero già cliente RevoBeauty (l'offerta è per i nuovi);
 *  - numero o email che hanno già usato un'offerta di benvenuto (anche di un
 *    altro affiliato: il cliente resta di chi l'ha portato per primo);
 *  - il numero dell'affiliato stesso (auto-registrazione);
 *  - QR sospeso, scaduto, disattivato o oltre il limite di utilizzi.
 *
 * Se la stessa persona riprova sullo stesso QR mentre l'OTP è in sospeso, non
 * si crea un doppione: si rigenera il codice sullo stesso lead.
 */

import prisma from '@/lib/prisma';
import { normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { statoEffettivo, phoneKey, nuovoOtp, inviaOtp, descriviDevice } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_MINUTI = 10;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug || '');
  const firstName = String(body?.firstName || '').trim();
  const lastName = String(body?.lastName || '').trim();
  const phoneRaw = String(body?.phone || '').trim();
  const email = String(body?.email || '').trim().toLowerCase() || null;
  const privacy = Boolean(body?.privacy);
  const visitorId = body?.visitorId ? String(body.visitorId).slice(0, 64) : null;

  if (!slug || !firstName || !lastName || !phoneRaw) {
    return Response.json({ ok: false, error: 'Compila nome, cognome e telefono.' }, { status: 400 });
  }
  if (!privacy) {
    return Response.json({ ok: false, error: 'Per continuare serve il consenso al trattamento dei dati.' }, { status: 400 });
  }
  if (!isSendablePhone(phoneRaw)) {
    return Response.json({ ok: false, error: 'Inserisci un numero di cellulare italiano valido: il codice di verifica arriva su WhatsApp.' }, { status: 400 });
  }

  const qr = await prisma.affiliateQr.findUnique({
    where: { slug },
    include: { affiliate: { select: { id: true, phone: true, isActive: true } } },
  });
  if (!qr || !qr.affiliate.isActive) {
    return Response.json({ ok: false, error: 'Offerta non trovata.' }, { status: 404 });
  }
  const stato = await statoEffettivo(qr);
  if (stato !== 'active') {
    return Response.json({ ok: false, error: 'Questa offerta non è più disponibile.' }, { status: 410 });
  }

  const phone = normalizePhone(phoneRaw);
  const key = phoneKey(phone);
  const adesso = new Date().toISOString();
  const device = descriviDevice(request.headers.get('user-agent'));

  // --- Antifrode -------------------------------------------------------

  // Già cliente? L'offerta di benvenuto è per chi non lo è ancora.
  const clienti = await prisma.client.findMany({ select: { phone: true } });
  if (clienti.some(c => phoneKey(c.phone) === key)) {
    await prisma.affiliateLead.create({
      data: {
        qrId: qr.id, affiliateId: qr.affiliate.id, firstName, lastName, phone, email,
        status: 'blocked', blockReason: 'gia_cliente', visitorId, device, createdAt: adesso,
      },
    });
    return Response.json({ ok: false, error: 'Questo numero risulta già cliente RevoBeauty: l\'offerta di benvenuto è riservata ai nuovi clienti. Ti aspettiamo comunque in centro!' }, { status: 409 });
  }

  // Numero o email che hanno già completato una registrazione di benvenuto.
  const leadEsistenti = await prisma.affiliateLead.findMany({
    where: { status: 'verified' },
    select: { phone: true, email: true },
  });
  const giaUsato = leadEsistenti.some(l =>
    phoneKey(l.phone) === key || (email && l.email && l.email === email)
  );
  if (giaUsato) {
    await prisma.affiliateLead.create({
      data: {
        qrId: qr.id, affiliateId: qr.affiliate.id, firstName, lastName, phone, email,
        status: 'blocked', blockReason: 'doppione', visitorId, device, createdAt: adesso,
      },
    });
    return Response.json({ ok: false, error: 'Questo numero ha già usato un\'offerta di benvenuto RevoBeauty.' }, { status: 409 });
  }

  // Auto-registrazione dell'affiliato con il proprio numero.
  if (qr.affiliate.phone && phoneKey(qr.affiliate.phone) === key) {
    await prisma.affiliateLead.create({
      data: {
        qrId: qr.id, affiliateId: qr.affiliate.id, firstName, lastName, phone, email,
        status: 'blocked', blockReason: 'auto_registrazione', visitorId, device, createdAt: adesso,
      },
    });
    return Response.json({ ok: false, error: 'Questo numero non può usare l\'offerta.' }, { status: 409 });
  }

  // --- Lead + OTP ------------------------------------------------------

  const otp = nuovoOtp();
  const scadenza = new Date(Date.now() + OTP_MINUTI * 60_000).toISOString();

  // Stessa persona che riprova: si aggiorna il lead in sospeso, niente doppioni.
  const inSospeso = await prisma.affiliateLead.findFirst({
    where: { qrId: qr.id, status: 'otp' },
    orderBy: { createdAt: 'desc' },
    // il filtro sul numero si fa a mano: in DB è normalizzato ma non indicizzato per suffisso
  }).then(async l => {
    if (l && phoneKey(l.phone) === key) return l;
    const tutti = await prisma.affiliateLead.findMany({ where: { qrId: qr.id, status: 'otp' } });
    return tutti.find(x => phoneKey(x.phone) === key) || null;
  });

  const lead = inSospeso
    ? await prisma.affiliateLead.update({
        where: { id: inSospeso.id },
        data: { firstName, lastName, email, otpCode: otp, otpExpiresAt: scadenza, otpAttempts: 0 },
      })
    : await prisma.affiliateLead.create({
        data: {
          qrId: qr.id, affiliateId: qr.affiliate.id, firstName, lastName, phone, email,
          status: 'otp', otpCode: otp, otpExpiresAt: scadenza, visitorId, device, createdAt: adesso,
        },
      });

  const invio = await inviaOtp(phone, otp);
  if (!invio.ok) {
    console.error('[affiliazione] invio OTP fallito', phone, invio.error);
    return Response.json({
      ok: true,
      leadId: lead.id,
      otpInviato: false,
      error: 'Non siamo riusciti a inviarti il codice su WhatsApp. Riprova tra poco, oppure chiama il centro per completare la registrazione.',
    });
  }

  return Response.json({ ok: true, leadId: lead.id, otpInviato: true, scadeMinuti: OTP_MINUTI });
}
