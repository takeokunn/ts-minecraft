#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )/.." && pwd)"
PNPM_BIN="${ROOT_DIR}/.devenv/profile/bin/pnpm"
DEVSHELL_BIN="${ROOT_DIR}/.devenv/profile/bin"

if [[ ! -x "${PNPM_BIN}" ]]; then
  echo "pnpm binary not found at ${PNPM_BIN}" >&2
  exit 127
fi

export PATH="${DEVSHELL_BIN}:${PATH}"

exec "${PNPM_BIN}" "$@"
