#!/usr/bin/env bash
# Wrapper per gli ETL EnergyIndex da una macchina con IP non bloccato dal portale.
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

# ARERA PLACET: il backfill di default parte da una data storica. Rifacciamo
# gli ultimi giorni (idempotente), cosi' una macchina spenta non lascia buchi.
if [ "$JOB" = "arera-placet" ]; then
  DAYS="${ARERA_LOOKBACK_DAYS:-7}"
  # date -v e' BSD/macOS, date -d e' GNU/Linux.
  export BACKFILL_START="$(date -u -v-"${DAYS}"d +%Y-%m-%d 2>/dev/null || date -u -d "${DAYS} days ago" +%Y-%m-%d)"
  export BACKFILL_END="$(date -u +%Y-%m-%d)"
fi

mkdir -p logs
LOG="logs/${JOB}.log"
LOCK="/tmp/energyindex-etl-${JOB}.lock"

# Node >= 20 richiesto (fetch globale). NODE_BIN sovrascrivibile da .env.
NODE_BIN="${NODE_BIN:-node}"

RC=0
{
  echo "===== $(date -u '+%Y-%m-%dT%H:%M:%SZ') start $JOB ====="
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK" "$NODE_BIN" "$ENTRY" || RC=$?
  else
    "$NODE_BIN" "$ENTRY" || RC=$?
  fi
  [ "$RC" -eq 0 ] || echo "EXIT CODE: $RC"
  echo "===== $(date -u '+%Y-%m-%dT%H:%M:%SZ') end $JOB ====="
} >> "$LOG" 2>&1

# Rotazione grezza: tiene il log sotto ~2MB
if [ "$(wc -c < "$LOG")" -gt 2000000 ]; then
  tail -c 500000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

exit "$RC"
