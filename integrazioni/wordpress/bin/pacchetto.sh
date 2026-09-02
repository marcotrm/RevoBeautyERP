#!/usr/bin/env bash
# Impacchetta il tema in revobeauty-due.zip, pronto per
# wp-admin → Aspetto → Temi → Aggiungi → Carica tema.
#
# La cartella DENTRO lo zip si chiama come la cartella del tema sul
# server: e' quella che decide quale tema viene sovrascritto. Finche' lo
# zip diceva `revobeauty-due/` mentre sul sito era attivo
# `tema-revobeauty-due/`, ogni caricamento andava a finire in una copia
# dormiente: il tema si installava, la versione saliva, e sul sito non
# cambiava niente. Un aggiornamento che sembra riuscito e non lo e' e'
# peggio di uno fallito, quindi qui il nome non si tocca piu'.
set -euo pipefail
QUI="$(cd "$(dirname "$0")/.." && pwd)"
USCITA="${1:-$QUI/revobeauty-due.zip}"
rm -f "$USCITA"
cd "$QUI"
zip -qr "$USCITA" tema-revobeauty-due \
  -x "tema-revobeauty-due/**/.DS_Store" \
  -x "tema-revobeauty-due/node_modules/*"
echo "scritto $USCITA"
