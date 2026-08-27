"""
Gli strumenti che il modello può usare durante la telefonata.

Sono descritti in italiano perché è il modello a leggerli, e perché tutta la
conversazione è in italiano: costringerlo a saltare fra due lingue gli fa
sbagliare i nomi dei parametri.

Le descrizioni non sono documentazione, sono istruzioni operative. Dove c'è
scritto "leggi la frase parola per parola" è perché il modello, lasciato
libero, riassume — e riassumendo perde il cognome, che è l'unica cosa che
volevamo far confermare.
"""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema

SERVIZI = {
    "type": "array",
    "description": "I trattamenti richiesti, nell'ordine in cui si faranno.",
    "items": {
        "type": "object",
        "properties": {
            "treatmentId": {"type": "string", "description": "L'id del trattamento a listino."},
            "operatorId": {
                "type": "string",
                "description": "L'id dell'operatrice, se la cliente ne ha chiesta una. Altrimenti ometti.",
            },
        },
        "required": ["treatmentId"],
    },
}

info_centro = FunctionSchema(
    name="info_centro",
    description=(
        "Orari di apertura, indirizzo, se oggi il centro è aperto, e le categorie "
        "di trattamenti con la fascia di prezzo. Chiamalo una volta all'inizio."
    ),
    properties={},
    required=[],
)

listino = FunctionSchema(
    name="listino",
    description=(
        "I trattamenti con prezzo e durata, separati per donna e uomo. "
        "Filtra sempre: senza filtro sono duecento voci. Usa 'cerca' con la parola "
        "che ha detto la cliente (es. 'baffetto'), oppure 'categoria'."
    ),
    properties={
        "categoria": {
            "type": "string",
            "description": "nails, laser, waxing, facial, body, massage, makeup, consultation, hair",
        },
        "cerca": {"type": "string", "description": "Parte del nome del trattamento."},
    },
    required=[],
)

chi_chiama = FunctionSchema(
    name="chi_chiama",
    description=(
        "Chi è la cliente, dal numero da cui sta chiamando, con i suoi prossimi "
        "appuntamenti. Chiamalo all'inizio: se la riconosci NON le chiedere come si "
        "chiama, gliela confermi e basta."
    ),
    properties={"telefono": {"type": "string", "description": "Il numero da cui chiama."}},
    required=["telefono"],
)

quando_ce_posto = FunctionSchema(
    name="quando_ce_posto",
    description=(
        "Gli orari liberi veri, con turni delle operatrici e agenda già considerati. "
        "Non proporre MAI un orario che non arrivi da qui. Ne dici due o tre alla "
        "volta, non tutti."
    ),
    properties={
        "servizi": SERVIZI,
        "data": {"type": "string", "description": "Un giorno solo, formato AAAA-MM-GG. Ometti per i primi giorni utili."},
        "dalle": {"type": "string", "description": "Ora minima, formato HH:MM, se la cliente ha una preferenza."},
        "giorni": {"type": "integer", "description": "Quanti giorni guardare avanti. Di solito 7."},
    },
    required=["servizi"],
)

verifica_prenotazione = FunctionSchema(
    name="verifica_prenotazione",
    description=(
        "OBBLIGATORIO prima di prenotare. Controlla che l'orario regga e ti "
        "restituisce 'riepilogo' e 'tokenConferma'. "
        "Devi LEGGERE ALLA CLIENTE il campo 'riepilogo' PAROLA PER PAROLA — non "
        "riassumerlo, non riformularlo — e aspettare che dica di sì. "
        "Se corregge qualcosa, richiama questo strumento col dato giusto: il "
        "gettone vecchio non vale più."
    ),
    properties={
        "telefono": {"type": "string"},
        "servizi": SERVIZI,
        "data": {"type": "string", "description": "AAAA-MM-GG"},
        "ora": {"type": "string", "description": "HH:MM, preso da quando_ce_posto"},
        "nome": {"type": "string", "description": "Nome e cognome, solo se la cliente non è già in rubrica."},
    },
    required=["telefono", "servizi", "data", "ora"],
)

prenota = FunctionSchema(
    name="prenota",
    description=(
        "Scrive l'appuntamento in agenda. Chiamalo SOLO dopo che la cliente ha "
        "confermato il riepilogo che le hai letto. Senza il gettone il gestionale "
        "rifiuta, quindi non provare a saltare la verifica."
    ),
    properties={"token_conferma": {"type": "string", "description": "Il tokenConferma di verifica_prenotazione."}},
    required=["token_conferma"],
)

sposta = FunctionSchema(
    name="sposta",
    description=(
        "Sposta un appuntamento esistente. Ripeti alla cliente il vecchio e il nuovo "
        "orario e aspetta il sì prima di chiamarlo. Sotto le 24 ore il gestionale "
        "rifiuta: in quel caso passa la chiamata, non insistere."
    ),
    properties={
        "appuntamento_id": {"type": "string"},
        "nuova_data": {"type": "string", "description": "AAAA-MM-GG"},
        "nuova_ora": {"type": "string", "description": "HH:MM"},
    },
    required=["appuntamento_id", "nuova_data", "nuova_ora"],
)

disdici = FunctionSchema(
    name="disdici",
    description=(
        "Disdice un appuntamento. Ripetiglielo per intero e aspetta il sì: stai "
        "cancellando qualcosa che esiste. Sotto le 24 ore il gestionale rifiuta e "
        "si passa la chiamata."
    ),
    properties={"appuntamento_id": {"type": "string"}},
    required=["appuntamento_id"],
)

passa_a_persona = FunctionSchema(
    name="passa_a_persona",
    description=(
        "Passa la telefonata a una collega del centro. Usalo quando la cliente lo "
        "chiede, quando la domanda è medica, quando si parla di soldi o rimborsi, "
        "e quando dopo due tentativi non hai capito. Dille sempre che la stai "
        "passando prima di farlo."
    ),
    properties={"motivo": {"type": "string", "description": "Perché passi la chiamata. Finisce nel registro."}},
    required=["motivo"],
)

TUTTI = ToolsSchema(standard_tools=[
    info_centro, listino, chi_chiama, quando_ce_posto,
    verifica_prenotazione, prenota, sposta, disdici, passa_a_persona,
])
