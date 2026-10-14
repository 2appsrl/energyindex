#!/usr/bin/env bash
# Builda i 3 ETL del canale offerte in bundle single-file (dist/*.mjs):
# sul server non servono repo, npm install o tsx — solo Node >= 20.
# Uso: bash deploy/energiapro-cron/build.sh   (dalla root del repo)
set -euo pipefail
cd "$(dirname "$0")/../.."

BANNER="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
OUT="deploy/energiapro-cron/dist"
mkdir -p "$OUT"

for entry in etl-portale-mlibero etl-brand-offers backfill-arera-placet; do
  npx esbuild "scripts/${entry}.ts" \
    --bundle \
    --platform=node \
    --format=esm \
    --target=node20 \
    --banner:js="$BANNER" \
    --outfile="$OUT/${entry}.mjs" \
    --log-level=warning
done

echo "OK — bundle in $OUT:"
ls -lh "$OUT"
