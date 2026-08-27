# Il modulo contatti di revobeauty.it

> **Verificato il 27 agosto 2026, alle 16:10.** Il modulo sul sito è ancora
> quello finto: `action="#"` e `preventDefault()`, e lo shortcode
> `[contact-form-7 id="" title="Contatti"]` si legge ancora in chiaro in fondo
> alla pagina. Nessuna delle due cose è stata installata. Nel frattempo il
> gestionale è pronto e collaudato: `POST /api/lead` risponde, accetta le
> richieste da `revobeauty.it` e da `www.revobeauty.it`, e i nomi dei campi
> del modulo (`nome`, `cognome`, `email`, `telefono`, `servizio`, `messaggio`,
> `privacy`) sono già esattamente quelli che si aspetta. Manca solo di
> collegare il modulo.

## Due strade

**`modulo-contatti.js` — due minuti, senza FTP.** Un blocco di JavaScript da
incollare in fondo alla pagina Contatti (o prima di `</body>` dal tema). Non
serve wp-config, non serve la cartella `mu-plugins`, non serve un accesso ai
file. **È la strada da fare oggi**, perché è quella che si può fare da sola
dalla bacheca di WordPress.

**`revobeauty-contatti.php` — più robusta.** Un must-use plugin che invia da
PHP, quindi non dipende dal JavaScript del visitatore né da un blocco di
pubblicità che glielo ferma. Richiede però l'accesso ai file del sito e due
righe in `wp-config.php`. Vale la pena quando c'è mezz'ora e chi sa dove
mettere le mani.

Fanno la stessa cosa e **non vanno installate tutte e due insieme**: la
richiesta partirebbe due volte, e la persona riceverebbe due messaggi su
WhatsApp.

In tutti e due i casi, dalla pagina va tolto il blocco «Oppure utilizza il
modulo Contact Form 7:» con lo shortcode sotto.

## E il listino: il gestionale come punto di riferimento

`listino-sito.js` fa scrivere le pagine dei servizi dal gestionale. Si incolla
come l'altro, e al posto di ogni elenco scritto a mano va una riga:

```html
<div data-revo-listino="Unghie"></div>
```

Serve perché oggi i due elenchi non dicono la stessa cosa. Confronto del
27 agosto 2026, letto dalle pagine vere:

| | Sito | Gestionale |
|---|---|---|
| Bendaggi Corpo | 49,90 € | **20,00 €** |
| Radiofrequenza Corpo 30 minuti | 29,90 € | **60,00 €** |
| Pressoterapia con Bendaggio | 34,90 € | **25,00 €** |
| Ricostruzione Acrygel o Gel | 45,00 € | **50,00 €** |

Più una ventina di voci che ballano di dieci centesimi (il sito usa i prezzi
che finiscono in 90, il gestionale quelli tondi), qualche durata diversa
(Lampada Total Body 15 contro 25 minuti, Pulizia Viso 50 contro 40, Pedicure
curativo 60 contro 50) e un «Acrygel» che in gestionale si chiama «Refill
Acrygel o Gel».

Non è colpa di nessuno: sono due elenchi tenuti da due persone in due posti, e
nessuno apre WordPress il giorno che cambia un prezzo. Finché restano due,
torneranno a divergere.

**Una decisione resta al centro**: da quel momento la pagina dice quello che
dice il gestionale, prezzi tondi compresi. Se sul sito si vogliono tenere i
39,90, quella scelta va fatta **in gestionale**, sui prezzi veri — è l'unico
modo perché la cliente legga la stessa cifra che poi le dice la segretaria e
che trova alla cassa.

## Che cosa era rotto

Il modulo su `revobeauty.it/contatti` **non inviava niente**. Il codice della
pagina, il 27 agosto 2026:

```html
<form action="#" method="post" class="space-y-5" id="contact-form">
```

```js
form.addEventListener('submit', function (e) {
    e.preventDefault();
    btn.innerHTML = '... Messaggio Inviato!';
    // ...
    setTimeout(() => { form.reset(); }, 3000);
});
```

`action="#"`, `preventDefault()`, il tasto che diventa verde con scritto
**«Messaggio Inviato!»** e i campi che si svuotano. Nessuna email, nessun
database, nessuna notifica. Chi ha scritto dal sito ha visto una conferma e non
ha mandato niente a nessuno — e non l'ha mai saputo, perché la conferma c'era.

Subito sotto il modulo, in fondo alla colonna, c'era anche questo, visibile ai
visitatori:

> Oppure utilizza il modulo Contact Form 7:
> `[contact-form-7 id="" title="Contatti"]`

Lo shortcode compariva scritto a schermo perché Contact Form 7 su quel sito non
è installato (e l'`id` era comunque vuoto): WordPress non sapendo cosa farne lo
stampava così com'era. Chi arrivava in fondo alla pagina leggeva del codice.

## Che cosa fa adesso

```
modulo del sito  →  admin-post.php (WordPress, lato server)
                          ↓
              POST https://erp.revobeauty.it/api/lead
                          ↓
         Gestionale → «Contatti dal sito» + avviso Telegram
                          ↓
        primo messaggio WhatsApp (template approvato)
                          ↓
              la segretaria porta avanti la chat
```

Il passaggio è lato server (`wp_remote_post`), non dal browser: il segreto
condiviso non finisce nel sorgente della pagina e non c'è nessun CORS da
configurare. Se il gestionale non risponde, la persona **lo vede** — l'errore
muto è quello che ha fatto perdere i contatti fino a ieri.

## Installazione

1. Copia `revobeauty-contatti.php` in `wp-content/mu-plugins/`
   (crea la cartella se non c'è: i must-use plugin si attivano da soli).
2. In `wp-config.php`:
   ```php
   define( 'REVOBEAUTY_ERP_URL',    'https://erp.revobeauty.it' );
   define( 'REVOBEAUTY_LEAD_SECRET', '…' ); // = LEAD_SECRET nel gestionale
   ```
3. Nel template della pagina Contatti del tema `revobeauty`:
   - cancella il blocco `<form … id="contact-form"> … </form>`;
   - cancella il blocco «Oppure utilizza il modulo Contact Form 7:» con lo
     shortcode;
   - cancella il JavaScript in fondo che fa `preventDefault()` sul form;
   - al posto del modulo metti `<?php echo do_shortcode( '[revobeauty_contatti]' ); ?>`.
4. Prova con il tuo numero: deve arrivarti un WhatsApp e il contatto deve
   comparire in **Gestionale → Contatti dal sito**.

## Due cambi al modulo, apposta

**Il cellulare diventa obbligatorio, l'email no.** Era il contrario. Il seguito
della conversazione è su WhatsApp: senza numero il contatto resta una riga in un
elenco che nessuno richiama.

**La casella marketing è separata dalla privacy.** Prima ce n'era una sola, che
copriva tutto: è la casella che il Garante non fa passare, perché non si può
condizionare la risposta a una richiesta al consenso promozionale.

## Conversioni

Il sito ha già il tag Google (`GT-WRFB9525`) e il Pixel Meta
(`1014655024487422`), entrambi via Site Kit. Il modulo ora spara `generate_lead`
(GA4) e `Lead` (Meta) **solo quando il gestionale ha davvero ricevuto la
richiesta**. Prima non c'era niente da misurare, perché non arrivava niente:
qualunque numero di "conversioni" registrato fino a ieri non corrisponde a
nessun contatto reale.

## Se il gestionale è irraggiungibile

La richiesta non si perde in silenzio: la persona vede l'errore e può riprovare.
Se capita spesso, guarda i log di Railway — non il sito.
