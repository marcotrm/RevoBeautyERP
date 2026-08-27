# L'assistente di RevoBeauty

Un cervello solo, due bocche: WhatsApp e telefono. Identità, poteri e limiti
sono gli stessi; cambia solo il modo di dirli.

Al telefono parla un orchestratore Pipecat che sta in un repo a parte e chiama
le route `/api/voice/*`. Su WhatsApp la segretaria gira dentro il gestionale
(`src/lib/wa-segretaria.ts`) e chiama le stesse funzioni direttamente, senza
passare per HTTP.

## Dove stanno le istruzioni

**Nel codice, non in questo file.** Il testo che l'assistente riceve si
costruisce in [`src/lib/istruzioniAssistente.ts`](src/lib/istruzioniAssistente.ts)
e si serve da `POST /api/voice/prompt`.

Prima stava scritto in due documenti che si contraddicevano — uno diceva che
l'assistente non prenota, l'altro che prenota — e andava copiato a mano nella
configurazione del bot. Due copie divergono nel giro di un mese, e quando
divergono nessuno se ne accorge finché una cliente non si sente dire due cose
diverse dallo stesso centro.

I dati del centro (nome, indirizzo, orari, chiusure, note) vengono infilati nel
testo al momento della richiesta, quindi non possono restare indietro rispetto
al gestionale. Le note libere si scrivono dal gestionale e finiscono in fondo
alle istruzioni.

Il bot chiede le istruzioni all'avvio; `versione` cambia a ogni modifica, così
può tenersele in memoria e ricaricarle solo quando serve.

## Come è fatto

```
Cliente chiama  →  Twilio  →  Media Streams (WebSocket)
                                   ↓
                    orchestratore Pipecat (repo separato, Python)
                      STT italiano · LLM Claude · TTS Fish Audio
                                   ↓
                       API del gestionale  /api/voice/*
                                   ↓
                    PostgreSQL — la stessa agenda del banco
```

L'assistente non sa niente per conto suo: ogni informazione e ogni scrittura
passa da uno strumento, e ogni strumento è una route qui dentro.

## Gli strumenti

Tutti `POST`, tutti con `Authorization: Bearer <VOICE_API_SECRET>`.

| Route | A cosa serve |
|---|---|
| `/api/voice/prompt` | Le istruzioni, con dentro i dati veri del centro |
| `/api/voice/info` | Orari, indirizzo, se oggi è aperto, categorie con fascia di prezzo |
| `/api/voice/treatments` | Il listino, filtrabile per categoria o per nome. Prezzi e durate separati donna/uomo |
| `/api/voice/lookup` | Chi sta chiamando, dal numero, con i suoi prossimi appuntamenti |
| `/api/voice/availability` | Quando c'è posto davvero |
| `/api/voice/book/verifica` | Controlla che l'orario regga, dà la frase da leggere e il gettone |
| `/api/voice/book` | Scrive in agenda — **solo col gettone** |
| `/api/voice/reschedule` | Sposta, fino a 24 ore prima |
| `/api/voice/cancel` | Disdice, fino a 24 ore prima |

### Perché la prenotazione è in due passi

Al telefono l'audio è a 8 kHz e i cognomi si sfasciano: "Cioffi" diventa
"Ciotti". Un appuntamento intestato al nome sbagliato è peggio di uno non
preso, perché nessuno se ne accorge finché la cliente non si presenta.

Scrivere "ripeti e fatti confermare" nelle istruzioni non basta: un modello che
sta reggendo una conversazione salta i passaggi, soprattutto se la cliente ha
fretta. Quindi la regola non è scritta, è la forma della porta —
`/api/voice/book` accetta solo un gettone firmato emesso da
`/api/voice/book/verifica`, e i dati li prende da lì, non dal corpo della
richiesta. Fra il "sì, corretto" e la riga scritta in agenda non può cambiare
niente.

Il gettone vive dieci minuti. Se è scaduto o manomesso, la risposta è sempre la
stessa: ripeti alla cliente e fatti confermare di nuovo.

### La regola delle 24 ore

