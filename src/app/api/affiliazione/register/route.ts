/**
 * Registrazione dalla landing di un QR affiliato: registrati e il buono
 * appare subito, senza codici di conferma. La difesa vera è economica —
 * l'affiliato non guadagna finché il cliente non viene in centro e spende —
 * quindi qui basta l'antifrode sui dati:
 *  - numero già cliente RevoBeauty (l'offerta è per i nuovi);
 *  - numero o email che hanno già usato un'offerta di benvenuto (anche di un
 *    altro affiliato: il cliente resta di chi l'ha portato per primo);
 *  - il numero dell'affiliato stesso (auto-registrazione);
 *  - QR sospeso, scaduto, disattivato o oltre il limite di utilizzi.
 */

import prisma from '@/lib/prisma';
import { normalizePhone, isSendablePhone } from '@/lib/whatsapp';
import { statoEffettivo, phoneKey, nuovoVoucher, descriviDevice, CENTRO } from '@/lib/affiliazione';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const slug = String(body?.slug || '');
  const firstName = String(body?.firstName || '').trim();
  const lastName = String(body?.lastName || '').trim();
  const phoneRaw = String(body?.phone || '').trim();
  const email = String(body?.email || '').trim().toLowerCase() || null;
  const privacy = Boolean(body?.privacy);
  const marketing = Boolean(body?.marketing);
  const visitorId = body?.visitorId ? String(body.visitorId).slice(0, 64) : null;

  if (!slug || !firstName || !lastName || !phoneRaw) {
    return Response.json({ ok: false, error: 'Compila nome, cognome e telefono.' }, { status: 400 });
  }
  if (!privacy) {
    return Response.json({ ok: false, error: 'Per continuare serve il consenso al trattamento dei dati.' }, { status: 400 });
  }
  if (!isSendablePhone(phoneRaw)) {
    return Response.json({ ok: false, error: 'Inserisci un numero di cellulare italiano valido: il buono è legato al tuo numero.' }, { status: 400 });
  }

  const qr = await prisma.affiliateQr.findUnique({
    where: { slug },
    include: { affiliate: { select: { id: true, phone: true, isActive: true, businessName: true } } },
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

  // --- Cliente + voucher, subito ---------------------------------------
  // Niente codice di conferma: tanto l'affiliato non guadagna niente finché
  // il cliente non viene in centro e spende davvero. Il controllo vero è al
  // banco, col buono in mano — un numero inventato non produce commissioni.

  const cliente = await prisma.client.create({
    data: {
      firstName,
      lastName,
      phone,
      email,
      gdprConsent: true,
      marketingConsent: marketing,
      // Il legame con l'affiliato è permanente: si scrive qui e non si tocca più.
      referredBy: `Affiliato: ${qr.affiliate.businessName}`,
      tags: ['affiliazione'],
      createdAt: adesso.split('T')[0],
    },
  });

  const voucher = nuovoVoucher();

  // Un eventuale tentativo rimasto a metà (dai tempi del codice di conferma)
  // si completa invece di creare un doppione.
  const inSospeso = await prisma.affiliateLead.findMany({ where: { qrId: qr.id, status: 'otp' } })
    .then(tutti => tutti.find(x => phoneKey(x.phone) === key) || null);

  if (inSospeso) {
    await prisma.affiliateLead.update({
      where: { id: inSospeso.id },
      data: {
        firstName, lastName, ...(email ? { email } : {}),
        status: 'verified', verifiedAt: adesso, otpCode: null,
        voucherCode: voucher, clientId: cliente.id,
      },
    });
  } else {
    await prisma.affiliateLead.create({
      data: {
        qrId: qr.id, affiliateId: qr.affiliate.id, firstName, lastName, phone, email,
        status: 'verified', verifiedAt: adesso, voucherCode: voucher,
        clientId: cliente.id, visitorId, device, createdAt: adesso,
      },
    });
  }

  return Response.json({ ok: true, voucher, centro: CENTRO });
}
