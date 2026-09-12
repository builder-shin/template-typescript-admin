#!/usr/bin/env bash
set -euo pipefail

echo "=== [1/9] typecheck ==="; pnpm typecheck
echo "=== [2/9] lint ==="; pnpm lint
echo "=== [3/9] format ==="; pnpm format:check
echo "=== [4/9] secretlint ==="; pnpm secretlint
echo "=== [5/9] 인용 ==="; ./scripts/check-citations.sh
echo "=== [5b/9] 출처 ==="; ./scripts/check-provenance.sh
echo "=== [6/9] unit ==="; pnpm test
echo "=== [7/9] build ==="; pnpm build
