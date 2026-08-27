"""
La telefonata: orecchie, cervello, bocca.

    Twilio  ──audio──►  Deepgram (trascrive)
                             ↓
                        Claude (capisce, chiama il gestionale, decide cosa dire)
                             ↓
    Twilio  ◄──audio──  Fish Audio (parla)

Le due cose che decidono se sembra una persona non sono la voce: sono
l'interruzione (se la cliente parla sopra, l'assistente si zittisce) e il
momento in cui capisce che hai finito di parlare. Le fa Pipecat, ed è il
motivo per cui usiamo Pipecat invece di incollare le tre API a mano.
"""

import datetime
import os

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.services.anthropic.llm import AnthropicLLMService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.fish.tts import FishAudioTTSService
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

import gestionale
import strumenti

# Twilio manda e vuole 8 kHz: è la banda del telefono, non si alza.
FREQUENZA = 8000

# La prima frase, sempre. Dichiararsi non è cortesia: chi lo scopre da solo a
# metà conversazione si sente preso in giro, e dal 2 agosto 2026 l'AI Act lo
# chiede anche come norma.
SALUTO = "RevoBeauty, sono l'assistente virtuale, dimmi pure."


def _oggi() -> str:
    """
    La data di oggi, in chiaro nel prompt.

    Un modello non sa che giorno è, e "giovedì prossimo" senza un oggi diventa
    una data inventata — che poi finisce in agenda.
    """
    ora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2)))
    giorni = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
    return f"Oggi è {giorni[ora.weekday()]} {ora.strftime('%d/%m/%Y')}, sono le {ora.strftime('%H:%M')}."


