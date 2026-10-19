#!/usr/bin/env bash
set -eu
report=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_181149_fix
runtime=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124/.runtime
export PATH="$runtime/linux-node/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$runtime/linux-browsers"
# Bundles were freshly built from this run's newly installed fixed tarball on Windows.
export QA_PREBUILT=1
export QA_BROWSER=firefox
export QA_BROWSER_OUTPUT=browser-results-linux-firefox.json
code=0
node "$report/scripts/browser.mjs" > "$report/evidence/linux-firefox.log" 2>&1 || code=$?
printf '%s\n' "$code" > "$report/evidence/linux-firefox.exit.txt"
cat "$report/evidence/linux-firefox.log"
exit "$code"
