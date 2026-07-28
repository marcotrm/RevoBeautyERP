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
  /** Numero del documento commerciale AdE restituito da C95 (es. DCW2026/1565-0455). */
  progressivo?: string | null;
  /** Codice transazione C95/AdE (idtrx) del documento commerciale. */
  idtrx?: string | null;
  /** Data/ora da stampare; se assente usa l'istante della stampa. */
  dateLabel?: string;
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

// Vero quando lo scontrino ha almeno un riferimento al documento commerciale elettronico:
// solo in quel caso ha senso stampare il blocco fiscale e la dicitura estesa in fondo.
function hasFiscalData(data: ReceiptData): boolean {
  return !!(data.progressivo || data.idtrx || data.fiscalRef);
}

// Riferimenti del documento commerciale AdE, così il tagliando cartaceo è riconducibile
// allo scontrino elettronico (necessario per resi, contestazioni e controlli).
function fiscalBlock(data: ReceiptData): string {
  if (!hasFiscalData(data)) return '';
  const rows: string[] = [];
  if (data.progressivo) rows.push(`<div class="row muted"><span>N. Documento</span><span>${esc(data.progressivo)}</span></div>`);
  if (data.idtrx) rows.push(`<div class="row muted"><span>Cod. Transazione</span><span>${esc(data.idtrx)}</span></div>`);
  if (!data.progressivo && !data.idtrx && data.fiscalRef) {
    rows.push(`<div class="muted">Doc. Commerciale: ${esc(data.fiscalRef)}</div>`);
  }
  return `<div class="hr"></div>${rows.join('')}`;
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
  <div class="muted">Data: ${esc(data.dateLabel || nowStamp())}</div>
  ${data.client ? `<div class="muted">Cliente: ${esc(data.client)}</div>` : ''}
  ${data.operator ? `<div class="muted">Operatore: ${esc(data.operator)}</div>` : ''}
  <div class="hr"></div>
  ${rows || '<div class="muted">Nessun articolo</div>'}
  <div class="hr"></div>
  <div class="row total"><span>TOTALE</span><span>${euro(data.total)}</span></div>
  ${data.method ? `<div class="row muted"><span>Pagamento</span><span>${esc(data.method)}</span></div>` : ''}
  ${fiscalBlock(data)}
  <div class="hr"></div>
  <div class="center foot muted">${hasFiscalData(data)
    ? 'Documento commerciale emesso elettronicamente<br>e trasmesso all\'Agenzia delle Entrate.<br>Copia di cortesia per il cliente.'
    : 'Copia di cortesia — non fiscale'}</div>
  <div class="center muted">Grazie e arrivederci!</div>
</body></html>`;
}

// Una stampa alla volta: senza questo lock i click ripetuti sul pulsante accavallano
// più iframe, e la finestra di stampa può non aprirsi affatto.
let printing = false;

/**
 * Apre un iframe nascosto con lo scontrino formattato a 80 mm e lancia la stampa.
 * L'iframe evita i blocchi popup e non mostra finestre extra.
 */
export function printThermalReceipt(data: ReceiptData): void {
  if (typeof window === 'undefined') return;
  if (printing) return;
  printing = true;
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
    printing = false;
    return;
  }

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    printing = false;
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* già rimosso */ } }, 1000);
  };

  let launched = false;
  const launch = () => {
    if (launched) return; // onload e il fallback possono scattare entrambi: una stampa sola
    launched = true;
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.onafterprint = cleanup;
    try {
      win.focus();
      win.print();
    } catch (e) {
      console.error('Stampa scontrino fallita', e);
      cleanup();
      return;
    }
    // Fallback: alcuni browser non chiamano onafterprint (o la finestra resta aperta a lungo).
    // Senza questo il lock resterebbe attivo e i pulsanti Stampa smetterebbero di rispondere.
    setTimeout(cleanup, 60_000);
  };

  // Stampa solo a documento caricato: il vecchio setTimeout(250ms) partiva a volte prima
  // del render e non apriva nulla — era la causa dei click a vuoto sul pulsante Stampa.
  iframe.onload = launch;
  doc.open();
  doc.write(html);
  doc.close();
  // Con document.write l'evento load può essere già scattato: fallback difensivo.
  setTimeout(() => { if (!launched && iframe.contentWindow) launch(); }, 500);
}