Sotto le 24 ore l'assistente non sposta e non disdice: risponde `TOO_LATE` e
passa la chiamata. Quel posto non si rivende più, ed è una decisione da persone.
La soglia è `PREAVVISO_ORE` in [`src/lib/voice.ts`](src/lib/voice.ts).

## Il motore degli orari

Uno solo, [`src/lib/bookingEngine.ts`](src/lib/bookingEngine.ts) — lo stesso
dell'app clienti e della pagina `/prenota`. Rispetta il turno vero
dell'operatrice, la pausa, la settimana personalizzata di Staff → Turni, le
fasce bloccate in agenda e chi quel lavoro lo sa fare.

Prima le API vocali ne avevano uno tutto loro: 09:00–19:00 fisse, passo di
mezz'ora, turni ignorati. Proponeva le 15:00 a chi è in pausa. Se qualcuno
rimette mano a questa parte: `getFreeSlots` è deprecata, non va usata.

## Configurazione

`VOICE_API_SECRET` nelle variabili d'ambiente del gestionale, e la stessa nel
servizio Pipecat. Se manca, tutti gli endpoint rispondono 401 — cosa voluta:
meglio muto che aperto.

## Prove

```bash
curl -s -X POST https://erp.revobeauty.it/api/voice/info \
  -H "Authorization: Bearer $VOICE_API_SECRET"
```

La prova che conta sulla conferma: chiamare `/api/voice/book` **senza**
`tokenConferma` e verificare che risponda `428 SERVE_CONFERMA`. Se prenota lo
stesso, la garanzia è solo scritta nel prompt e non vale niente.


---

# La segretaria su WhatsApp

Accendila da **Automazioni → WhatsApp → Segretaria WhatsApp**. Spenta di
default: scrive da sola alle clienti e tocca l'agenda.

## Che cosa sostituisce

Prima, nella stessa chat, rispondevano tre cose diverse:

| Chi | Cosa faceva |
|---|---|
| Assistente AI (`wa-assistant.ts`) | Rispondeva alle domande e diceva «scrivi PRENOTA» |
| Bot prenotazione (`wa-booking.ts`) | Menù numerati: trattamento → giorno → orario |
| Agente spostamenti (`wa-spostamento.ts`) | Menù numerati, solo per spostare |

Tre interlocutori con tre memorie separate. La cliente si presentava
all'assistente, e il bot le chiedeva di nuovo come si chiama. Con la segretaria
accesa i tre non partono più da soli — ma una conversazione a menù già
cominciata si lascia finire, perché interrompere a metà chi ha appena scelto il
trattamento è peggio di qualunque bot.

Resta acceso `wa-assistant.ts` per chi la segretaria non l'ha accesa.

## Gli strumenti

Nessun dato viene dalla memoria del modello. Tutto passa da uno strumento che
legge il gestionale nel momento in cui viene chiamato.

| Strumento | A cosa serve |
|---|---|
| `chi_e` | Chi scrive, dal numero, con i suoi prossimi appuntamenti e la richiesta lasciata sul sito |
| `info_centro` | Orari, indirizzo, chiusure, categorie con fascia di prezzo |
| `listino` | Trattamenti con prezzo e durata veri, separati donna/uomo |
| `quando_c_e_posto` | Gli orari liberi davvero (`lib/bookingEngine`) |
| `verifica_prenotazione` | Riepilogo da scrivere + gettone. Non scrive niente |
| `prenota` | Scrive in agenda — **solo col gettone** |
| `sposta_appuntamento` | Sposta, fino a 24 ore prima |
| `disdici_appuntamento` | Disdice, fino a 24 ore prima |
| `passa_a_persona` | Avvisa il centro e tace per quattro ore |

Il motore degli orari è lo stesso di `/prenota`, dell'app clienti e
dell'assistente al telefono: se una prenotazione entra dall'app mentre la
conversazione è aperta, il posto risulta occupato al messaggio dopo. Non
esiste un secondo calendario.

