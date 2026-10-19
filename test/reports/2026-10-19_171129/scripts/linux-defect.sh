#!/usr/bin/env bash
set -eu
report=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-19_171129
runtime=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124/.runtime
export PATH="$runtime/linux-node/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$runtime/linux-browsers"
export QA_PREBUILT=1 QA_BROWSER=firefox
node "$report/scripts/run-command.mjs" browser-defect-firefox node "$report/scripts/browser-defect.mjs"
