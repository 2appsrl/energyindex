#!/usr/bin/env bash
# Wrapper cron per gli ETL EnergyIndex sul server energiapro.biz.
# Uso: run-etl.sh <portale-mlibero|brand-offers|arera-placet>
#  - carica le credenziali da .env (stessa cartella)
#  - lock per-job (niente run sovrapposti)
#  - log con timestamp in logs/<job>.log (ultimi ~30 giorni)
set -euo pipefail

JOB="${1:?uso: run-etl.sh <portale-mlibero|brand-offers|arera-placet>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

case "$JOB" in
  portale-mlibero) ENTRY="dist/etl-portale-mlibero.mjs" ;;
  brand-offers)    ENTRY="dist/etl-brand-offers.mjs" ;;
  arera-placet)    ENTRY="dist/backfill-arera-placet.mjs" ;;
  *) echo "job sconosciuto: $JOB" >&2; exit 2 ;;
esac

# Credenziali: .env accanto a questo script (vedi .env.example)
set -a
# shellcheck disable=SC1091
source "$DIR/.env"
set +a

# ARERA PLACET: il backfill di default parte da una data storica; per il
# cron giornaliero vogliamo solo oggi.
if [ "$JOB" = "arera-placet" ]; then
  export BACKFILL_START="$(date -u +%Y-%m-%d)"
  export BACKFILL_END="$(date -u +%Y-%m-%d)"
fi

mkdir -p logs
LOG="logs/${JOB}.log"
LOCK="/tmp/energyindex-etl-${JOB}.lock"

# Node >= 20 richiesto (fetch globale). NODE_BIN sovrascrivibile da .env.
NODE_BIN="${NODE_BIN:-node}"

{
  echo "===== $(date -u '+%Y-%m-%dT%H:%M:%SZ') start $JOB ====="
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK" "$NODE_BIN" "$ENTRY" || echo "EXIT CODE: $? (o lock occupato)"
  else
    "$NODE_BIN" "$ENTRY" || echo "EXIT CODE: $?"
  fi
  echo "===== $(date -u '+%Y-%m-%dT%H:%M:%SZ') end $JOB ====="
} >> "$LOG" 2>&1

# Rotazione grezza: tiene il log sotto ~2MB
if [ "$(wc -c < "$LOG")" -gt 2000000 ]; then
  tail -c 500000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
