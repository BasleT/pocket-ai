#!/bin/bash

set -euo pipefail

MAX_ATTEMPTS=20
ATTEMPT=0

mkdir -p test-results

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  echo "=== Attempt $((ATTEMPT + 1)) of $MAX_ATTEMPTS ==="

  bun run build
  bun run test:e2e --reporter=json > test-results/results.json 2>&1

  FAILED=$(jq '.stats.unexpected' test-results/results.json)

  if [ "$FAILED" = "0" ]; then
    echo "✅ ALL TESTS PASSING"
    exit 0
  fi

  echo "❌ $FAILED tests failing — feeding failures back to agent"

  jq '.suites[].specs[] | select(.ok == false) | {title: .title, error: .tests[0].results[0].error.message}' test-results/results.json

  ATTEMPT=$((ATTEMPT + 1))
  sleep 2
done

echo "❌ Could not fix all tests in $MAX_ATTEMPTS attempts"
exit 1
