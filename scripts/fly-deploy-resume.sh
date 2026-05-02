#!/bin/bash
# fly-deploy-resume.sh — Resume Fly.io deploy for apps/api after compact session 2026-05-02
# Pre-requisite: anh share FLY_API_TOKEN (generate locally: flyctl tokens create deploy --app pixstudio-api)
# Run on VPS root@139.59.98.152

set -euo pipefail

WORK_DIR="${WORK_DIR:-/tmp/pxs-fly-deploy}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_NAME="${APP_NAME:-pixstudio-api}"

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  echo "✗ FLY_API_TOKEN env var required"
  echo "  Anh generate trên local: flyctl tokens create deploy --app pixstudio-api"
  echo "  Then: export FLY_API_TOKEN=<value> && bash $0"
  exit 1
fi

echo "═══ Step 1: Install flyctl on VPS ═══"
if ! command -v flyctl &>/dev/null; then
  FLYCTL_VERSION="${FLYCTL_VERSION:-latest}"
  curl -fL -o /tmp/flyctl.tar.gz \
    "https://github.com/superfly/flyctl/releases/${FLYCTL_VERSION}/download/flyctl_Linux_x86_64.tar.gz"
  tar xzf /tmp/flyctl.tar.gz -C /usr/local/bin flyctl
  chmod +x /usr/local/bin/flyctl
  rm /tmp/flyctl.tar.gz
fi
flyctl version

echo ""
echo "═══ Step 2: Verify Fly auth ═══"
flyctl auth whoami

echo ""
echo "═══ Step 3: Pipe Doppler secrets → Fly secrets import ═══"
source /opt/pixstudio/.doppler-env
doppler secrets download --no-file --format env-no-quotes 2>/dev/null \
  | grep -E '^(DATABASE_URL|BETTER_AUTH_SECRET|UPSTASH_REDIS|BYTEPLUS|DO_INFERENCE|DO_API|GEMINI|ELEVENLABS|FAL|R2_)' \
  | flyctl secrets import --app "$APP_NAME"

echo ""
echo "═══ Step 4: Clone repo + deploy ═══"
rm -rf "$WORK_DIR"
git clone --depth 1 -b "$REPO_BRANCH" https://github.com/minhtm92-gif/pixstudio.git "$WORK_DIR"
cd "$WORK_DIR"
flyctl deploy --config apps/api/fly.toml --app "$APP_NAME"

echo ""
echo "═══ Step 5: Add custom domain api.studio.pixelxlab.com ═══"
echo "  Anh phải add Cloudflare CNAME first:"
echo "    Type:   CNAME"
echo "    Name:   api.studio"
echo "    Target: ${APP_NAME}.fly.dev"
echo "    Proxy:  OFF (gray cloud)"
echo "  Khi DNS done, run:"
echo "    flyctl certs add api.studio.pixelxlab.com --app $APP_NAME"

echo ""
echo "✅ Deploy complete. Verify: curl https://${APP_NAME}.fly.dev/health"
