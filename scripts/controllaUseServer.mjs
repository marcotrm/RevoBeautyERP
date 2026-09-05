/**
 * Controlla che nessun file 'use server' esporti qualcosa che non sia una
 * funzione async.
 *
 * Next lo lascia passare in compilazione e poi fa esplodere la pagina che lo
 * importa, al primo caricamento in produzione. E' successo due volte in un
 * giorno: una costante di appoggio esportata da un file di azioni ha tenuto
 * l'agenda chiusa per venti minuti. Questo controllo costa un secondo.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const file = execSync("grep -rl \"^'use server'\" src --include='*.ts' --include='*.tsx'", { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const problemi = [];
for (const f of file) {
  const righe = readFileSync(f, 'utf8').split('\n');
  righe.forEach((r, i) => {
    if (!r.startsWith('export ')) return;
    // Vanno bene: le funzioni async, i tipi e le interfacce (spariscono in
    // compilazione), e il ri-export di soli tipi.
    if (/^export\s+(async\s+function|type|interface)\b/.test(r)) return;
    if (/^export\s+\{\s*type\s/.test(r)) return;
    if (/^export\s+default\s+async\s+function\b/.test(r)) return;
    problemi.push(`${f}:${i + 1}  ${r.trim().slice(0, 80)}`);
  });
}

if (problemi.length) {
  console.error(`\n${problemi.length} export che NON sono funzioni async dentro file 'use server':\n`);
  for (const p of problemi) console.error('  ' + p);
  console.error('\nSpostali in un file normale (es. src/lib/...) e importali da lì.\n');
  process.exit(1);
}
console.log(`${file.length} file 'use server' controllati: tutti a posto.`);
