#!/usr/bin/env bash
# deploy.sh — TIS Smart Form: Intake
# Fluxo: build frontend -> commit dist -> push -> ssh VPS git pull -> health check
# Uso: ./deploy.sh ["mensagem do commit"]
#
# Pré-requisitos:
#   - node/npm instalados no Mac
#   - ssh alias 'vps-intake' configurado em ~/.ssh/config
#   - branch main sincronizada com origin
#
# Ver ADR-104 (Vite build) + Opção A do padrao GitHub -> VPS

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

MSG="${1:-rebuild frontend}"
START_TIME=$(date +%s)

# --- 1. Sanity: branch e repo limpo (fora do dist) ---
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "✗ deploy.sh requer branch 'main' (estás em '$BRANCH')"
  exit 1
fi

# Verificar se há mudanças fora de dist que devem ser incluídas
STAGED_OUTSIDE_DIST=$(git status --porcelain | grep -v "^.. frontend/dist/" | grep -v "^?? " || true)
if [ -n "$STAGED_OUTSIDE_DIST" ]; then
  echo "⚠  Ficheiros modificados fora de dist/ — inclui/commita primeiro:"
  echo "$STAGED_OUTSIDE_DIST"
  echo ""
  read -p "Continuar mesmo assim? [y/N] " -n 1 -r
  echo
  [[ ! "$REPLY" =~ ^[Yy]$ ]] && exit 1
fi

# --- 2. Build ---
echo "▶ npm run build"
cd frontend
npm run build 2>&1 | tail -6
cd "$REPO_ROOT"

# --- 3. Commit dist (se mudou) ---
if git diff --quiet frontend/dist; then
  echo "▶ dist sem mudanças — skip commit"
else
  git add frontend/dist frontend/
  git commit -m "chore(deploy): $MSG"
  echo "▶ commit criado"
fi

# --- 4. Push ---
echo "▶ git push"
git push --quiet

# --- 5. Trigger VPS pull ---
echo "▶ ssh vps-intake → git pull + restart nginx"
ssh -o BatchMode=yes vps-intake bash <<'REMOTE_EOF' 2>&1 | sed 's/^/  vps │ /'
set -e
cd /docker/smartform_intake_tis
git pull --ff-only
docker restart forms-intake > /dev/null
REMOTE_EOF

# --- 6. Health check ---
echo "▶ health check https://intake.tisapp.ai/"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://intake.tisapp.ai/)
if [ "$HTTP_CODE" = "200" ]; then
  ELAPSED=$(( $(date +%s) - START_TIME ))
  echo "✓ Live: https://intake.tisapp.ai/ (HTTP 200) em ${ELAPSED}s"
else
  echo "⚠  https://intake.tisapp.ai/ retornou HTTP $HTTP_CODE — verifica no VPS"
  exit 2
fi
