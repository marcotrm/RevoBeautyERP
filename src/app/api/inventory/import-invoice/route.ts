import '@/lib/pdf-polyfill';
import { PDFParse } from 'pdf-parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ParsedRow {
  code: string;
  name: string;
  qty: number;
  unit: number;   // prezzo unitario (costo)
  total: number;
}

function parseInvoice(text: string): ParsedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const codeStart = /^([A-Z]{2,6}\d{2,6}|KIT\b)/;
  const endLine = /(\d+)\s*€\s*[\d.,]+\s*€\s*[\d.,]+\s*$/;
  const merged: string[] = [];
  let buf = '';
  for (const l of lines) {
    if (codeStart.test(l)) { if (buf) merged.push(buf); buf = l; }
    else if (buf) buf += ' ' + l;
    if (buf && endLine.test(buf)) { merged.push(buf); buf = ''; }
  }
  if (buf) merged.push(buf);

  const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
  const rows: ParsedRow[] = [];
  for (const m of merged) {
    const mm = m.match(/^(.+?)\s+(\d+)\s*€\s*([\d.,]+)\s*€\s*([\d.,]+)\s*$/);
    if (!mm) continue;
    const head = mm[1].replace(/\s+/g, ' ').trim();
    let code = '', name = head;
    const cm = head.match(/^([A-Z]{2,6}\d{2,6})\s*(.*)$/);
    if (cm) { code = cm[1]; name = (cm[2] || '').trim() || cm[1]; }
    else { const parts = head.split(' '); code = parts[0]; name = parts.slice(1).join(' ') || head; }
    const qty = parseInt(mm[2], 10);
    const unit = num(mm[3]);
    const total = num(mm[4]);
    if (!name || qty <= 0 || unit <= 0) continue;
    rows.push({ code, name, qty, unit, total });
  }
  return rows;
}

// Estrae il fornitore (prima riga in maiuscolo del PDF) se riconoscibile
function extractSupplier(text: string): string {
  const first = text.split('\n').map(l => l.trim()).find(l => l.length > 3 && /[A-Z]{3,}/.test(l));
  return first || '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const base64 = body?.pdf as string | undefined;
    if (!base64) return Response.json({ error: 'Nessun PDF ricevuto' }, { status: 400 });

    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const buf = Buffer.from(clean, 'base64');

    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const res = await parser.getText();
    const rows = parseInvoice(res.text);
    const supplier = extractSupplier(res.text);

    if (rows.length === 0) {
      return Response.json({ error: 'Non ho riconosciuto righe prodotto in questa fattura. Controlla che sia un PDF di testo (non una scansione/immagine).', rows: [], supplier }, { status: 200 });
    }

    return Response.json({ rows, supplier, count: rows.length });
  } catch (err) {
    console.error('[import-invoice] error', err);
    return Response.json({ error: 'Errore nella lettura del PDF' }, { status: 500 });
  }
}
