#!/usr/bin/env bash
# Script para levantarlo localmente en linux
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PID=""
FRONTEND_PID=""

for command in python3 npm node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Error: no se encontró "%s". Instalalo antes de ejecutar init.sh.\n' "$command" >&2
    exit 1
  fi
done

echo 'Preparando entorno virtual de Python...'
python3 -m venv "$BACKEND_DIR/.venv"
"$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"

echo 'Instalando dependencias del frontend...'
cd "$FRONTEND_DIR"
npm i

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  [[ -z "$BACKEND_PID" ]] || wait "$BACKEND_PID" 2>/dev/null || true
  [[ -z "$FRONTEND_PID" ]] || wait "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 130' INT TERM

echo 'Iniciando backend en http://127.0.0.1:8000 ...'
cd "$BACKEND_DIR"
"$BACKEND_DIR/.venv/bin/python" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo 'Iniciando frontend en http://127.0.0.1:5173 ...'
cd "$FRONTEND_DIR"
npm run dev -- --host 127.0.0.1 &
FRONTEND_PID=$!

echo 'Aplicación iniciada. Presioná Ctrl+C para detener ambos servidores.'
wait -n "$BACKEND_PID" "$FRONTEND_PID"
