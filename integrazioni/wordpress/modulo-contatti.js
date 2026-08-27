/*
  Il modulo di revobeauty.it/contatti, che invia davvero.

  ─────────────────────────────────────────────────────────────────────────
  COSA C'È OGGI SUL SITO

  Il modulo è finto. Nel sorgente della pagina:

      <form action="#" method="post" id="contact-form">
      ...
      form.addEventListener('submit', function (e) { e.preventDefault(); ... })

  Il gestore non manda niente da nessuna parte: blocca l'invio, colora il
  tasto, scrive «Messaggio Inviato!» e svuota i campi. Ogni persona che ha
  lasciato i contatti dal sito ha visto la conferma e non ha mandato niente a
  nessuno — non c'è una mail, non c'è una riga in database, non c'è una
  notifica.

  Più in basso nella stessa pagina c'è anche, stampata a schermo:

      Oppure utilizza il modulo Contact Form 7:
      [contact-form-7 id="" title="Contatti"]

  Lo shortcode si legge in chiaro perché quel plugin non è installato e l'id è
  comunque vuoto. Va tolto: chi arriva in fondo alla pagina legge del codice.

  ─────────────────────────────────────────────────────────────────────────
  COME SI INSTALLA — due minuti, senza FTP e senza plugin

  1. WordPress → Aspetto → Personalizza → (oppure il pannello del tema che
     permette di inserire codice prima di </body>), e incolla:

         <script src="URL-DI-QUESTO-FILE"></script>

     Se è più comodo, incolla direttamente il contenuto di questo file dentro
     un blocco «HTML personalizzato» in fondo alla pagina Contatti, fra
     <script> e </script>. Funziona uguale.

  2. Nella stessa pagina, cancella il blocco con
     «Oppure utilizza il modulo Contact Form 7:» e lo shortcode sotto.

  Non serve altro: niente wp-config, niente mu-plugins, niente FTP. Il
  gestionale accetta già le richieste da revobeauty.it e da www.revobeauty.it,
  e i nomi dei campi del modulo sono già quelli giusti.

  (Se un giorno si vuole la versione che passa da PHP — più robusta, perché non
  dipende dal JavaScript del visitatore — c'è `revobeauty-contatti.php` in
  questa stessa cartella.)

  ─────────────────────────────────────────────────────────────────────────
  COSA SUCCEDE QUANDO QUALCUNO COMPILA

  1. La richiesta arriva nel gestionale, in Contatti.
  2. Parte il primo messaggio su WhatsApp al numero lasciato: serve a
     verificarlo — se non arriva, il numero era sbagliato — e da lì la
     conversazione continua con la segretaria.
  3. Il centro riceve la notifica.
*/

(function () {
  'use strict';

  var ERP = 'https://erp.revobeauty.it/api/lead';

  function quandoPronto(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  quandoPronto(function () {
    var vecchio = document.getElementById('contact-form');
    if (!vecchio) return;

    /*
      Il modulo si clona e si rimpiazza.

      Clonare stacca gli ascoltatori già attaccati — compreso quello del tema,
      che fa `preventDefault()` e finge l'invio. Lasciarlo lì vorrebbe dire due
      comportamenti sullo stesso click, e quale dei due vince dipende
      dall'ordine di caricamento degli script: cioè da niente su cui si possa
      contare.
    */
    var form = vecchio.cloneNode(true);
    vecchio.parentNode.replaceChild(form, vecchio);
    form.setAttribute('action', ERP);

    /*
      La casella per i robot.

      Invisibile e senza etichetta: una persona non la vede e non la compila,
      i riempitori automatici di moduli sì. Il gestionale scarta le richieste
      che ce l'hanno piena, e risponde ok lo stesso — a chi prova non deve
      risultare che è stato scoperto.
    */
    var esca = document.createElement('input');
    esca.type = 'text';
    esca.name = 'azienda';
    esca.tabIndex = -1;
    esca.autocomplete = 'off';
    esca.setAttribute('aria-hidden', 'true');
    esca.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
    form.appendChild(esca);

    var tasto = form.querySelector('button[type="submit"]');
    var testoTasto = tasto ? tasto.innerHTML : '';
    var inCorso = false;

    function messaggio(testo, errore) {
      var riga = form.querySelector('.revo-esito');
      if (!riga) {
        riga = document.createElement('p');
        riga.className = 'revo-esito';
        riga.style.cssText = 'margin-top:12px;font-size:14px;line-height:1.5';
        form.appendChild(riga);
      }
      riga.style.color = errore ? '#b00020' : '#1a7f4b';
      riga.textContent = testo;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Doppio click sul tasto: una richiesta sola. Senza, la stessa persona
      // finisce due volte in rubrica e si becca due messaggi su WhatsApp.
      if (inCorso) return;

      var dati = {};
      ['nome', 'cognome', 'email', 'telefono', 'servizio', 'messaggio', 'azienda'].forEach(function (campo) {
        var el = form.querySelector('[name="' + campo + '"]');
        if (el) dati[campo] = el.value;
      });
      var spunta = form.querySelector('[name="privacy"]');
      dati.privacy = spunta ? !!spunta.checked : false;

      if (!dati.nome || !dati.telefono) {
        messaggio('Servono almeno il nome e il numero di telefono.', true);
        return;
      }
      if (!dati.privacy) {
        messaggio('Per ricontattarti serve la spunta sulla privacy.', true);
        return;
      }

      inCorso = true;
      if (tasto) { tasto.disabled = true; tasto.innerHTML = 'Invio…'; }
      messaggio('', false);

      fetch(ERP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dati)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (esito) {
          if (!esito || esito.ok !== true) {
            throw new Error((esito && esito.errore) || 'Invio non riuscito');
          }

          messaggio(esito.message || 'Grazie, ti ricontattiamo a breve.', false);
          form.reset();

          // Le conversioni si contano solo quando l'invio è andato davvero a
          // buon fine: contarle al click misura i click, non i contatti.
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'generate_lead', { method: 'modulo_contatti' });
          }
          if (typeof window.fbq === 'function') {
            window.fbq('track', 'Lead');
          }
        })
        .catch(function (err) {
          /*
            L'errore si dice, non si nasconde.

            Il difetto che questo file viene a sistemare è esattamente quello:
            una conferma verde su un invio che non è mai partito. Meglio una
            riga rossa col numero del centro che una bugia gentile.
          */
          messaggio(
            'Non siamo riusciti a inviare la richiesta (' + (err && err.message ? err.message : 'errore') + '). '
            + 'Riprova fra un minuto, oppure scrivici su WhatsApp.',
            true
          );
        })
        .then(function () {
          inCorso = false;
          if (tasto) { tasto.disabled = false; tasto.innerHTML = testoTasto; }
        });
    });
  });
})();
