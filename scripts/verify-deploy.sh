#!/bin/bash
# verify-deploy.sh — Smoke test apps/api Sprint 1+2+2.5 endpoints after Fly deploy.
# Run AFTER `flyctl deploy --config apps/api/fly.toml --remote-only` succeeds.

set -e

API="${API:-https://pixstudio-api.fly.dev}"

echo "=== 1. Health (public) ==="
curl -fsSL "$API/health" && echo
curl -fsSL "$API/health/ready" && echo

echo ""
echo "=== 2. Quick Create endpoints (require auth, expect 401) ==="
curl -sS -o /dev/null -w "POST /sessions → %{http_code}\n" -X POST "$API/api/quick-create/sessions" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"00000000-0000-0000-0000-000000000000","prompt":"test"}'
curl -sS -o /dev/null -w "GET  /workflows → %{http_code}\n" "$API/api/quick-create/workflows?tier=standard"

echo ""
echo "=== 3. Voice library (require auth, expect 401) ==="
curl -sS -o /dev/null -w "GET  /voices → %{http_code}\n" "$API/api/voices?lang=vi"

echo ""
echo "=== 4. AI provider discovery (public) ==="
curl -fsSL "$API/api/ai/providers" 2>&1 | head -c 400 ; echo

echo ""
echo "=== 5. Fly machine status ==="
flyctl status --app pixstudio-api 2>&1 | head -15

echo ""
echo "✅ Smoke test complete. Expected: 200 health, 401 auth-required, 200 ai/providers"
