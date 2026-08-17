/**
 * Scarica i dati del centro in un foglio Excel.
 *
 * Il file si costruisce qui sul server e non nel browser: i clienti sono
 * centinaia e gli incassi migliaia, e mandarli tutti al browser per farglieli
 * impacchettare significa bloccare la pagina sul portatile del banco.
 */

import * as XLSX from 'xlsx';
import { consumaTokenExport, fogliExport, nomeFile } from '@/lib/esportaDati';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);

  /*
    Senza un permesso valido non esce niente.

    Il periodo NON si legge dall'indirizzo ma dal permesso: altrimenti chi
    intercetta un link potrebbe cambiare le date e farsi dare gli anni che
    vuole. Nell'indirizzo le date restano solo perché il file scaricato porti
    il nome giusto.
  */
  const periodo = await consumaTokenExport(url.searchParams.get('t') || '');
  if (!periodo) {
    return new Response(
      'Permesso mancante o scaduto. Torna in Amministrazione → Esporta dati e premi di nuovo Scarica.',
      { status: 401 },
    );
  }

  try {
    const fogli = await fogliExport(periodo);
    const wb = XLSX.utils.book_new();

    for (const f of fogli) {
      // Un foglio vuoto senza intestazioni sembra un errore: meglio una riga
      // che dice che in quel periodo non c'era niente.
      const dati = f.righe.length ? f.righe : [{ Nota: 'Nessun dato nel periodo scelto' }];
      const ws = XLSX.utils.json_to_sheet(dati);
      // Colonne larghe quanto il contenuto più lungo, entro un limite: senza,
      // si apre il file e si vedono venti colonne di cancelletti.
      ws['!cols'] = Object.keys(dati[0]).map(k => ({
        wch: Math.min(40, Math.max(k.length + 2, ...dati.map(r => String(r[k] ?? '').length + 2))),
      }));
      XLSX.utils.book_append_sheet(wb, ws, f.nome);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nomeFile(periodo)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[esporta] fallito', err);
    return new Response('Esportazione fallita', { status: 500 });
  }
}
