# Tema RevoBeauty Due

Il tema del redesign 2026. Regola unica: **nessun prezzo, orario o numero di
telefono scritto nei file** — tutto arriva dal gestionale via
`GET /api/listino/dati` e `GET /api/booking/operators` (vedi `inc/erp-data.php`).

## Installazione

1. `../bin/pacchetto.sh` → genera `revobeauty-due.zip`
2. wp-admin → Aspetto → Temi → Aggiungi → Carica tema → zip → Installa (NON attivare subito)
3. In `wp-config.php`, prima di "That's all, stop editing":
   ```php
   define( 'REVOBEAUTY_LEAD_SECRET', 'lo-stesso-valore-di-LEAD_SECRET-su-Railway' );
   ```
4. Backup (Duplicator), poi Attiva. Rollback = riattivare il tema `revobeauty`.
5. LiteSpeed Cache → Purge All. Le opzioni di "Page Optimization" (minify/combine
   CSS-JS, Critical CSS) vanno tenute SPENTE: il tema è già ottimizzato e quelle
   possono rompere l'ordine del CSS critico inline. Basta la page cache.

## Foto

- Hero della home: `assets/img/hero-1.webp` … `hero-4.webp` (verticali, ~800×1200)
- Chi siamo: `assets/img/chi-siamo.webp` (16:9, ~1600px)
- Senza i file, il tema mostra gradienti segnaposto: niente si rompe.

## Recensione in home

La citazione nella fascia bordeaux si cambia da opzioni:
`rb_recensione_testo` e `rb_recensione_autrice` (via WP-CLI o un update_option).

## Cache dei dati ERP

Transient 10 minuti + "ultima copia buona" senza scadenza. Un cron ogni 10
minuti confronta l'impronta del listino e, se è cambiata, purga le pagine
interessate su LiteSpeed. Se wp-cron non gira abbastanza (poco traffico),
aggiungere un cron reale da cPanel su `wp-cron.php`.
