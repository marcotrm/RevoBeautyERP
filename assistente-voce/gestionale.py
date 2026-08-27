"""
Il ponte verso il gestionale.

L'assistente non sa niente per conto suo: orari, listino, agenda e clienti
stanno tutti di là, e ogni cosa che dice o scrive passa da qui. È voluto —
una voce che si ricorda i prezzi a memoria prima o poi ne dice uno vecchio.

Ogni funzione qui sotto corrisponde a una route /api/voice/* del gestionale.
Le firme sono quelle che vede il modello, quindi i nomi dei parametri sono in
italiano: è il modello che li deve capire, non un altro programma.
"""

import os
from typing import Any

import httpx

ERP_URL = os.getenv("ERP_URL", "https://erp.revobeauty.it").rstrip("/")
SEGRETO = os.getenv("VOICE_API_SECRET", "")

# Una telefonata non aspetta: meglio dire "non riesco a controllare" che
# lasciare dieci secondi di silenzio mentre il gestionale ci pensa.
TIMEOUT = httpx.Timeout(8.0, connect=4.0)


class GestionaleError(Exception):
    """Il gestionale ha risposto male. Il messaggio è già in italiano, da dire."""


async def _chiama(percorso: str, corpo: dict[str, Any] | None = None) -> dict[str, Any]:
    if not SEGRETO:
        raise GestionaleError("Assistente non configurato: manca VOICE_API_SECRET.")

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            f"{ERP_URL}/api/voice/{percorso}",
            headers={"Authorization": f"Bearer {SEGRETO}"},
            json=corpo or {},
        )

    try:
        dati = r.json()
    except Exception:
        raise GestionaleError("Non riesco a leggere la risposta del gestionale.")

    # 401 e 5xx sono problemi nostri, non della cliente: non vanno raccontati.
    if r.status_code == 401:
        raise GestionaleError("Assistente non autorizzato dal gestionale.")
    if r.status_code >= 500:
        raise GestionaleError("Il gestionale non risponde in questo momento.")

    # 4xx invece porta un messaggio scritto per essere detto ad alta voce
    # (orario non più libero, troppo tardi per disdire, serve il nome...).
    if r.status_code >= 400:
        raise GestionaleError(
            dati.get("message") or dati.get("messaggio") or dati.get("error")
            or "Non sono riuscita a farlo."
        )

    return dati


# --------------------------------------------------------------- informazioni

async def info_centro() -> dict[str, Any]:
    """Orari, indirizzo, se oggi è aperto, categorie con fascia di prezzo."""
    return await _chiama("info")


async def istruzioni() -> str:
    """Il prompt, scritto e modificabile dal gestionale."""
    dati = await _chiama("prompt", {"canale": "telefono"})
    return dati.get("prompt", "")


async def listino(categoria: str | None = None, cerca: str | None = None) -> dict[str, Any]:
    """Il listino, filtrato. Senza filtri sono duecento voci: al telefono non servono."""
    return await _chiama("treatments", {"categoria": categoria, "cerca": cerca})


async def chi_chiama(telefono: str) -> dict[str, Any]:
    """La scheda di chi sta chiamando e i suoi prossimi appuntamenti."""
    return await _chiama("lookup", {"phone": telefono})


# ------------------------------------------------------------------- agenda

async def quando_ce_posto(
    servizi: list[dict[str, Any]],
    data: str | None = None,
    dalle: str | None = None,
    giorni: int = 7,
) -> dict[str, Any]:
    """Gli orari liberi veri: turni, pause e competenze già considerati."""
    return await _chiama("availability", {
        "services": servizi, "date": data, "from": dalle, "giorni": giorni,
    })


async def verifica_prenotazione(
    telefono: str, servizi: list[dict[str, Any]], data: str, ora: str,
    nome: str | None = None,
) -> dict[str, Any]:
    """
    Il passo obbligatorio prima di prenotare.

    Restituisce `riepilogo` — da leggere alla cliente PAROLA PER PAROLA — e un
    `tokenConferma`. Senza quel gettone il gestionale rifiuta di scrivere in
    agenda, ed è apposta: al telefono i cognomi si sentono male, e un
    appuntamento intestato al nome sbagliato non se lo accorge nessuno finché
    la cliente non si presenta.
    """
    return await _chiama("book/verifica", {
        "phone": telefono, "services": servizi, "date": data,
        "startTime": ora, "clientName": nome,
    })


async def prenota(token_conferma: str) -> dict[str, Any]:
    """Scrive in agenda. Solo col gettone, e i dati li prende da lì."""
    return await _chiama("book", {"tokenConferma": token_conferma})


async def sposta(appuntamento_id: str, nuova_data: str, nuova_ora: str) -> dict[str, Any]:
    """Sposta un appuntamento. Sotto le 24 ore il gestionale dice di no."""
    return await _chiama("reschedule", {
        "appointmentId": appuntamento_id, "newDate": nuova_data, "newTime": nuova_ora,
    })


async def disdici(appuntamento_id: str) -> dict[str, Any]:
    """Disdice. Sotto le 24 ore il gestionale dice di no e si passa al centro."""
    return await _chiama("cancel", {"appointmentId": appuntamento_id})


# ------------------------------------------------------------------ registro

async def registra_chiamata(chiamata: dict[str, Any]) -> None:
    """
    Deposita la telefonata nel registro, a chiamata chiusa.

    Non deve mai far fallire niente: se il registro non prende, la telefonata
    è comunque avvenuta e l'appuntamento è comunque in agenda.
    """
    try:
        await _chiama("chiamata", chiamata)
    except Exception:
        pass
