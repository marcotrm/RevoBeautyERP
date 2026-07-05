import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

// Categoria dedotta dal nome del trattamento
function categorize(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('consulenza')) return 'consultation';
  if (n.includes('laser')) return 'laser';
  if (n.includes('ceretta') || n.includes('cera') || n.includes('depilazione')) return 'waxing';
  if (n.includes('massaggio')) return 'massage'; // copre anche "endomassaggio"
  if (n.includes('viso') || n.includes('vitamina') || n.includes('pulizia') ||
      n.includes('colorazione') || n.includes('fast tonic')) return 'facial';
  return 'body';
}

const CATEGORY_COLORS: Record<string, string> = {
  facial: '#F472B6',
  body: '#A855F7',
  laser: '#6366F1',
  massage: '#22C55E',
  waxing: '#F59E0B',
  consultation: '#06B6D4',
};

// Arrotonda a 2 decimali; ritorna null se cella vuota
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  if (Number.isNaN(x)) return null;
  return Math.round(x * 100) / 100;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: 'Nessun file ricevuto (campo "file")' }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return Response.json({ error: 'File Excel non leggibile' }, { status: 400 });
  }

  // Attese colonne: NOME | PREZZO UOMO | PREZZO DONNA | TEMPI UOMO | TEMPI DONNA
  // Salta la riga di intestazione se la prima cella contiene "NOME"
  const dataRows = rows.filter((r, i) => {
    if (!r || !r[0]) return false;
    if (i === 0 && String(r[0]).toUpperCase().includes('NOME')) return false;
    return true;
  });

  if (dataRows.length === 0) {
    return Response.json({ error: 'Nessun trattamento trovato nel file' }, { status: 400 });
  }

  const parsed = dataRows.map((r) => {
    const name = String(r[0]).trim();
    const priceMale = num(r[1]);
    const priceFemale = num(r[2]);
    const durationMale = num(r[3]);
    const durationFemale = num(r[4]);
    const category = categorize(name);
    return {
      name,
      category,
      priceMale,
      priceFemale,
      durationMale: durationMale != null ? Math.round(durationMale) : null,
      durationFemale: durationFemale != null ? Math.round(durationFemale) : null,
      // valori di default usati dal resto dell'app: preferisci donna, poi uomo
      price: priceFemale ?? priceMale ?? 0,
      duration: Math.round(durationFemale ?? durationMale ?? 60),
      color: CATEGORY_COLORS[category] || '#A855F7',
    };
  });

  // Nasconde i trattamenti demo esistenti (non li elimina: preserva gli appuntamenti collegati)
  await prisma.treatment.updateMany({ data: { isActive: false } });

  // Upsert per nome
  for (const t of parsed) {
    const existing = await prisma.treatment.findFirst({ where: { name: t.name } });
    if (existing) {
      await prisma.treatment.update({
        where: { id: existing.id },
        data: { ...t, isActive: true },
      });
    } else {
      await prisma.treatment.create({
        data: { ...t, isActive: true, requiresRoom: false },
      });
    }
  }

  const treatments = await prisma.treatment.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return Response.json({ success: true, count: treatments.length, treatments });
}
