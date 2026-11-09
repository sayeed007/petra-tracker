#!/usr/bin/env bash
# Rebuild the data and page, then encrypt the page with StatiCrypt into site/index.html.
# site/ is the only folder Vercel serves (vercel.json), and only the encrypted page goes in it.
#   PETRA_TRACKER_PW='a long password' bash tools/publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PETRA_TRACKER_PW:?set PETRA_TRACKER_PW (the page password)}"
python tools/build.py
rm -rf site && mkdir site
npx --yes staticrypt@3 build/index.html -p "$PETRA_TRACKER_PW" -d site \
  --short --template-title "Petra issue tracker" --template-instructions "Enter the tracker password." --remember 30
echo "site/index.html is encrypted ($(wc -c < site/index.html) bytes)"
