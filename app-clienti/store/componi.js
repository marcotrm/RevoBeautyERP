/**
 * Le immagini per l'App Store, dalle catture vere dell'app.
 *
 * Apple pretende che gli screenshot mostrino l'app in uso: un'immagine
 * pubblicitaria senza le schermate dentro viene respinta. Quindi qui non si
 * inventa niente — si prende la cattura vera e le si costruisce intorno una
 * cornice che parli la lingua del marchio: nero, oro, il logo, e una frase.
 *
 * Perché uno script e non un lavoro a mano: quando cambia una schermata si
 * rigenera tutto con un comando. Fatte a mano, alla terza modifica non le
 * rifà più nessuno e sullo store restano quelle vecchie.
 *
 * Uso:
 *   FONTCONFIG_FILE=<...>/fonts.conf node componi.js
 *
 * Le catture vanno in ./catture con i nomi che trovi in TAVOLE.
 */
const sharp = require('../../node_modules/sharp');
const fs = require('fs');
const path = require('path');

// 6,5" — la misura che App Store Connect chiede per iPhone
const L = 1242;
const A = 2688;

const NERO = '#0A0A0A';
const ORO = '#B59B53';
const AVORIO = '#FAF8F4';

const QUI = __dirname;
const CATTURE = path.join(QUI, 'catture');
const FUORI = path.join(QUI, 'pronte');
const LOGO = path.join(QUI, '..', 'assets', 'images', 'logo-oro.png');

/**
 * Le tre tavole. Apple usa le prime tre nella scheda di installazione, quindi
 * l'ordine è quello in cui contano: prima cosa risolve, poi cosa ci guadagni.
 */
const TAVOLE = [
  { file: 'preview1.jpg', titolo: ['Prenoti quando', 'ti fa comodo'], sotto: 'Vedi solo i posti davvero liberi' },
  { file: 'preview3.jpg', titolo: ['I tuoi appuntamenti,', 'sempre con te'], sotto: 'Sposti o disdici senza telefonare' },
  {
    file: 'preview2.jpg',
    titolo: ['Tutto quello che', 'hai con noi'],
    sotto: 'Percorsi, credito, premi e inviti',
    // Il numero di telefono della cliente non va su una pagina pubblica.
    // Si offusca il dato personale: la schermata resta quella vera.
    oscura: { left: 222, top: 142, width: 210, height: 62 },
  },
];

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Il fondo: nero con un alone d'oro tenue in alto a sinistra. */
async function fondo() {
  const svg = `<svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="alone" cx="28%" cy="16%" r="62%">
        <stop offset="0%" stop-color="${ORO}" stop-opacity="0.30"/>
        <stop offset="55%" stop-color="${ORO}" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="${ORO}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${L}" height="${A}" fill="${NERO}"/>
    <rect width="${L}" height="${A}" fill="url(#alone)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Titolo e sottotitolo, centrati. */
function testi(titolo, sotto) {
  const y0 = 470;
  const passo = 104;
  const righe = titolo.map((r, i) =>
    `<text x="${L / 2}" y="${y0 + i * passo}" text-anchor="middle"
       font-family="Cormorant Garamond" font-weight="600" font-size="88"
       fill="${AVORIO}">${esc(r)}</text>`).join('');
  const sottoY = y0 + titolo.length * passo - 6;
  return Buffer.from(`<svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
    ${righe}
    <text x="${L / 2}" y="${sottoY}" text-anchor="middle"
      font-family="Montserrat" font-weight="300" font-size="38"
      fill="#B9B2A5" letter-spacing="0.4">${esc(sotto)}</text>
  </svg>`);
}

/** Angoli tondi sulla cattura, come li ha il telefono vero. */
async function angoliTondi(buf, larghezza, raggio) {
  const ridotta = await sharp(buf).resize({ width: larghezza }).png().toBuffer();
  const { width, height } = await sharp(ridotta).metadata();
  const maschera = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${raggio}" ry="${raggio}" fill="#fff"/></svg>`
  );
  return {
    buf: await sharp(ridotta).composite([{ input: maschera, blend: 'dest-in' }]).png().toBuffer(),
    width, height,
  };
}

async function componi(tavola) {
  const sorgente = path.join(CATTURE, tavola.file);
  if (!fs.existsSync(sorgente)) {
    console.log(`  manca ${tavola.file} — saltata`);
    return false;
  }

  const LARGHEZZA_TEL = 880;
  const CIMA_TEL = 830;

  let cattura = fs.readFileSync(sorgente);
  if (tavola.oscura) {
    const z = tavola.oscura;
    const sfocato = await sharp(cattura).extract(z).blur(18).png().toBuffer();
    cattura = await sharp(cattura)
      .composite([{ input: sfocato, top: z.top, left: z.left }])
      .png().toBuffer();
  }

  const tel = await angoliTondi(cattura, LARGHEZZA_TEL, 58);
  const sinistra = Math.round((L - tel.width) / 2);

  // Un filo d'oro intorno alla cattura: senza, su fondo nero il telefono non
  // ha bordo e sembra un ritaglio incollato male.
  const cornice = Buffer.from(`<svg width="${tel.width + 4}" height="${tel.height + 4}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${tel.width + 2}" height="${tel.height + 2}" rx="60" ry="60"
      fill="none" stroke="${ORO}" stroke-opacity="0.35" stroke-width="2"/>
  </svg>`);

  const logo = await sharp(LOGO).resize({ width: 420 }).png().toBuffer();
  const logoAlt = (await sharp(logo).metadata()).height || 0;

  const finale = await sharp(await fondo())
    .composite([
      { input: logo, top: 210, left: Math.round((L - 420) / 2) },
      { input: testi(tavola.titolo, tavola.sotto), top: 0, left: 0 },
      { input: cornice, top: CIMA_TEL - 2, left: sinistra - 2 },
      { input: tel.buf, top: CIMA_TEL, left: sinistra },
    ])
    // La cattura esce dal bordo in basso: il telefono continua fuori dal
    // riquadro, che e' come le fanno le app curate.
    .extract({ left: 0, top: 0, width: L, height: A })
    .png()
    .toBuffer();

  fs.mkdirSync(FUORI, { recursive: true });
  const uscita = path.join(FUORI, tavola.file.replace(/\.(png|jpg|jpeg)$/i, '') + '-1242x2688.png');
  await sharp(finale).toFile(uscita);
  const m = await sharp(uscita).metadata();
  console.log(`  ${path.basename(uscita)} — ${m.width}x${m.height}  (logo alto ${logoAlt}px)`);
  return true;
}

(async () => {
  console.log('Immagini per l\'App Store:');
  let fatte = 0;
  for (const t of TAVOLE) if (await componi(t)) fatte++;
  if (!fatte) {
    console.log(`\nNessuna cattura trovata. Mettile in:\n  ${CATTURE}\ncon i nomi: ${TAVOLE.map(t => t.file).join(', ')}`);
  }
})();
