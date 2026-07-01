#!/usr/bin/env bash
# Start Alis-Adventure locally with Docker Compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.docker.example .env
  echo "Created .env from .env.docker.example"
  echo "  -> Edit POSTGRES_PASSWORD and Stripe keys in backend/.env if needed."
fi

if [[ ! -f backend/.env ]]; then
  cp backend/.env.docker.example backend/.env
  echo "Created backend/.env from backend/.env.docker.example"
fi

echo "Starting Docker stack (web: http://localhost:${WEB_PORT:-8080}) ..."
docker compose up -d --build "$@"

echo ""
echo "Containers:"
docker compose ps
echo ""
echo "Open: http://localhost:${WEB_PORT:-8080}"
echo "API health (via nginx): http://localhost:${WEB_PORT:-8080}/api/health"
echo "Admin:  http://localhost:${WEB_PORT:-8080}/admin"
echo ""
echo "Logs:  docker compose logs -f"
echo "Stop:  docker compose down"
