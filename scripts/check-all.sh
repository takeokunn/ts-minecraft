#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

checks=(
  scripts/check-package-dag.ts
  scripts/check-layer-imports.ts
  scripts/check-class-allowlist.ts
  scripts/check-compat-removal.ts
  scripts/check-data-logic-separation.ts
  scripts/check-coverage-policy.ts
  scripts/check-test-abstractions.ts
  scripts/check-effect-compliance.ts
  scripts/check-file-size.ts
)

status=0
for check in "${checks[@]}"; do
  echo "==> ${check}"
  if ! "$NODE_BIN" "$ROOT_DIR/$check"; then
    status=1
  fi
done

exit "$status"
