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

import asyncio
import datetime
import json
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
from pipecat.frames.frames import (
    ErrorFrame,
    Frame,
    InterimTranscriptionFrame,
    TranscriptionFrame,
    TTSSpeakFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
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

# Quale motore di Fish usare.
#
# `s2.1-pro-free` e' l'unico che si paga con l'abbonamento invece che col
# credito API, ed e' quello che ci fa parlare con la voce del centro senza
# mettere soldi in un secondo contatore. Accetta le voci clonate: provato con
# la voce del centro, restituisce audio vero.
#
# Gli altri (s2-pro, s2.1-pro, s1, speech-1.6...) rispondono tutti 402 finche'
# il credito API resta a zero. Il giorno che il centro decidesse di caricarlo,
# si passa a `s2.1-pro` cambiando questa variabile e basta.
MODELLO_FISH = os.getenv("FISH_MODEL", "s2.1-pro-free")


def _oggi() -> str:
    """
    La data di oggi, in chiaro nel prompt.

    Un modello non sa che giorno è, e "giovedì prossimo" senza un oggi diventa
    una data inventata — che poi finisce in agenda.
    """
    ora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2)))
    giorni = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
    return f"Oggi è {giorni[ora.weekday()]} {ora.strftime('%d/%m/%Y')}, sono le {ora.strftime('%H:%M')}."


#: Come si chiama, a seconda di chi lo scrive.
#:
#: Pipecat ha cambiato nome ai campi fra una versione e l'altra: dove prima
#: c'era `call_sid` adesso arriva `call_id`. E i parametri che passiamo noi
#: nel TwiML non stanno in cima al dizionario ma dentro `body`. Un `dict[...]`
#: secco su un nome solo e' quello che ha fatto cadere ogni telefonata al
#: primo istante — KeyError, websocket chiuso, Twilio che riaggancia dopo uno
#: squillo. Qui si accettano tutti i nomi plausibili, e si guarda in tutti e
#: due i posti.
ALIAS = {
    "call_sid": ("call_sid", "call_id", "callSid", "CallSid"),
    "stream_id": ("stream_id", "stream_sid", "streamSid", "StreamSid"),
    "from": ("from", "From", "caller", "chiamante"),
}


def leggi(dati: dict, campo: str) -> str:
    """Il valore di `campo`, comunque lo abbia chiamato chi ce l'ha passato."""
    corpo = dati.get("body") if isinstance(dati.get("body"), dict) else {}
    for nome in ALIAS.get(campo, (campo,)):
        for sorgente in (dati, corpo):
            valore = sorgente.get(nome)
            if valore:
                return str(valore)
    return ""


class Orecchie(FrameProcessor):
    """
    Scrive nel log cosa ha capito il telefono, e cosa e' andato storto.

    Senza, quando l'assistente resta zitto non c'e' modo di sapere se non ha
    sentito, se ha sentito male, o se ha sentito benissimo e si e' rotto
    dopo. Una telefonata dura un minuto e non si ripete uguale: se non e'
    scritta nel momento, quell'informazione e' persa.
    """

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            logger.info(f"capito: {frame.text!r}")
        elif isinstance(frame, InterimTranscriptionFrame):
            logger.debug(f"sto capendo: {frame.text!r}")
        elif isinstance(frame, ErrorFrame):
            logger.error(f"errore in linea: {frame.error}")
        await self.push_frame(frame, direction)


#: L'ultimo esito del controllo su Fish: (quando, va_bene, motivo).
#:
#: Si tiene in memoria per non rifare la stretta di mano a ogni telefonata —
#: mezzo secondo prima di rispondere si sente. Ma si tiene per poco: quando il
#: centro sistema il credito, la voce giusta deve tornare da sola entro un
#: minuto, senza che nessuno rilasci niente.
_FISH_CONTROLLATA: tuple[float, bool, str] = (0.0, False, "mai provata")
_FISH_VALIDITA = 60.0


