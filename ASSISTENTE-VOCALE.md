# Assistente Vocale AI — Guida alla configurazione

L'assistente vocale (voce donna, italiano) risponde al telefono, riconosce i clienti dal numero
di telefono e può **controllare, spostare e cancellare** gli appuntamenti in agenda.

## Architettura

```
Cliente chiama → ElevenLabs Agent (voce + conversazione)
              → chiama le API del gestionale (tools)
              → legge/modifica l'agenda su PostgreSQL
```

## API disponibili nel gestionale

Tutti gli endpoint sono `POST`, richiedono l'header `Authorization: Bearer <VOICE_API_SECRET>`
(il valore è nel file `.env`) e rispondono in JSON.

| Endpoint | Input | Cosa fa |
|---|---|---|
| `/api/voice/lookup` | `{ "phone": "+39..." }` | Trova il cliente dal telefono e i suoi prossimi appuntamenti |
| `/api/voice/availability` | `{ "date": "YYYY-MM-DD", "operatorId"?: "...", "duration"?: 60 }` | Orari liberi (09:00–19:00, passi di 30 min) |
| `/api/voice/reschedule` | `{ "appointmentId": "...", "newDate": "YYYY-MM-DD", "newTime": "HH:MM" }` | Sposta un appuntamento (controlla i conflitti) |
| `/api/voice/cancel` | `{ "appointmentId": "..." }` | Cancella un appuntamento (soft delete, stato `cancelled`) |

Protezioni incluse: token obbligatorio, date nel passato rifiutate, appuntamenti `isLocked`
non modificabili al telefono, controllo sovrapposizioni per operatrice.

## Setup su ElevenLabs (piano gratuito per iniziare)

1. Crea un account su **elevenlabs.io** → sezione **Agents Platform** (Conversational AI).
2. Crea un nuovo Agent:
   - **Lingua**: Italiano
   - **Voce**: scegli una voce femminile italiana (es. una voce della libreria con tag "Italian")
   - **First message**: `Centro estetico Revobeauty, sono Sofia, come posso aiutarla?`
   - **System prompt**: copia quello qui sotto
3. In **Tools**, aggiungi 4 "Webhook tools" (uno per endpoint, vedi sotto).
   - In ogni tool aggiungi l'header: `Authorization: Bearer <VOICE_API_SECRET>`
   - URL base: `https://TUO-DOMINIO/api/voice/...` (l'URL dove è deployata l'app)
4. Testa gratis dal **widget web** nella dashboard ElevenLabs (pulsante "Test agent").
5. Quando funziona: collega un numero di telefono (sezione **Phone numbers**, via Twilio o
   SIP trunk) e assegnalo all'agent. Abilita il passaggio del **caller ID** così l'agent
   riceve il numero del chiamante nella variabile `{{system__caller_id}}`.

> **Importante**: aggiungi `VOICE_API_SECRET` anche alle variabili d'ambiente del deploy
> (Vercel/Railway), non solo nel `.env` locale.

## System prompt per l'agente (da copiare)

```
Sei Sofia, la receptionist del centro estetico Revobeauty. Parli SOLO italiano, con tono
caldo, professionale e conciso — le frasi lunghe al telefono stancano.

Data di oggi: {{system__time_utc}}. Il numero del chiamante è {{system__caller_id}}.

COSA SAI FARE:
- controllare i prossimi appuntamenti di un cliente
- spostare un appuntamento a un'altra data/ora
- cancellare un appuntamento

COME LAVORI:
1. Appena inizia la chiamata, usa il tool "lookup" con il numero del chiamante.
   - Se il cliente è riconosciuto, salutalo per nome (es. "Buongiorno Maria!").
   - Se non è riconosciuto, chiedi gentilmente il numero di telefono con cui è registrato
     e riprova il lookup.
2. Se chiede quando ha l'appuntamento: leggi i dati dal lookup (data, ora, trattamento,
   operatrice). Di' le date in modo naturale ("venerdì 4 luglio alle 10").
3. Se vuole spostare un appuntamento:
   - chiedi la data preferita, poi usa "availability" (passa la durata dell'appuntamento
     esistente) e proponi 2-3 orari liberi, non tutta la lista
   - quando sceglie, RIPETI data e ora per conferma ("Quindi sposto la pulizia viso a
     sabato 5 luglio alle 15, confermo?") e solo dopo il suo sì usa "reschedule"
4. Se vuole cancellare: chiedi conferma esplicita prima di usare "cancel".
5. Se un tool risponde con un errore o un conflitto, spiegalo con calma e proponi
   un'alternativa.

REGOLE:
- Mai inventare orari o appuntamenti: usa sempre i tools.
- Non dare mai informazioni su altri clienti.
- Per prenotazioni nuove, pagamenti o richieste complesse: "Per questo la faccio
  richiamare da una collega" e suggerisci di chiamare in orario di apertura (9-19).
- Date sempre in formato YYYY-MM-DD e orari HH:MM quando chiami i tools.
```

## Definizione dei 4 tools (webhook)

### 1. `lookup`
- **Descrizione**: Trova un cliente dal numero di telefono e restituisce i suoi prossimi appuntamenti con i loro ID.
- **URL**: `POST https://TUO-DOMINIO/api/voice/lookup`
- **Body**: `phone` (string, obbligatorio) — numero di telefono del cliente

### 2. `availability`
- **Descrizione**: Restituisce gli orari liberi delle operatrici in una data. Usare prima di spostare un appuntamento.
- **URL**: `POST https://TUO-DOMINIO/api/voice/availability`
- **Body**: `date` (string YYYY-MM-DD, obbligatorio), `operatorId` (string, opzionale), `duration` (number minuti, opzionale, default 60)

### 3. `reschedule`
- **Descrizione**: Sposta un appuntamento esistente a nuova data e ora. Usare solo dopo conferma esplicita del cliente.
- **URL**: `POST https://TUO-DOMINIO/api/voice/reschedule`
- **Body**: `appointmentId` (string), `newDate` (string YYYY-MM-DD), `newTime` (string HH:MM)

### 4. `cancel`
- **Descrizione**: Cancella un appuntamento. Usare solo dopo conferma esplicita del cliente.
- **URL**: `POST https://TUO-DOMINIO/api/voice/cancel`
- **Body**: `appointmentId` (string)

## Test rapido da terminale

```bash
SECRET="<valore di VOICE_API_SECRET>"
curl -X POST https://TUO-DOMINIO/api/voice/lookup \
  -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
  -d '{"phone":"+39 333 1001001"}'
```

## Costi indicativi

| Voce | Costo |
|---|---|
| ElevenLabs free tier | ~15 min/mese gratis (test via widget web) |
| ElevenLabs Starter | ~5 $/mese, più minuti |
| Numero Twilio | ~1 €/mese + ~0,01 €/min (credito di prova iniziale gratuito) |
| Conversazione AI | ~0,08–0,10 €/min sul piano a pagamento |
