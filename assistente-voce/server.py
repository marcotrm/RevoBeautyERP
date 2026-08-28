"""
Il centralino: risponde a Twilio e apre la linea verso il bot.

Due porte sole. Twilio chiama /twiml quando squilla il telefono, riceve
l'istruzione di aprire uno stream, e da lì in poi l'audio passa su /ws per
tutta la durata della chiamata.

È il motivo per cui questo non può stare dentro il gestionale: una telefonata
tiene aperta una connessione per minuti interi, e Next.js non è fatto per
quello.
"""

import os
from html import escape
from urllib.parse import parse_qs

import uvicorn
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
from pipecat.runner.utils import parse_telephony_websocket

from bot import costruisci_bot, leggi

app = FastAPI(title="RevoBeauty — assistente al telefono")


@app.get("/")
async def salute():
    """
    Railway e chiunque passi di qui: dice se il servizio è in piedi e se ha
    tutto quello che gli serve. Elenca cosa MANCA, non cosa c'è: le chiavi non
    si stampano.
    """
    servono = [
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "DEEPGRAM_API_KEY",
        "ANTHROPIC_API_KEY", "VOICE_API_SECRET",
    ]
    # Le chiavi di Fish servono solo se e' Fish a parlare: chiederle a chi ha
    # scelto Deepgram farebbe risultare "non pronto" un servizio che funziona.
    if os.getenv("VOCE_TTS", "fish").lower() != "deepgram":
        servono += ["FISH_API_KEY", "FISH_VOICE_ID"]
    mancano = [v for v in servono if not os.getenv(v)]
    return JSONResponse({
        "servizio": "assistente-voce",
        "pronto": not mancano,
        "mancano": mancano,
        "gestionale": os.getenv("ERP_URL", "https://erp.revobeauty.it"),
    })


@app.post("/twiml")
async def twiml(request: Request):
    """
    La risposta allo squillo: "apri uno stream verso di me".

    L'indirizzo si ricava dall'host della richiesta, così lo stesso codice
    funziona su Railway e dietro un tunnel di prova senza cambiare niente.
    """
    host = request.headers.get("x-forwarded-host") or request.url.hostname
    ws = f"wss://{host}/ws"

    # Il numero di chi chiama si passa allo stream a mano.
    #
    # Twilio lo manda QUI, nel form della richiesta, e non lo rimette dentro
    # il canale audio: se non lo si inoltra, dall'altra parte `from` resta
    # vuoto e l'assistente non riconosce nessuna cliente — chiede il nome a
    # chi ha la scheda da tre anni. I `<Parameter>` dentro `<Stream>` sono la
    # via prevista da Twilio, e arrivano al bot dentro `body`.
    # Si legge il corpo grezzo invece di `request.form()`: quello pretende
    # `python-multipart`, che qui non c'e' — e una dipendenza in piu' per
    # leggere due campi da una form-urlencoded non vale il rischio di un
    # servizio che non parte.
    campi = parse_qs((await request.body()).decode("utf-8", "ignore"))
    chiamante = (campi.get("From") or [""])[0]
    call_sid = (campi.get("CallSid") or [""])[0]

    logger.info(f"chiamata in arrivo da {chiamante or 'numero sconosciuto'} — stream verso {ws}")

    parametri = "".join(
        f'<Parameter name="{nome}" value="{escape(valore, quote=True)}" />'
        for nome, valore in (("from", chiamante), ("call_sid", call_sid))
        if valore
    )
    return HTMLResponse(
        content=(
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<Response><Connect><Stream url="{ws}">{parametri}</Stream></Connect></Response>'
        ),
        media_type="application/xml",
    )


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    try:
        _tipo, dati = await parse_telephony_websocket(websocket)
        logger.info(f"telefonata da {leggi(dati, 'from') or '?'} — {leggi(dati, 'call_sid') or '?'}")
        runner, task = await costruisci_bot(websocket, dati)
        await runner.run(task)
    except Exception as e:
        # Una telefonata che casca non deve portarsi giù il servizio: la
        # prossima cliente deve trovare la linea libera.
        logger.exception(f"telefonata interrotta: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