async def costruisci_bot(websocket, dati_chiamata: dict):
    """Monta la catena per UNA telefonata."""
    call_sid = dati_chiamata["call_sid"]
    stream_id = dati_chiamata["stream_id"]
    chiamante = dati_chiamata.get("from") or ""

    serializer = TwilioFrameSerializer(
        stream_sid=stream_id,
        call_sid=call_sid,
        account_sid=os.environ["TWILIO_ACCOUNT_SID"],
        auth_token=os.environ["TWILIO_AUTH_TOKEN"],
    )

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
            # Mezzo secondo di silenzio prima di considerare finita la frase.
            # Più corto e le si parla sopra mentre pensa; più lungo e sembra
            # che non abbia capito.
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.5)),
        ),
    )

    stt = DeepgramSTTService(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        live_options={"language": "it", "model": "nova-2", "smart_format": True},
    )

    tts = FishAudioTTSService(
        api_key=os.environ["FISH_API_KEY"],
        model=os.environ["FISH_VOICE_ID"],
        sample_rate=FREQUENZA,
    )

    llm = AnthropicLLMService(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        model=os.getenv("VOCE_MODEL", "claude-opus-5"),
    )

    # Le istruzioni le scrive il gestionale, non stanno qui: cambiare come
    # parla l'assistente non deve richiedere di rilasciare questo servizio.
    try:
        testo_istruzioni = await gestionale.istruzioni()
    except Exception as e:
        logger.error(f"istruzioni non caricate: {e}")
        testo_istruzioni = "Sei l'assistente di RevoBeauty. Se non riesci ad aiutare, passa la chiamata al centro."

    sistema = (
        f"{testo_istruzioni}\n\n{_oggi()}\n\n"
        f"La cliente sta chiamando dal numero {chiamante}. "
        f"Usa questo numero quando uno strumento te lo chiede: non chiederglielo."
    )

    context = OpenAILLMContext(
        messages=[{"role": "system", "content": sistema}],
        tools=strumenti.TUTTI,
    )
    aggregator = llm.create_context_aggregator(context)

    # ------------------------------------------------------------- strumenti
    trascrizione: list[dict] = []
    stato = {"esito": "nessuno", "appointmentId": None, "note": None,
             "clientId": None, "clientName": None}

    def _registra(nome_esito: str):
        stato["esito"] = nome_esito

    async def _info_centro(params):
        await params.result_callback(await gestionale.info_centro())

    async def _listino(params):
        await params.result_callback(await gestionale.listino(
            params.arguments.get("categoria"), params.arguments.get("cerca")))

    async def _chi_chiama(params):
        dati = await gestionale.chi_chiama(params.arguments.get("telefono") or chiamante)
        if dati.get("found"):
            cliente = dati.get("client") or {}
            stato["clientId"] = cliente.get("id")
            stato["clientName"] = f"{cliente.get('firstName','')} {cliente.get('lastName','')}".strip()
        await params.result_callback(dati)

    async def _quando_ce_posto(params):
        a = params.arguments
        await params.result_callback(await gestionale.quando_ce_posto(
            a["servizi"], a.get("data"), a.get("dalle"), a.get("giorni") or 7))

    async def _verifica(params):
        a = params.arguments
        await params.result_callback(await gestionale.verifica_prenotazione(
            a.get("telefono") or chiamante, a["servizi"], a["data"], a["ora"], a.get("nome")))

    async def _prenota(params):
        esito = await gestionale.prenota(params.arguments["token_conferma"])
        stato["appointmentId"] = (esito.get("appointment") or {}).get("id")
        _registra("prenotato")
        await params.result_callback(esito)

    async def _sposta(params):
        a = params.arguments
        esito = await gestionale.sposta(a["appuntamento_id"], a["nuova_data"], a["nuova_ora"])
        _registra("spostato")
        await params.result_callback(esito)

    async def _disdici(params):
        esito = await gestionale.disdici(params.arguments["appuntamento_id"])
        _registra("disdetto")
        await params.result_callback(esito)

    async def _passa(params):
        """
        Il trasferimento vero lo fa Twilio; qui si prepara il terreno e si
        annota il motivo. Se il centro non ha un numero configurato, dirle di
        richiamare è meglio che trasferirla nel vuoto.
        """
        stato["note"] = params.arguments.get("motivo")
        _registra("trasferito")
        info = await gestionale.info_centro()
        numero = (info.get("centro") or {}).get("telefono")
        await params.result_callback({
            "trasferimento": bool(numero),
            "numero": numero,
            "istruzione": (
                "Di' alla cliente che la passi a una collega, poi saluta."
                if numero else
                "Non c'è nessuno a cui passarla: scusati, dille che la faremo richiamare, e saluta."
            ),
        })

    for nome, funzione in [
        ("info_centro", _info_centro), ("listino", _listino), ("chi_chiama", _chi_chiama),
        ("quando_ce_posto", _quando_ce_posto), ("verifica_prenotazione", _verifica),
        ("prenota", _prenota), ("sposta", _sposta), ("disdici", _disdici),
        ("passa_a_persona", _passa),
    ]:
        llm.register_function(nome, funzione)

    # ------------------------------------------------------------- pipeline
    pipeline = Pipeline([
        transport.input(),
        stt,
        aggregator.user(),
        llm,
        tts,
        transport.output(),
        aggregator.assistant(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(
        audio_in_sample_rate=FREQUENZA,
        audio_out_sample_rate=FREQUENZA,
        allow_interruptions=True,
    ))

    iniziata = datetime.datetime.now(datetime.timezone.utc)

    @transport.event_handler("on_client_connected")
    async def _benvenuto(_transport, _client):
        context.add_message({"role": "assistant", "content": SALUTO})
        await task.queue_frames([aggregator.assistant().get_context_frame()])

    @transport.event_handler("on_client_disconnected")
    async def _chiusa(_transport, _client):
        durata = (datetime.datetime.now(datetime.timezone.utc) - iniziata).total_seconds()
        for m in context.get_messages():
            if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
                trascrizione.append({
                    "chi": "cliente" if m["role"] == "user" else "assistente",
                    "testo": m["content"],
                })
        await gestionale.registra_chiamata({
            "callId": call_sid, "phone": chiamante,
            "clientId": stato["clientId"], "clientName": stato["clientName"],
            "iniziata": iniziata.isoformat(), "durata": int(durata),
            "esito": stato["esito"] if stato["esito"] != "nessuno" or not trascrizione else "info",
            "appointmentId": stato["appointmentId"],
            "trascrizione": trascrizione, "note": stato["note"],
        })
        await task.cancel()

    return PipelineRunner(handle_sigint=False), task
