'use client';

// Stampa una copia di cortesia dello scontrino su stampante termica da 80 mm.
// Nota: il documento fiscale è quello elettronico inviato all'Agenzia delle Entrate
// tramite C95; questo è solo il tagliando cartaceo per il cliente.

export interface ReceiptLine {
  name: string;
  qty?: number;
  price?: number; // totale riga (prezzo * qty), in euro
}

export interface ReceiptData {
  lines: ReceiptLine[];
  total: number;
  method?: string;
  client?: string;
  operator?: string;
  /** Riferimento al documento commerciale elettronico, se disponibile. */
  fiscalRef?: string;
}

// Intestazione del negozio stampata in cima allo scontrino.
// Modificabile qui se cambiano i dati fiscali/indirizzo.
const BUSINESS = {
  name: 'REVOBEAUTY',
  lines: ['Via Caudina - Maddaloni (CE)', 'P.IVA 10625841217'],
};

function euro(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildReceiptHtml(data: ReceiptData): string {
  const rows = data.lines.map((l) => {
    const qty = l.qty && l.qty > 1 ? `${l.qty}x ` : '';
    const price = typeof l.price === 'number' ? euro(l.price) : '';
    return `<div class="row"><span class="name">${qty}${esc(l.name)}</span><span class="price">${price}</span></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scontrino</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 80mm; background: #fff; }
  body { padding: 4mm 3mm; font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; line-height: 1.35; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 15px; }
  .muted { font-size: 11px; }
  .hr { border-top: 1px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row .name { flex: 1; word-break: break-word; }
  .row .price { white-space: nowrap; }
  .total { font-size: 16px; font-weight: 700; }
  .head { margin-bottom: 4px; }
  .foot { margin-top: 8px; }
</style></head><body>
  <div class="center head">
    <div class="bold big">${esc(BUSINESS.name)}</div>
    ${BUSINESS.lines.map((l) => `<div class="muted">${esc(l)}</div>`).join('')}
  </div>
  <div class="hr"></div>
  <div class="muted">Data: ${nowStamp()}</div>
  ${data.client ? `<div class="muted">Cliente: ${esc(data.client)}</div>` : ''}
  ${data.operator ? `<div class="muted">Operatore: ${esc(data.operator)}</div>` : ''}
  <div class="hr"></div>
  ${rows || '<div class="muted">Nessun articolo</div>'}
  <div class="hr"></div>
  <div class="row total"><span>TOTALE</span><span>${euro(data.total)}</span></div>
  ${data.method ? `<div class="row muted"><span>Pagamento</span><span>${esc(data.method)}</span></div>` : ''}
  ${data.fiscalRef ? `<div class="muted" style="margin-top:4px">Doc. Commerciale: ${esc(data.fiscalRef)}</div>` : ''}
  <div class="hr"></div>
  <div class="center foot muted">Copia di cortesia — non fiscale</div>
  <div class="center muted">Grazie e arrivederci!</div>
</body></html>`;
}

/**
 * Apre un iframe nascosto con lo scontrino formattato a 80 mm e lancia la stampa.
 * L'iframe evita i blocchi popup e non mostra finestre extra.
 */
export function printThermalReceipt(data: ReceiptData): void {
  if (typeof window === 'undefined') return;
  const html = buildReceiptHtml(data);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  const cleanup = () => {
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* già rimosso */ } }, 1000);
  };
  win.onafterprint = cleanup;

  // Attende il render del contenuto prima di stampare
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch (e) {
      console.error('Stampa scontrino fallita', e);
    }
    // fallback nel caso onafterprint non venga chiamato
    setTimeout(cleanup, 2000);
  }, 250);
}
