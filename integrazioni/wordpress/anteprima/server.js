/**
 * Servitore statico per l'anteprima del sito.
 *
 * Serve i file di questa cartella e basta: niente framework, niente
 * dipendenze da installare, niente da aggiornare. L'anteprima deve reggere
 * finché il centro non decide, poi si spegne.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = __dirname;
const PORTA = process.env.PORT || 3000;

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

http.createServer(function (req, res) {
  var percorso = decodeURIComponent(req.url.split('?')[0]);
  if (percorso === '/' || percorso === '') percorso = '/index.html';
  // Senza estensione si prova comunque il .html: così /servizi funziona.
  if (!path.extname(percorso)) percorso += '.html';

  // Nessuna risalita fuori dalla cartella.
  var file = path.join(RADICE, path.normalize(percorso).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(RADICE)) {
    res.writeHead(403).end('vietato');
    return;
  }

  fs.readFile(file, function (err, dati) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Pagina non trovata</h1><p><a href="/">Torna alla home</a></p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPI[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      // È un'anteprima: che non finisca su Google.
      'X-Robots-Tag': 'noindex, nofollow',
    });
    res.end(dati);
  });
}).listen(PORTA, function () {
  console.log('anteprima RevoBeauty in ascolto sulla porta ' + PORTA);
});
