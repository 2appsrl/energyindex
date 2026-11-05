#!/usr/bin/env bash
# Avviato ogni ora da launchd: esegue ogni job una sola volta al giorno, dopo le
# 06:30 locali (il portale pubblica nella notte). Se un job fallisce non segna il
# giorno, cosi' il tentativo dell'ora dopo lo rifa' (Mac spento, senza rete).
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
STATE="$DIR/state"
mkdir -p "$STATE"
TODAY="$(date +%Y-%m-%d)"

[[ "$(date +%H%M)" < "0630" ]] && exit 0

RC=0
for JOB in arera-placet portale-mlibero; do
  [ "$(cat "$STATE/$JOB.ok" 2>/dev/null)" = "$TODAY" ] && continue
  if "$DIR/run-etl.sh" "$JOB"; then
    echo "$TODAY" > "$STATE/$JOB.ok"
  else
    RC=1
  fi
done
exit "$RC"