Il gettone di conferma è quello di `lib/conferma.ts`, identico al telefono:
`prenota` senza gettone viene rifiutato, e i dati li prende dal gettone, non
dal messaggio. Fra il «sì, confermo» e la riga in agenda non può cambiare
niente.

Spostare e disdire passano da `lib/agendaAgente.ts`, le stesse funzioni che
usano `/api/voice/reschedule` e `/api/voice/cancel`: le due regole che contano —
il preavviso di 24 ore e il divieto sugli appuntamenti bloccati — stanno scritte
una volta sola.

## Un messaggio solo

È la parte che decide se un bot su WhatsApp è utile o insopportabile, e non si
risolve scrivendo «non mandare due messaggi» nelle istruzioni: il secondo
messaggio non lo decide il modello, lo decide l'infrastruttura che lo chiama due
volte. Sta tutto in `lib/wa-antiflood.ts`.

| Il modo di sbagliare | Il rimedio |
|---|---|
| La cliente scrive a raffica: tre messaggi in sei secondi, tre webhook, tre risposte | Si aspettano **7 secondi di silenzio** e si risponde una volta sola, con tutta la raffica davanti |
| Meta riconsegna lo stesso messaggio se il webhook tarda | Memoria degli **id già visti** per numero |
| Due webhook nello stesso istante fanno partire due turni paralleli | Un **fermo per numero**, preso in modo atomico (chiave primaria del database) |
| Il promemoria delle 18 atterra dentro una conversazione aperta | Le automazioni non mandano niente se **da meno di 30 minuti** è partito un altro messaggio |
| Il modello produce testo fra una chiamata di strumento e l'altra | Parte **solo l'ultimo**: il «ti controllo subito» non diventa una bolla |
| Lo stesso identico testo due volte | Rifiutato se è già partito **da meno di 10 minuti** |

Il turno gira **dopo** la risposta a Meta (`after()` di Next): un turno con gli
strumenti dura dai cinque ai venti secondi, e tenere aperta la richiesta per
tutto quel tempo fa scadere il webhook — che Meta riconsegna, con la stessa
domanda e una seconda risposta identica.

Dopo aver prenotato la segretaria **non** manda la conferma automatica: l'ha
appena scritto in chat, e un template identico subito dopo è il doppione che fa
silenziare la conversazione. Al telefono invece parte, perché lì la cliente non
ha niente di scritto in mano.

## Tetti e limiti

- **45 risposte al giorno** per numero (al telefono non c'è: lì paga il minuto).
- **8 giri di strumenti** per turno, poi risponde con quello che ha.
- **4 ore di silenzio** dopo `passa_a_persona`.
- Foto e vocali senza didascalia non arrivano alla segretaria: restano in chat e
  li legge una persona. Interpretare «📷 Foto» significherebbe rispondere a caso.

## Configurazione

- `ANTHROPIC_API_KEY` — obbligatoria.
- `VOICE_API_SECRET` — serve anche qui: firma il gettone di conferma. Senza,
  la segretaria non può prenotare.
- `WA_SEGRETARIA_MODEL` — facoltativa, per cambiare modello senza rilasciare.

## Prove

La prova che conta è sempre la stessa: mandare tre messaggi di fila e verificare
che arrivi **una** risposta. Poi provare a prenotare e controllare in agenda che
la riga sia identica a quella di una prenotazione al telefono.

---

# I contatti dal sito

Il modulo di `revobeauty.it/contatti` non inviava niente: mostrava «Messaggio
Inviato!» e svuotava i campi. Ogni richiesta arrivata dal sito si è persa.

Adesso: modulo → `POST /api/lead` → tabella `leads` → avviso Telegram → primo
messaggio WhatsApp (template) → la segretaria porta avanti la conversazione fino
all'appuntamento. Il contatto si vede in **Gestionale → Contatti dal sito**, e
avanza da solo di stato quando prenota.

Il pezzo da mettere su WordPress sta in [`integrazioni/wordpress/`](integrazioni/wordpress/),
con le istruzioni. Da qui il sito non si tocca: il tema `revobeauty` vive solo
sull'hosting, non in questo repository.
