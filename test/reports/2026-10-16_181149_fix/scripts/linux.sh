#!/usr/bin/env bash
set -eu
qa="${XDG_CACHE_HOME:-$HOME/.cache}/reactive-qa-20261016-181149-fix"
evidence=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_181149_fix/evidence
export PATH="/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124/.runtime/linux-node/bin:$PATH"
mkdir -p "$qa/project"
cp -r "$evidence/source-snapshot/." "$qa/project/"
cd "$qa/project"
run() {
  local name="$1"; shift
  local code=0
  "$@" > "$evidence/linux-$name.log" 2>&1 || code=$?
  printf '%s exit=%s\n' "$name" "$code"
  printf '%s\n' "$code" > "$evidence/linux-$name.exit.txt"
  return "$code"
}
{ uname -a; node --version; npm --version; cat /etc/os-release; } > "$evidence/linux-environment.txt"
if [ "${1:-all}" = all ]; then
  run ci npm ci --ignore-scripts --no-audit --no-fund
  run test npm test
  run build npm run build
  run dist npm run test:dist
  run gc-esm node --expose-gc --test test/derived-lifecycle.mjs
  run gc-cjs node --expose-gc test/derived-lifecycle.mjs --cjs
fi
run docs node test/validate-docs.mjs
run package npm run test:package
mkdir -p "$qa/same-tarball"
cd "$qa/same-tarball"
printf '{"name":"linux-same-tarball","private":true,"type":"module"}\n' > package.json
run tarball-install npm install --ignore-scripts --no-audit --no-fund "$evidence/canlooks-reactive-5.0.0.tgz"
cp "$qa/project/test/smoke-assertions.cjs" verify.cjs
cp "$qa/project/test/storage-smoke.cjs" storage-smoke.cjs
run tarball-core node --input-type=module -e 'import assert from "node:assert/strict"; import {createRequire} from "node:module"; import * as a from "@canlooks/reactive"; import verify from "./verify.cjs"; import storage from "./storage-smoke.cjs"; const b=createRequire(import.meta.url)("@canlooks/reactive"); for(const k of Object.keys(a))assert.equal(a[k],b[k]); verify(a);verify(b);await storage(a,b);await storage(b,a);console.log("Same Windows tarball: six APIs, cross-realm and mixed module core/storage passed")'
cp package-lock.json "$evidence/linux-same-tarball-lock.json"
