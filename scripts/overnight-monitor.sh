#!/bin/bash
# overnight-monitor.sh — Health check loop every 5 minutes
# Runs all night, logs to /opt/pixstudio/logs/overnight-monitor.log
# Started: 2026-05-02 ~04:30 ICT  Stop: tmux kill-session or Ctrl-C
# Endpoints monitored:
#   - https://studio.pixelxlab.com (Vercel apps/web)
#   - https://api.studio.pixelxlab.com/health (Fly.io apps/api)
#   - https://pixstudio-api.fly.dev/health (Fly.io default)

set -uo pipefail

LOG_DIR="/opt/pixstudio/logs"
LOG_FILE="$LOG_DIR/overnight-monitor.log"
ALERT_FILE="$LOG_DIR/overnight-alerts.log"
INTERVAL_SEC=300  # 5 minutes

mkdir -p "$LOG_DIR"

declare -A FAIL_COUNT
declare -A LAST_STATUS

check_endpoint() {
  local name="$1"
  local url="$2"
  local expect="$3"

  local response
  response=$(curl -sS -o /dev/null -w "%{http_code}|%{time_total}" \
    --connect-timeout 10 --max-time 30 "$url" 2>&1)
  local code="${response%%|*}"
  local time="${response##*|}"

  if [[ "$code" == "$expect" ]]; then
    LAST_STATUS[$name]="OK"
    FAIL_COUNT[$name]=0
    echo "$(date -u +%FT%TZ) OK $name $code ${time}s"
  else
    LAST_STATUS[$name]="FAIL"
    FAIL_COUNT[$name]=$((${FAIL_COUNT[$name]:-0} + 1))
    echo "$(date -u +%FT%TZ) FAIL $name $code ${time}s (consecutive: ${FAIL_COUNT[$name]})"
    if [[ ${FAIL_COUNT[$name]} -ge 3 ]]; then
      echo "$(date -u +%FT%TZ) ALERT $name down for ${FAIL_COUNT[$name]} consecutive checks (~$((${FAIL_COUNT[$name]} * INTERVAL_SEC / 60))m)" >> "$ALERT_FILE"
    fi
  fi
}

echo "$(date -u +%FT%TZ) === Overnight monitor started PID $$ ===" | tee -a "$LOG_FILE"

while true; do
  {
    check_endpoint "studio.pixelxlab.com"     "https://studio.pixelxlab.com"            "200"
    check_endpoint "api.studio.pixelxlab.com" "https://api.studio.pixelxlab.com/health" "200"
    check_endpoint "pixstudio-api.fly.dev"    "https://pixstudio-api.fly.dev/health"    "200"
    echo "---"
  } >> "$LOG_FILE"

  sleep "$INTERVAL_SEC"
done
