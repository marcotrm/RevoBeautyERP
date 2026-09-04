# Modulo Percorsi di Estetica

Il modulo che porta la cliente dal «vorrei migliorare…» a un percorso seguito
seduta per seduta, con foto private e riattivazione rispettosa.

## Principi non negoziabili (implementati in `src/lib/estetica.ts`)

1. **Niente diagnosi.** Il check-up raccoglie risposte; se emergono condizioni
   segnalate si accende solo il flag `daValutare` e un avviso neutro. La
   valutazione la fa un'operatrice, che segna il check-up come verificato.
2. **Avanzamento = sedute fatte / pianificate.** Nessuna percentuale di
   "miglioramento" calcolata dal software, mai.
3. **Interno resta interno.** `noteInterne`, flag e foto senza consenso non
   escono dalle API mobile: il filtro sta in `sedutaPerCliente` /
   `percorsoPerCliente`, non nell'interfaccia.
4. **Le foto non passano da nessuna AI** e non si pubblicano da nessuna parte:
   vivono come data-URI in DB (pattern `ClientPhoto`), servite solo dalle API
   autenticate. Migrazione a storage S3/R2 con link temporanei: prevista, non
   ancora fatta (vale per tutte le immagini dell'app).
5. **La riattivazione propone, una persona decide.** Nessun invio automatico;
   l'unico canale collegato è il push dell'app. WhatsApp/email: messaggio
   pronto da copiare, invio manuale.

## Entità (tutte additive, `prisma db push` già applicato)

| Modello | Cosa |
|---|---|
| `CheckupEstetico` | risposte, flag daValutare, consenso, verifica operatrice, note interne |
| `ConsulenzaApp` | aree + desiderio; stati nuova → in_carico → trasformata/chiusa |
| `PercorsoEstetico` | obiettivo, sedute previste, tappe, note cliente/interne, mantenimento |
| `SedutaPercorso` | scheda del trattamento + progressi verificati (autore/data sempre presenti) |
| `FotoPercorso` | foto privata con area, data, origine (cliente o operatrice) |
| `ConsensoApp` | stato corrente per tipo (`checkup`, `foto-percorso`, `riattivazione`), revocabile |
| `RiattivazioneProposta` | coda con motivo, messaggio, chi ha deciso, quando/come inviata |
| `AccessoSensibile` | audit minimo (chi, azione, id) — niente contenuti nei log |
| `Treatment.preTrattamento` | istruzioni pre-appuntamento configurabili |

## API

Mobile (`clienteDaToken` ⇒ ognuna vede solo il proprio):
`/api/mobile/checkup`, `/api/mobile/consulenza`, `/api/mobile/percorso-estetico`
(+ `/foto` POST/DELETE con consenso obbligatorio e controllo di proprietà),
`/api/mobile/consensi`. `/api/mobile/appointments` e `/api/mobile/home` ora
includono `preparazione` (solo appuntamenti futuri) e `percorsoEstetico`.

Pannello: `/api/admin/percorsi-estetici` (crea/aggiorna/seduta/foto),
`/api/admin/checkups-estetici`, `/api/admin/consulenze-app`,
`/api/admin/riattivazione` (`?rigenera=1` rifà il giro del motore),
`/api/admin/preparazioni`.

## Promemoria

`promemoriaPreparazione()` in `src/lib/engines/notificheApp.ts`: parte quando
mancano ≤ `oreAnticipo` ore, dentro la fascia oraria consentita, UNA volta per
appuntamento (lucchetto `app_notifications`). Niente altro: zero pubblicità.

## Interfacce

- Gestionale: `dashboard/app-clienti/percorsi-estetici` (percorsi, consulenze,
  check-up, riattivazione) e `dashboard/app-clienti/preparazioni`.
- App: `(app)/checkup`, `(app)/consulenza`, `(app)/risultati` (timeline, foto
  con confronto prima/dopo a cursore — `components/ConfrontoFoto.tsx`),
  `(app)/consensi`; preparazione dentro `(app)/appuntamenti`; Home con percorso
  attivo e azione del giorno.

## Cosa richiede configurazione esterna

- Canali WhatsApp/email per la riattivazione (oggi: coda + copia manuale).
- Storage S3/R2 per le foto con URL firmati (oggi: base64 in DB dietro auth).
