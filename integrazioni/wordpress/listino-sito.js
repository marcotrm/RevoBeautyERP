/*
  Le pagine dei servizi del sito, scritte dal gestionale.

  ─────────────────────────────────────────────────────────────────────────
  PERCHÉ

  Le pagine di revobeauty.it/servizi sono elenchi scritti a mano, e sono
  invecchiate. Il confronto del 27 agosto 2026, pagina per pagina:

      Bendaggi Corpo                  sito 49,90 €   gestionale 20,00 €
      Radiofrequenza Corpo 30 minuti  sito 29,90 €   gestionale 60,00 €
      Pressoterapia con Bendaggio     sito 34,90 €   gestionale 25,00 €
      Ricostruzione Acrygel o Gel     sito 45,00 €   gestionale 50,00 €

  Più una ventina di voci che ballano di dieci centesimi (il sito usa i prezzi
  che finiscono in 90, il gestionale quelli tondi), qualche durata che non
  combacia, e un «Acrygel» che in gestionale non esiste con quel nome — si
  chiama «Refill Acrygel o Gel».

  Non è colpa di nessuno: sono due elenchi tenuti da due persone in due posti,
  e nessuno apre WordPress il giorno che cambia un prezzo in gestionale.
  Finché restano due, torneranno a divergere. Questo file ne lascia uno solo.

  ─────────────────────────────────────────────────────────────────────────
  COME SI INSTALLA

  1. Incolla questo script in fondo alla pagina (o prima di </body> dal tema).

  2. In ogni pagina dei servizi, al posto dell'elenco scritto a mano, metti
     una riga sola dentro un blocco «HTML personalizzato»:

         <div data-revo-listino="Unghie"></div>

     Il nome fra virgolette è la categoria, scritta come sta in gestionale.
     Le categorie di oggi sono: Consulenza, Corpo, Depilazione, Laser,
     Massaggi, Unghie, Viso. Se non sei sicuro del nome, lascia vuoto —
     `<div data-revo-listino=""></div>` — e stampa tutto il listino diviso per
     categoria.

     Per il listino da uomo:

         <div data-revo-listino="Massaggi" data-revo-sesso="uomo"></div>

  3. Cancella l'elenco vecchio: se restano tutti e due, la pagina dice due
     prezzi diversi per la stessa cosa, che è peggio di dirne uno sbagliato.

  ─────────────────────────────────────────────────────────────────────────
  UNA DECISIONE CHE RESTA AL CENTRO

  Da qui in poi la pagina dice quello che dice il gestionale — compresi i
  prezzi tondi. Se sul sito si vogliono tenere i 39,90 e i 29,90, quella
  scelta va fatta **in gestionale**, sui prezzi veri: è l'unico modo perché la
  cliente legga la stessa cifra che poi le dice la segretaria e che trova alla
  cassa.
*/

(function () {
  'use strict';

  var FONTE = 'https://erp.revobeauty.it/api/listino/dati';

  function euro(n) {
    return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function riga(voce, sesso) {
    var d = sesso === 'uomo' ? voce.uomo : voce.donna;
    var el = document.createElement('div');
    el.className = 'revo-voce';
    el.style.cssText = 'display:flex;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08)';

    var nome = document.createElement('span');
    nome.textContent = voce.nome;
    nome.style.cssText = 'flex:1;min-width:0';

    var durata = document.createElement('span');
    durata.textContent = d.durata + ' min';
    durata.style.cssText = 'opacity:.6;font-size:.9em;white-space:nowrap';

    var prezzo = document.createElement('span');
    prezzo.textContent = euro(d.prezzo);
    prezzo.style.cssText = 'font-weight:600;white-space:nowrap';

    el.appendChild(nome);
    el.appendChild(durata);
    el.appendChild(prezzo);
    return el;
  }

  function disegna(contenitore, dati) {
    var categoria = (contenitore.getAttribute('data-revo-listino') || '').trim().toLowerCase();
    var sesso = (contenitore.getAttribute('data-revo-sesso') || 'donna').trim().toLowerCase();

    var voci = dati.trattamenti.filter(function (v) {
      return !categoria || String(v.categoria).toLowerCase() === categoria;
    });

    contenitore.textContent = '';

    if (voci.length === 0) {
      /*
        Categoria scritta male: si dice, non si tace.

        Un contenitore che resta vuoto in silenzio è indistinguibile da una
        pagina che ha finito di caricare, e nessuno se ne accorge finché una
        cliente non chiede perché il listino è sparito.
      */
      var vuoto = document.createElement('p');
      vuoto.style.cssText = 'opacity:.6;font-size:.9em';
      vuoto.textContent = categoria
        ? 'Nessun trattamento nella categoria «' + categoria + '». Le categorie disponibili sono: '
          + dati.categorie.join(', ') + '.'
        : 'Listino non disponibile.';
      contenitore.appendChild(vuoto);
      return;
    }

    // Senza categoria si stampa tutto, ma diviso: un elenco di centodieci
    // voci di fila non lo legge nessuno.
    var perCategoria = {};
    voci.forEach(function (v) {
      (perCategoria[v.categoria] = perCategoria[v.categoria] || []).push(v);
    });

    Object.keys(perCategoria).sort().forEach(function (cat) {
      if (!categoria) {
        var titolo = document.createElement('h3');
        titolo.textContent = cat;
        titolo.style.cssText = 'margin:24px 0 8px;font-size:1.1em';
        contenitore.appendChild(titolo);
      }
      perCategoria[cat].forEach(function (v) { contenitore.appendChild(riga(v, sesso)); });
    });
  }

  function avvia() {
    var contenitori = document.querySelectorAll('[data-revo-listino]');
    if (contenitori.length === 0) return;

    fetch(FONTE, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (dati) {
        if (!dati || !Array.isArray(dati.trattamenti)) throw new Error('risposta inattesa');
        Array.prototype.forEach.call(contenitori, function (c) { disegna(c, dati); });
      })
      .catch(function () {
        /*
          Se il gestionale non risponde, la pagina non resta muta ma non
          inventa nemmeno un listino: rimanda dove il prezzo è sicuro.
        */
        Array.prototype.forEach.call(contenitori, function (c) {
          c.textContent = '';
          var p = document.createElement('p');
          p.style.cssText = 'opacity:.7';
          var a = document.createElement('a');
          a.href = 'https://erp.revobeauty.it/listino';
          a.textContent = 'Guarda il listino aggiornato';
          p.appendChild(document.createTextNode('Listino momentaneamente non raggiungibile. '));
          p.appendChild(a);
          c.appendChild(p);
        });
      });
  }

  if (document.readyState !== 'loading') avvia();
  else document.addEventListener('DOMContentLoaded', avvia);
})();
