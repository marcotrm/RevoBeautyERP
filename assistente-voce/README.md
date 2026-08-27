# RevoBeauty — l'assistente al telefono

La voce che risponde al numero del centro: dà informazioni su orari, prezzi e
trattamenti, prenota, sposta, disdice, e passa la chiamata a una persona quando
serve. Tutto letto e scritto sul gestionale, mai a memoria.

Vive qui dentro accanto ad `app-clienti/`, ma è un **servizio a sé** su Railway:
è Python, e una telefonata tiene aperta una connessione per minuti interi —
Next.js non è fatto per quello.

## Com'è fatto

```
la cliente chiama
      ↓
Twilio  ──POST /twiml──►  "apri uno stream"
      ↓
Twilio  ══ audio 8 kHz ══►  /ws
                              ↓
                    Deepgram   (capisce)
                              ↓
                    Claude     (decide, chiama il gestionale)
                              ↓
                    Fish Audio (parla)
                              ↓
              erp.revobeauty.it/api/voice/*
                              ↓
                    la stessa agenda del banco
```

| File | Cosa fa |
|---|---|
| `server.py` | Risponde allo squillo e apre la linea |
| `bot.py` | Monta orecchie, cervello e bocca per una telefonata |
| `gestionale.py` | Il ponte verso `/api/voice/*` |
| `strumenti.py` | Cosa il modello può fare, descritto per il modello |

Le **istruzioni non stanno qui**: si chiedono al gestionale a ogni telefonata
(`/api/voice/prompt`). Cambiare come parla l'assistente non richiede di
rilasciare questo servizio.

## Perché Pipecat

Deepgram capisce, Claude ragiona, e a parlare c'è Fish Audio oppure Deepgram
Aura — si sceglie con `VOCE_TTS`. Fra
quelle tre e un telefono che squilla manca il pezzo che tiene in piedi la
conversazione: accettare lo stream, capire quando la cliente ha finito di
parlare, e **zittire la voce a metà frase quando parla sopra**. Sono le due
cose che fanno la differenza fra "sembra una persona" e "sembra un centralino
del 2010", e sono precisamente quelle che sbaglieremmo per un mese scrivendole
a mano.

## La regola che non si aggira

Per prenotare servono due passaggi:

1. `verifica_prenotazione` → restituisce la frase da leggere e un gettone
2. si legge la frase **parola per parola** e si aspetta il sì
3. `prenota` col gettone

Il gestionale rifiuta di scrivere in agenda senza quel gettone. Non è una
regola scritta nel prompt che il modello può saltare quando ha fretta: è la
forma della porta. Al telefono i cognomi si sentono male — "Cioffi" diventa
"Ciotti" — e un appuntamento intestato al nome sbagliato non se ne accorge
nessuno finché la cliente non si presenta.

## Variabili

Copia `.env.example` in `.env` per le prove locali. Su Railway:
`VOICE_API_SECRET` e `ANTHROPIC_API_KEY` come **Shared Variable**, così non
possono disallinearsi col gestionale.

`GET /` dice se manca qualcosa, senza stampare le chiavi.

## Come si prova

```bash
pip install -r requirements.txt
uvicorn server:app --reload --port 8080
curl localhost:8080/
```

Per una telefonata vera serve un indirizzo pubblico: apri un tunnel verso la
porta 8080 e metti `https://<tunnel>/twiml` nel campo **A CALL COMES IN** del
numero, su Twilio → Phone Numbers → il numero → Configure.

In produzione lo stesso campo punta a `https://<servizio>.up.railway.app/twiml`.

## Prove da fare prima di aprire il numero al pubblico

Da un telefono vero, con rumore intorno:

- un cognome difficile, e **correggerlo a metà** («sono Varone… no, Barone»):
  deve ripetere quello giusto e aspettare il sì, non prenotare il primo
- rispondere **no** alla conferma: deve tornare indietro sul dato, non
  ricominciare la conversazione da capo
- parlarle sopra mentre sta parlando: deve zittirsi
- chiedere una cosa medica: non deve rispondere, deve proporre la visita
- chiedere di parlare con una persona: deve passare la chiamata

## Stato

**Scritto, mai eseguito.** Manca il numero di telefono e mancano le chiavi,
quindi non è ancora stato provato contro Twilio né contro Fish Audio. Pipecat
cambia spesso i nomi delle classi fra una versione e l'altra: alla prima
esecuzione qualche import o qualche parametro andrà quasi certamente
aggiustato. Il primo `pip install` e il primo `uvicorn` sono parte del lavoro,
non un dettaglio.


## La voce: Fish o Deepgram

Di partenza parla **Fish Audio**, perché quella è la voce che il centro ha già
scelto e sentito. Con `VOCE_TTS=deepgram` parla invece **Aura-2**, che
dall'aggiornamento di dicembre 2025 sa l'italiano.

```
VOCE_TTS=deepgram
DEEPGRAM_VOICE_ID=aura-2-maia-it     # l'elenco vero: GET https://api.deepgram.com/v1/models
```

Non è una questione di gusto, è di catena. Con Deepgram la chiave è la stessa
che usiamo già per capire — e che sul gestionale trascrive i vocali di WhatsApp
— quindi c'è un fornitore in meno da pagare, da configurare e da vedere cadere
di notte. E capire e parlare passano dallo stesso servizio: ogni salto fra
fornitori diversi è latenza, e al telefono la latenza è la differenza fra una
conversazione e un'attesa.

Il contrario vale se la voce di Fish è quella giusta per il centro: una voce
che piace batte mezzo secondo di latenza. Per questo si cambia con una
variabile e non con un rilascio.

Quando `VOCE_TTS=deepgram`, `FISH_API_KEY` e `FISH_VOICE_ID` non servono più e
il servizio non le chiede.
