# L'assistente di RevoBeauty

Un cervello solo, due bocche: WhatsApp e telefono. Identità, poteri e limiti
sono gli stessi; cambia solo il modo di dirli.

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
