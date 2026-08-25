/**
 * Informativa privacy, pubblica e senza login.
 *
 * Serve a tre cose insieme: è obbligatoria per pubblicare l'app sull'App Store
 * (Apple controlla che l'indirizzo apra davvero un'informativa), è obbligatoria
 * per il GDPR, e oggi il sito la promette nel footer ma il link dà 404.
 *
 * Sta nel gestionale e non nel sito perché qui i dati li conosciamo: quello che
 * c'è scritto sotto è quello che il codice fa davvero. Se un domani cambia il
 * trattamento, cambia anche questa pagina nello stesso commit.
 *
 * NON è un parere legale: va fatta leggere a chi di dovere prima di pubblicarla.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Informativa privacy — RevoBeauty',
  description: 'Come RevoBeauty tratta i dati personali delle clienti, nel centro e nell\'app.',
};

const AGGIORNATA = '25 agosto 2026';

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold text-[#1A1A1A]">{titolo}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#3F3D39]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F4] px-6 py-14">
      <article className="mx-auto max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B59B53]">RevoBeauty</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-[#1A1A1A]">
          Informativa privacy
        </h1>
        <p className="mt-3 text-sm text-[#6B6B6B]">Ultimo aggiornamento: {AGGIORNATA}</p>

        <p className="mt-8 text-[15px] leading-relaxed text-[#3F3D39]">
          Questa informativa spiega quali dati raccogliamo, perché, per quanto tempo li teniamo e
          cosa puoi chiederci. Vale sia per il centro sia per l&apos;app RevoBeauty.
        </p>

        <Sezione titolo="Chi tratta i tuoi dati">
          <p>
            Il titolare del trattamento è <strong>RevoBeauty</strong>, Via Caudina 30, 81024
            Maddaloni (CE), P. IVA 10625841217.
          </p>
          <p>
            Per qualsiasi richiesta puoi scriverci o passare in centro: trovi i contatti in fondo
            a questa pagina.
          </p>
        </Sezione>

        <Sezione titolo="Quali dati raccogliamo">
          <p>
            <strong>Dati che ci dai tu:</strong> nome e cognome, numero di telefono, email, data di
            nascita, indirizzo e città. Il numero di telefono è indispensabile: è con quello che ti
            riconosciamo e che entri nell&apos;app.
          </p>
          <p>
            <strong>Dati che nascono dal servizio:</strong> appuntamenti, trattamenti fatti,
            pacchetti acquistati, punti, credito, buoni e i messaggi che ci scambiamo su WhatsApp.
          </p>
          <p>
            <strong>Dati sulla tua salute e sulla pelle:</strong> allergie, sensibilità e note utili
            a eseguire il trattamento in sicurezza. Sono dati particolari e li trattiamo solo con il
            tuo consenso esplicito, raccolto in centro. Puoi ritirarlo quando vuoi.
          </p>
          <p>
            <strong>Cosa NON facciamo:</strong> l&apos;app non traccia la tua posizione, non legge la
            rubrica, non usa pubblicità profilata e non vende i tuoi dati a nessuno.
          </p>
        </Sezione>

        <Sezione titolo="Perché li usiamo">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Per darti il servizio:</strong> fissare, spostare e ricordarti gli
              appuntamenti, tenere il conto dei pacchetti, dei punti e del credito. La base
              giuridica è il contratto fra noi.
            </li>
            <li>
              <strong>Per gli obblighi di legge:</strong> scontrini, fatture e contabilità.
            </li>
            <li>
              <strong>Per scriverti su WhatsApp:</strong> conferme, promemoria e il codice per
              entrare nell&apos;app sono messaggi di servizio, legati al contratto. Le proposte
              commerciali partono solo se hai dato il consenso marketing, e si tolgono quando vuoi.
            </li>
            <li>
              <strong>Per la sicurezza dell&apos;accesso:</strong> il codice usa e getta che ti
              arriva su WhatsApp serve a impedire che qualcun altro entri nel tuo account.
            </li>
          </ul>
        </Sezione>

        <Sezione titolo="Come funziona l'accesso all'app">
          <p>
            Scrivi il tuo numero, ti mandiamo un codice a sei cifre su WhatsApp, lo scrivi ed entri.
            Del codice non conserviamo la cifra ma solo la sua impronta, e vale cinque minuti una
            volta sola. Sul telefono resta un contrassegno di sessione, custodito nella cassaforte
            del sistema operativo: si cancella uscendo dall&apos;app o disinstallandola.
          </p>
          <p>Nell&apos;app non si paga nulla: i pagamenti avvengono in centro.</p>
        </Sezione>

        <Sezione titolo="Chi altro li vede">
          <p>
            Solo chi ci serve per farti funzionare il servizio, e solo per quello. Nessuno di questi
            fornitori usa i tuoi dati per conto proprio:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>360dialog e Meta</strong> — i messaggi WhatsApp</li>
            <li><strong>Railway</strong> — i server dove vive il gestionale</li>
            <li><strong>Apple e Google</strong> — la distribuzione dell&apos;app</li>
            <li><strong>Telegram</strong> — gli avvisi interni al personale del centro</li>
          </ul>
          <p>
            Alcuni di questi fornitori possono trattare dati fuori dall&apos;Unione Europea: in quel
            caso il trasferimento avviene con le garanzie previste dal regolamento europeo.
          </p>
        </Sezione>

        <Sezione titolo="Per quanto tempo">
          <p>
            La tua scheda resta finché sei cliente del centro e per i dieci anni successivi
            all&apos;ultimo trattamento, che è il termine di legge per i documenti fiscali. I
            messaggi WhatsApp li teniamo ventiquattro mesi. Se ritiri il consenso al marketing
            smettiamo subito di scriverti per quel motivo, ma i dati che servono agli obblighi di
            legge restano.
          </p>
        </Sezione>

        <Sezione titolo="Cosa puoi chiederci">
          <p>
            Puoi chiedere di <strong>vedere</strong> i tuoi dati, di <strong>correggerli</strong>, di
            <strong> cancellarli</strong>, di <strong>limitarne l&apos;uso</strong>, di{' '}
            <strong>portarli altrove</strong> in un file leggibile, e di{' '}
            <strong>opporti</strong> al loro uso per scopi commerciali. Puoi anche{' '}
            <strong>ritirare un consenso</strong> che avevi dato, senza che questo tolga validità a
            quello che è successo prima.
          </p>
          <p>
            Rispondiamo entro trenta giorni. Se pensi che qualcosa non vada, puoi rivolgerti al
            Garante per la protezione dei dati personali (
            <a className="underline decoration-[#B59B53] underline-offset-2" href="https://www.gpdp.it">
              gpdp.it
            </a>
            ).
          </p>
        </Sezione>

        <Sezione titolo="Minori">
          <p>
            L&apos;app è pensata per chi ha almeno sedici anni. Sotto quell&apos;età i trattamenti e
            le prenotazioni passano da un genitore o da chi ne fa le veci.
          </p>
        </Sezione>

        <Sezione titolo="Contatti">
          <p>
            RevoBeauty — Via Caudina 30, 81024 Maddaloni (CE)
            <br />
            Puoi scriverci su WhatsApp al numero del centro o parlarne di persona in reception.
          </p>
        </Sezione>

        <p className="mt-12 border-t border-[#E8E2D6] pt-6 text-xs leading-relaxed text-[#8A857C]">
          Se cambiamo il modo in cui trattiamo i dati aggiorniamo questa pagina e ne cambiamo la
          data in cima. Le modifiche importanti te le diciamo anche su WhatsApp o dentro l&apos;app.
        </p>
      </article>
    </main>
  );
}
