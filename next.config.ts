import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse/pdfjs-dist caricano un worker interno che Next non deve impacchettare:
  // vanno lasciati come dipendenze esterne del server (altrimenti "Setting up fake worker failed").
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
