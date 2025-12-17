#!/usr/bin/env bash

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
cd "$PROJECT_ROOT"

echo "Running in: $(pwd)"

echo "Installing node modules..."
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed or not in PATH. Aborting."
  exit 1
fi
npm install

echo "Ensuring .env exists..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "Warning: .env.example not found; creating empty .env"
    : > .env
  fi
else
  echo ".env already exists — skipping copy."
fi

echo "Creating folders: data, transcripts"
mkdir -p data transcripts

echo "Done."
