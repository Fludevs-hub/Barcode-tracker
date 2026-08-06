#!/usr/bin/env bash
# One-shot supply-chain + DAST scan. Run in a Docker-enabled Linux/WSL env.
# Couldn't run in the review session (no Docker/VM); this is the runnable version.
set -uo pipefail
cd "$(dirname "$0")"

echo "== npm audit — backend, production deps only =="
# --omit=dev is the modern form of the deprecated --production flag.
npm audit --omit=dev || true

echo
echo "== npm audit — frontend =="
if [ -f frontend/package.json ]; then
  npm --prefix frontend audit || true
else
  echo "no frontend/package.json, skipping"
fi

echo
echo "== Strix — AI DAST agent (needs Docker + an LLM API key) =="
if command -v strix >/dev/null 2>&1; then
  # Boots the app in a container and attacks the live surface. Check `strix --help`
  # for the flags your version expects; -t/--target points at this repo.
  strix -t .
else
  echo "Strix not installed. Install once:"
  echo "    pipx install strix-agent      # or: uvx strix-agent"
  echo "  Set your LLM key (e.g. STRIX_LLM + provider API key), then:"
  echo "    STRIX_LLM=openai/gpt-4o OPENAI_API_KEY=... strix -t ."
fi

echo
echo "== Snyk — optional, deeper CVE + license data (needs 'snyk auth') =="
if command -v snyk >/dev/null 2>&1; then
  snyk test --all-projects --severity-threshold=medium || true
else
  echo "Snyk not installed (optional):  npm i -g snyk && snyk auth"
fi
