/**
 * Le foto su storage vero (bucket S3 su Railway) invece che nel database.
 *
 * Il base64 in tabella andava bene per partire, ma ogni foto da ~300 KB
 * viaggia dentro ogni query che la tocca: con migliaia di foto il database
 * diventa un album fotografico lento. Qui le foto vivono nel bucket
 * (privato: si esce solo con link firmati a scadenza — proprio quello che
 * il modulo percorsi prometteva) e in tabella resta una chiave leggera.
 *
 * Retrocompatibile per costruzione: le foto vecchie restano data-URI e
 * si servono come sempre; le nuove nascono `bucket:<chiave>`. Se le
 * variabili FOTO_S3_* mancano (es. in locale), si torna al base64 e
 * nessuno se ne accorge.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PREFISSO = 'bucket:';

function config() {
  const bucket = process.env.FOTO_S3_BUCKET;
  const endpoint = process.env.FOTO_S3_ENDPOINT;
  const accessKeyId = process.env.FOTO_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.FOTO_S3_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, accessKeyId, secretAccessKey, region: process.env.FOTO_S3_REGION || 'auto' };
}

let client: S3Client | null = null;
function s3(): S3Client | null {
  const c = config();
  if (!c) return null;
  if (!client) {
    client = new S3Client({
      endpoint: c.endpoint,
      region: c.region,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return client;
}

export function storageAttivo(): boolean {
  return config() !== null;
}

/**
 * Salva una foto (data-URI) nel bucket e torna la chiave `bucket:…`.
 * Se il bucket non è configurato torna null: il chiamante tiene il base64.
 */
export async function salvaFoto(dataUri: string, cartella: string): Promise<string | null> {
  const c = config();
  const cli = s3();
  if (!c || !cli) return null;

  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUri);
  if (!m) return null;
  const tipo = m[1];
  const corpo = Buffer.from(m[2], 'base64');
  const estensione = tipo.includes('png') ? 'png' : tipo.includes('webp') ? 'webp' : 'jpg';
  const chiave = `${cartella}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${estensione}`;

  await cli.send(new PutObjectCommand({
    Bucket: c.bucket, Key: chiave, Body: corpo, ContentType: tipo,
  }));
  return `${PREFISSO}${chiave}`;
}

/**
 * Da quello che c'è in tabella all'URL che un'app può mostrare:
 * data-URI passa intatto, `bucket:…` diventa un link firmato che scade.
 */
export async function urlFoto(salvata: string, minutiValidita = 60): Promise<string> {
  if (!salvata.startsWith(PREFISSO)) return salvata;
  const c = config();
  const cli = s3();
  if (!c || !cli) return ''; // bucket sparito dalla config: meglio niente che un link rotto
  return getSignedUrl(
    cli,
    new GetObjectCommand({ Bucket: c.bucket, Key: salvata.slice(PREFISSO.length) }),
    { expiresIn: minutiValidita * 60 },
  );
}

/** Cancella l'oggetto se la foto viveva nel bucket. Mai bloccante. */
export async function eliminaFotoStorage(salvata: string): Promise<void> {
  if (!salvata.startsWith(PREFISSO)) return;
  const c = config();
  const cli = s3();
  if (!c || !cli) return;
  await cli
    .send(new DeleteObjectCommand({ Bucket: c.bucket, Key: salvata.slice(PREFISSO.length) }))
    .catch(() => undefined);
}
