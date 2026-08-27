"""
La telefonata: orecchie, cervello, bocca.

    Twilio  ──audio──►  Deepgram (trascrive)
                             ↓
                        Claude (capisce, chiama il gestionale, decide cosa dire)
                             ↓
    Twilio  ◄──audio──  Fish Audio o Deepgram Aura (parla)

Le due cose che decidono se sembra una persona non sono la voce: sono
l'interruzione (se la cliente parla sopra, l'assistente si zittisce) e il
momento in cui capisce che hai finito di parlare. Le fa Pipecat, ed è il
motivo per cui usiamo Pipecat invece di incollare le tre API a mano.
"""

import datetime
import os

import httpx
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
from pipecat.services.deepgram.tts import DeepgramTTSService
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

    # ------------------------------------------------------------------ voce
    #
    # Due strade, e si sceglie con VOCE_TTS. Di partenza resta Fish, perche'
    # quella e' la voce che il centro ha gia' scelto e sentito.
    #
    # Deepgram e' l'alternativa piu' semplice, non la piu' furba: da dicembre
    # 2025 Aura-2 parla italiano, la chiave e' la stessa che usiamo gia' per
    # capire (e su WhatsApp per i vocali), e togliere un fornitore dalla catena
    # toglie anche un posto dove le cose si rompono di notte. In piu' capire e
    # parlare passano dallo stesso servizio, che sul telefono si sente: ogni
    # salto fra fornitori diversi e' latenza, e al telefono la latenza e' la
    # differenza fra una conversazione e un'attesa.
    if os.getenv("VOCE_TTS", "fish").lower() == "deepgram":
        tts = DeepgramTTSService(
            api_key=os.environ["DEEPGRAM_API_KEY"],
            # I nomi delle voci sono "aura-2-<nome>-<lingua>": per l'italiano
            # si guarda l'elenco vero con GET https://api.deepgram.com/v1/models
            # invece di indovinarlo.
            voice=os.getenv("DEEPGRAM_VOICE_ID", "aura-2-maia-it"),
            sample_rate=FREQUENZA,
        )
    else:
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

    async def _trasferisci(numero: str) -> bool:
        """
        Riscrive il TwiML della chiamata in corso: Twilio chiude lo stream
        verso di noi e compone il numero.

        Torna vero solo se Twilio ha accettato. Se fallisce — numero scritto
        male, credenziali scadute, chiamata gia' chiusa — chi chiama deve
        sentirsi dire che la faremo richiamare, non «ti passo una collega»
        seguito dal nulla.
        """
        twiml = f"<Response><Dial>{numero}</Dial></Response>"
        url = (
            f"https://api.twilio.com/2010-04-01/Accounts/"
            f"{os.environ['TWILIO_ACCOUNT_SID']}/Calls/{call_sid}.json"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    url,
                    data={"Twiml": twiml},
                    auth=(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]),
                )
            if r.status_code >= 400:
                logger.error(f"trasferimento a {numero} rifiutato da Twilio: {r.status_code} {r.text[:300]}")
                return False
            logger.info(f"chiamata {call_sid} passata a {numero}")
            return True
        except Exception as e:
            logger.exception(f"trasferimento a {numero} non riuscito: {e}")
            return False

    async def _passa(params):
        """
        Passa la chiamata a una persona. Davvero.

        Qui c'era scritto «il trasferimento vero lo fa Twilio», e non lo faceva
        nessuno: l'assistente diceva «ti passo una collega» e poi restava in
        linea da sola. Alla cliente arrivava un silenzio, che è il modo
        peggiore di finire una telefonata — peggio di sentirsi dire «richiami
        più tardi», perché sembra che sia caduta la linea per colpa sua.

        Il trasferimento si fa riscrivendo il TwiML della chiamata in corso:
        Twilio stacca lo stream verso di noi e compone il numero. Da quel
        momento il bot non c'entra più niente.
        """
        stato["note"] = params.arguments.get("motivo")
        _registra("trasferito")

        info = await gestionale.info_centro()
        centro_info = info.get("centro") or {}
        # Il numero DEDICATO al passaggio, non quello pubblico: se le chiamate
        # del pubblico sono deviate qui, trasferircele sopra le rimanda a noi.
        numero = (centro_info.get("telefonoPassaggio") or centro_info.get("telefono") or "").strip()

        if not numero:
            await params.result_callback({
                "trasferimento": False,
                "istruzione": (
                    "Non c'è nessuno a cui passarla: scusati, dille che la faremo richiamare, e saluta."
                ),
            })
            return

        fatto = await _trasferisci(numero)
        await params.result_callback({
            "trasferimento": fatto,
            "numero": numero if fatto else None,
            "istruzione": (
                "Di' alla cliente in UNA frase che la passi a una collega, e fermati: "
                "la chiamata sta già passando e quello che dici dopo non lo sente nessuno."
                if fatto else
                "Il trasferimento non è riuscito: scusati, dille che la faremo richiamare, e saluta."
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