async def fish_risponde() -> tuple[bool, str]:
    """
    Fish accetta la nostra chiave, adesso?

    Si apre la stessa porta che aprirebbe Pipecat — stesso indirizzo, stessa
    autorizzazione — e la si richiude subito. Serve perche' un rifiuto di Fish
    non e' un dettaglio tecnico: la cliente sente la linea aprirsi e nessuno
    che parla. Meglio scoprirlo qui, dove si puo' ancora cambiare voce, che a
    meta' di una frase.
    """
    global _FISH_CONTROLLATA
    quando, va_bene, motivo = _FISH_CONTROLLATA
    adesso = asyncio.get_running_loop().time()
    if adesso - quando < _FISH_VALIDITA:
        return va_bene, motivo

    try:
        from websockets.asyncio.client import connect as apri
        ws = await asyncio.wait_for(
            apri(
                "wss://api.fish.audio/v1/tts/live",
                additional_headers={
                    "Authorization": f"Bearer {os.environ['FISH_API_KEY']}",
                    "model": MODELLO_FISH,
                },
            ),
            timeout=4,
        )
        await ws.close()
        esito = (True, "")
    except Exception as e:
        esito = (False, str(e))

    _FISH_CONTROLLATA = (adesso, *esito)
    return esito


async def _vuoto() -> None:
    """Niente, ma awaitable: serve a mettere in parallelo i tre caricamenti."""
    return None


