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

import uvicorn
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
from pipecat.runner.utils import parse_telephony_websocket

from bot import costruisci_bot

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
    logger.info(f"chiamata in arrivo, stream verso {ws}")
    return HTMLResponse(
        content=(
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<Response><Connect><Stream url="{ws}" /></Connect></Response>'
        ),
        media_type="application/xml",
    )


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    try:
        _tipo, dati = await parse_telephony_websocket(websocket)
        logger.info(f"telefonata da {dati.get('from')} — {dati.get('call_sid')}")
        runner, task = await costruisci_bot(websocket, dati)
        await runner.run(task)
    except Exception as e:
        # Una telefonata che casca non deve portarsi giù il servizio: la
        # prossima cliente deve trovare la linea libera.
        logger.exception(f"telefonata interrotta: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
