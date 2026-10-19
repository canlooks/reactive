#!/usr/bin/env bash
set -u
qa=/tmp/reactive-qa-20261016-170124
evidence=/mnt/e/projects/@canlooks/reactive/test/reports/2026-10-16_170124/evidence
mkdir -p "$qa/runtime" "$qa/project"
curl --fail --location --silent --show-error https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.xz -o "$qa/node.tar.xz" || exit 10
tar -xJf "$qa/node.tar.xz" -C "$qa/runtime" --strip-components=1 || exit 11
export PATH="$qa/runtime/bin:$PATH"
cp -r "$evidence/source-snapshot/." "$qa/project/"
cd "$qa/project" || exit 12
run() {
  local name="$1"; shift
  "$@" > "$evidence/linux-$name.log" 2>&1
  local code=$?
  printf '%s exit=%s\n' "$name" "$code"
  printf '%s\n' "$code" > "$evidence/linux-$name.exit.txt"
  return "$code"
}
{ uname -a; node --version; npm --version; cat /etc/os-release; } > "$evidence/linux-environment.txt"
run ci npm ci --ignore-scripts --no-audit --no-fund || exit 13
run test npm test
run build npm run build
run dist npm run test:dist
run package npm run test:package
mkdir -p "$qa/same-tarball"
cd "$qa/same-tarball" || exit 14
printf '{"name":"linux-same-tarball","private":true,"type":"module"}\n' > package.json
run tarball-install npm install --ignore-scripts --no-audit --no-fund "$evidence/canlooks-reactive-5.0.0.tgz" || exit 15
run tarball-core node --input-type=module -e 'import assert from "node:assert/strict"; import {createRequire} from "node:module"; import * as a from "@canlooks/reactive"; const b=createRequire(import.meta.url)("@canlooks/reactive"); for(const k of Object.keys(a))assert.equal(a[k],b[k]); const s=a.reactive({n:0});const seen=[];const stop=b.effect(()=>seen.push(s.n));s.n=1;stop();assert.deepEqual(seen,[0,1]);console.log("Same Windows tarball: six APIs and mixed module core passed")'
cp package-lock.json "$evidence/linux-same-tarball-lock.json"
