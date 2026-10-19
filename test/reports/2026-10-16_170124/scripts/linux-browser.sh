#!/usr/bin/env bash
set -u
report=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124
if [ ! -x "$report/.runtime/linux-node/bin/node" ]; then
  mkdir -p "$report/.runtime/linux-node"
  curl --fail --location --silent --show-error https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.xz -o "$report/.runtime/linux-node.tar.xz" || exit 9
  tar -xJf "$report/.runtime/linux-node.tar.xz" -C "$report/.runtime/linux-node" --strip-components=1
fi
export PATH="$report/.runtime/linux-node/bin:$PATH"
export PLAYWRIGHT_BROWSERS_PATH="$report/.runtime/linux-browsers"
report=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124
node "$report/.runtime/node_modules/playwright-core/cli.js" install firefox > "$report/evidence/linux-firefox-install-2.log" 2>&1 || exit 10
export QA_PREBUILT=1
export QA_BROWSER=firefox
export QA_BROWSER_OUTPUT=browser-results-linux-firefox.json
node "$report/scripts/browser.mjs" > "$report/evidence/linux-firefox.log" 2>&1
code=$?
printf '%s\n' "$code" > "$report/evidence/linux-firefox.exit.txt"
exit "$code"
