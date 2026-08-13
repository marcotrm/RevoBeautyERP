import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist caricano un worker interno che Next non deve impacchettare:
  // vanno lasciati come dipendenze esterne del server (altrimenti "Setting up fake worker failed").
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  /**
   * Il sito vetrina di Agenda Piena è una pagina sola, statica, che vive in
   * `public/`. Qui le si dà l'indirizzo pulito: /agendapiena invece di
   * /agendapiena.html, che è quello che si scrive su un biglietto da visita.
   */
  async rewrites() {
    return [{ source: '/agendapiena', destination: '/agendapiena.html' }];
  },
};

export default nextConfig;