async def costruisci_bot(websocket, dati_chiamata: dict):
    """Monta la catena per UNA telefonata."""
    call_sid = leggi(dati_chiamata, "call_sid")
    stream_id = leggi(dati_chiamata, "stream_id")
    chiamante = leggi(dati_chiamata, "from")

    if not call_sid or not stream_id:
        # Meglio dire cosa e' arrivato che morire su un KeyError: la prossima
        # volta che Pipecat rinomina un campo, il log lo mostra subito.
        raise RuntimeError(
            f"Twilio non ha passato call_sid/stream_id riconoscibili. Ricevuto: {sorted(dati_chiamata)}"
            + (f", body: {sorted(dati_chiamata['body'])}" if isinstance(dati_chiamata.get("body"), dict) else "")
        )

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

    # Le impostazioni vanno passate come oggetto, non come dizionario.
    #
    # Con `live_options={...}` la telefonata si apriva e cadeva subito: dentro
    # Deepgram qualcuno chiedeva `live_options.sample_rate`, e un dizionario
    # quell'attributo non ce l'ha. Da fuori si sentiva il cronometro partire e
    # nessuno parlare.
    #
    # `live_options` esiste ancora ma e' deprecato: si usa `settings`, che e'
    # la via buona di questa versione di Pipecat.
    stt = DeepgramSTTService(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        settings=DeepgramSTTService.Settings(
            model="nova-2", language="it", smart_format=True,
            # La rete di sicurezza sul fine-frase.
            #
            # Di suo Deepgram chiude la frase quando sente silenzio. Ma al
            # telefono il silenzio spesso non arriva mai — traffico, il
            # phon in sottofondo, la cliente che chiama dalla strada — e la
            # loro documentazione lo dice: «significant background noise may
            # prevent the speech_final=true flag from being sent». Quando non
            # arriva, la frase non viene mai chiusa: la cliente parla,
            # l'assistente non riceve niente e resta zitto. E' esattamente
            # quello che si vedeva nei log, dove dopo «User stopped speaking»
            # non compariva nessuna trascrizione.
            #
            # `utterance_end_ms` non ascolta il silenzio: guarda i buchi fra
            # una parola e l'altra, quindi il rumore non lo inganna. Se il
            # segnale normale non arriva, dopo un secondo chiude lo stesso.
            # Vuole `interim_results` acceso, che scriviamo qui invece di
            # fidarci del valore di partenza.
            interim_results=True,
            utterance_end_ms=1000,
        ),
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
    # Fish quando c'e', Deepgram quando Fish non c'e'.
    #
    # La voce del centro e' quella di Fish, ed e' quella che si usa. Ma Fish
    # rifiuta la connessione quando il credito API e' finito (HTTP 402), e in
    # quel caso il telefono squilla, si apre la linea e non parla NESSUNO —
    # che per chi chiama e' peggio del centro chiuso. Quindi si chiede prima,
    # e se Fish dice di no si parla lo stesso con Deepgram invece di restare
    # muti. Il controllo vale un minuto: appena il credito torna, torna anche
    # la voce giusta, da sola.
    scelta = os.getenv("VOCE_TTS", "fish").lower()
    if scelta != "deepgram":
        ok, perche = await fish_risponde()
        if not ok:
            logger.error(f"Fish non risponde ({perche}): parlo con Deepgram per non restare muta")
            scelta = "deepgram"

    if scelta == "deepgram":
        tts = DeepgramTTSService(
            api_key=os.environ["DEEPGRAM_API_KEY"],
            # I nomi delle voci sono "aura-2-<nome>-<lingua>": per l'italiano
            # si guarda l'elenco vero con GET https://api.deepgram.com/v1/models
            # invece di indovinarlo.
            settings=DeepgramTTSService.Settings(
                voice=os.getenv("DEEPGRAM_VOICE_ID", "aura-2-maia-it"),
            ),
            sample_rate=FREQUENZA,
        )
    else:
        tts = FishAudioTTSService(
            api_key=os.environ["FISH_API_KEY"],
            # La voce di Fish si sceglie con `voice`, dentro le impostazioni.
            # `model` e `reference_id` funzionano ancora ma sono tutti e due
            # deprecati, ed e' da questa famiglia di cambiamenti che e' arrivata
            # la caduta del telefono: meglio non lasciarne in giro nessuno.
            settings=FishAudioTTSService.Settings(
                model=MODELLO_FISH, voice=os.environ["FISH_VOICE_ID"],
            ),
            sample_rate=FREQUENZA,
        )

    llm = AnthropicLLMService(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        settings=AnthropicLLMService.Settings(
            model=os.getenv("VOCE_MODEL", "claude-opus-5"),
        ),
    )

    # Le istruzioni le scrive il gestionale, non stanno qui: cambiare come
    # parla l'assistente non deve richiedere di rilasciare questo servizio.
    #
    # E insieme alle istruzioni si prende gia' quello che serve SEMPRE: i dati
    # del centro e la scheda di chi sta chiamando.
    #
    # Il motivo e' quello che si vedeva nei log della prima telefonata vera.
    # Alla domanda «volevo prenotare un appuntamento» l'assistente non ha
    # risposto niente: ha chiamato "info_centro", ha aspettato, ha chiamato
    # "chi_chiama", ha aspettato — e chi era al telefono, sentendo solo
    # silenzio, ha riattaccato prima che aprisse bocca. Non era ignoranza,
    # era attesa: due andate e ritorno prima della prima parola.
    #
    # Quelle due risposte pero' non dipendono da cosa dice la cliente: si
    # sanno gia' quando il telefono squilla. Quindi si chiedono qui, tutte e
    # tre insieme invece che in fila, mentre l'assistente sta ancora dicendo
    # il saluto — e quando la cliente parla, la risposta parte subito.
    istruzioni, centro, scheda = await asyncio.gather(
        gestionale.istruzioni(),
        gestionale.info_centro(),
        gestionale.chi_chiama(chiamante) if chiamante else _vuoto(),
        return_exceptions=True,
    )

    if isinstance(istruzioni, BaseException):
        logger.error(f"istruzioni non caricate: {istruzioni}")
        istruzioni = "Sei l'assistente di RevoBeauty. Se non riesci ad aiutare, passa la chiamata al centro."

    gia_saputo = ""
    for nome, dato in (("info_centro", centro), ("chi_chiama", scheda)):
        if isinstance(dato, BaseException):
            logger.error(f"{nome} non caricato: {dato}")
        elif dato:
            gia_saputo += f"\n\n### {nome}\n{json.dumps(dato, ensure_ascii=False)}"

    if gia_saputo:
        gia_saputo = (
            "\n\n## Quello che sai gia', senza chiedere niente a nessuno\n\n"
            "Queste sono le risposte di \"info_centro\" e \"chi_chiama\" per QUESTA "
            "telefonata, prese un istante fa. Valgono come se le avessi appena "
            "chieste tu: NON richiamare quei due strumenti all'inizio, useresti "
            "secondi di silenzio per sapere una cosa che sai gia'. Gli altri "
            "strumenti — orari, listino, prenotazione — si usano normalmente."
            + gia_saputo
        )

    sistema = (
        f"{istruzioni}\n\n{_oggi()}\n\n"
        f"La cliente sta chiamando dal numero {chiamante}. "
        f"Usa questo numero quando uno strumento te lo chiede: non chiederglielo."
        f"{gia_saputo}"
    )

    # Le istruzioni devono arrivare COME istruzioni.
    #
    # Scritte come primo messaggio con ruolo "system", non arrivavano affatto.
    # Pipecat converte il contesto per Anthropic, e li' dentro c'e' questa
    # regola: se il messaggio di sistema e' l'unico della lista — e all'inizio
    # di una telefonata lo e' sempre — invece di estrarlo gli cambia il ruolo
    # in "user". Nei log di produzione infatti si leggeva
    #
    #     Generating chat from context [NOT_GIVEN] | [{'role': 'user',
    #       'content': "Sei l'assistente di RevoBeauty..."}]
    #
    # cioe': system vuoto, e tutte le regole — niente di medico, non inventare
    # i prezzi, ripeti e fatti confermare — consegnate al modello come se le
    # avesse dette una cliente al telefono. Cambiato il ruolo una volta, resta
    # cambiato per tutta la chiamata.
    #
    # Quindi il contesto si crea vuoto, si prende quello vero dall'aggregatore
    # (e' lui a tenere il convertito: user e assistant condividono lo stesso
    # oggetto) e le istruzioni si mettono dove vanno.
    aggregator = llm.create_context_aggregator(
        OpenAILLMContext(tools=strumenti.TUTTI)
    )
    context = aggregator.user().context
    context.system = sistema

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

        # A centro chiuso non si passa a nessuno.
        #
        # Alle nove di sera, o di domenica, il numero squilla a vuoto: la
        # cliente si sente dire «ti passo una collega» e poi ascolta il vuoto,
        # che e' il modo peggiore di chiudere una telefonata. Meglio dirle
        # chiaramente che adesso non c'e' nessuno e che la richiamiamo:
        # e' vero, ed e' una promessa che il centro puo' mantenere.
        aperto_adesso = bool((info.get("oggi") or {}).get("adessoAperto"))
        if numero and not aperto_adesso:
            logger.info(f"chiamata {call_sid}: non passata, il centro adesso e' chiuso")
            await params.result_callback({
                "trasferimento": False,
                "istruzione": (
                    "Adesso il centro e' chiuso e non c'e' nessuno a cui passarla. Diglielo in una "
                    "frase, dille che la faranno richiamare appena riaprono, e saluta. "
                    "Non prometterle che le risponde una collega adesso."
                ),
            })
            return

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
        Orecchie(),
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
        # Il saluto si fa dire, non si fa generare.
        #
        # Prima si infilava come messaggio dell'assistente e poi si chiedeva al
        # modello di proseguire da li'. Ma una conversazione non puo' finire con
        # l'assistente: Anthropic rispondeva
        #     400 — This model does not support assistant message prefill.
        # Il modello non partiva, e chi chiamava trovava la linea aperta e
        # nessuno che parlasse.
        #
        # La frase e' fissa e la conosciamo: si manda dritta alla voce, senza
        # scomodare il modello. Il primo vero turno parte quando parla la
        # cliente.
        #
        # Nel contesto NON va aggiunta a mano: ci pensa gia' l'aggregatore in
        # fondo alla catena, che raccoglie tutto quello che l'assistente dice.
        # Scrivendola anche qui il saluto finiva due volte di fila nel contesto
        # e nella trascrizione, e il modello si ritrovava a leggere di essersi
        # presentato due volte.
        await task.queue_frames([TTSSpeakFrame(SALUTO)])

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
