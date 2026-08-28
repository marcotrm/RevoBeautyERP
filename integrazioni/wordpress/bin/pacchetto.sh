#!/usr/bin/env bash
# Impacchetta il tema in revobeauty-due.zip, pronto per
# wp-admin → Aspetto → Temi → Aggiungi → Carica tema.
set -euo pipefail
QUI="$(cd "$(dirname "$0")/.." && pwd)"
USCITA="${1:-$QUI/revobeauty-due.zip}"
rm -f "$USCITA"
cd "$QUI"
zip -qr "$USCITA" tema-revobeauty-due \
  -x "tema-revobeauty-due/**/.DS_Store" \
  -x "tema-revobeauty-due/node_modules/*"
# dentro lo zip la cartella deve chiamarsi come il tema
python3 - "$USCITA" <<'PY'
import sys, zipfile, shutil, os, tempfile
src = sys.argv[1]
tmp = tempfile.mktemp(suffix='.zip')
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        nuovo = item.filename.replace('tema-revobeauty-due/', 'revobeauty-due/', 1)
        zout.writestr(nuovo, zin.read(item.filename))
shutil.move(tmp, src)
print('scritto', src)
PY
