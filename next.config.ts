import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist caricano un worker interno che Next non deve impacchettare:
  // vanno lasciati come dipendenze esterne del server (altrimenti "Setting up fake worker failed").
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  /**
   * Quanto puo' pesare quello che il browser manda al server.
   *
   * Il valore di partenza e' un megabyte, e nessuno se ne accorge finche' non
   * si manda una foto: la carta d'identita' scattata col telefono, anche gia'
   * rimpicciolita a 1700 pixel, in base64 supera il megabyte. Il server la
   * rifiutava e alla cliente arrivava «An error occurred in the Server
   * Components render» — un messaggio che non vuol dire niente per nessuno,
   * dentro un modulo che a quel punto non si chiudeva piu'.
   *
   * Sei megabyte: ci stanno la foto del documento, la sua miniatura e la
   * firma, che nel salvataggio del consenso viaggiano insieme.
   */
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },

  /**
   * Il sito vetrina di Agenda Piena è una pagina sola, statica, che vive in
   * `public/`. Qui le si dà l'indirizzo pulito: /agendapiena invece di
   * /agendapiena.html, che è quello che si scrive su un biglietto da visita.
   */
  async rewrites() {
    return [
      { source: '/agendapiena', destination: '/agendapiena.html' },

      /**
       * L'anteprima del sito nuovo, prima di attivarlo su revobeauty.it.
       * Stesso trucco della vetrina qui sopra: pagine statiche in `public/`
       * con l'indirizzo pulito, così si può girare il link a chi deve dire
       * la sua senza toccare il sito pubblico.
       */
      { source: '/anteprima', destination: '/anteprima/index.html' },
      { source: '/anteprima/:pagina', destination: '/anteprima/:pagina.html' },
      // le pagine di categoria del tema: /anteprima/trattamenti/<categoria>
      { source: '/anteprima/trattamenti/:pagina', destination: '/anteprima/trattamenti/:pagina.html' },
    ];
  },

  /**
   * L'anteprima è una copia del sito vero: se finisse su Google si metterebbe
   * a farsi concorrenza da sola per le stesse parole. Qui le si dice di
   * starne fuori — e vale anche per la vetrina di Agenda Piena, che nessuno
   * cerca su questo dominio.
   */
  async headers() {
    return [{
      source: '/anteprima/:percorso*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }];
  },
};

export default nextConfig;
