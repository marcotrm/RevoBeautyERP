import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revobeauty — Gestionale Beauty Premium",
  description: "Il gestionale cloud di nuova generazione per centri estetici, beauty clinic, laser clinic e spa. Gestisci agenda, clienti, cassa e marketing in un'unica piattaforma.",
  keywords: "gestionale centro estetico, software beauty, agenda estetista, CRM beauty, gestionale spa",
  authors: [{ name: "Revobeauty" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
