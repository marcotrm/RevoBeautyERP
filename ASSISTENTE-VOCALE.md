# Superato — vedi ASSISTENTE.md

Questo documento descriveva un assistente vocale su ElevenLabs che non prenota
appuntamenti. Sono due cose non più vere, ed erano pericolose da lasciare in
giro: il prompt qui dentro diceva alla cliente *«per questo la faccio
richiamare da una collega»* anche per una prenotazione normale, e chi lo avesse
copiato in una configurazione si sarebbe ritrovato un assistente che rifiuta il
lavoro per cui è stato fatto.

Tutto quello che serve sta in **[ASSISTENTE.md](ASSISTENTE.md)**: architettura,
strumenti, protocollo di conferma, configurazione e prove.

Le istruzioni dell'assistente non si copiano più a mano da nessun file: si
costruiscono in [`src/lib/istruzioniAssistente.ts`](src/lib/istruzioniAssistente.ts)
e si servono da `POST /api/voice/prompt`.

La versione originale resta nella storia di git, se dovesse servire.
