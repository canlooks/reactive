import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import * as api from '@canlooks/reactive'
import * as nativeEsm from '../dist/esm/index.js'
import verifyPackage from './smoke-assertions.cjs'
import verifyStorage from './storage-smoke.cjs'
import * as reactApi from '@canlooks/reactive/react'
import * as nativeReact from '../dist/esm/react/index.js'
import verifyReact from './react-smoke.mjs'

verifyPackage(api)
verifyPackage(nativeEsm)

const require = createRequire(import.meta.url)
const cjs = require('@canlooks/reactive')
const cjsReact = require('@canlooks/reactive/react')
for (const name of Object.keys(reactApi)) assert.equal(reactApi[name], cjsReact[name])
for (const name of Object.keys(api)) assert.equal(api[name], cjs[name])
const raw = { count: 1 }
const state = api.reactive(raw)
assert.equal(cjs.reactive(raw), state)
assert.equal(cjs.reactive(state), state)
const double = cjs.computed(() => state.count * 2)
assert.equal(api.reactive(double), double)
assert.equal(api.reactive({ double }).double, double)
const seen = []
const stop = api.effect(() => { seen.push([state.count, double.value]) })
api.batch(() => { state.count = 2; state.count = 3 })
cjs.batch(() => { state.count = 4; state.count = 5 })
cjs.batch(() => { state.count = 6; state.count = 5 })
assert.deepEqual(seen, [[1, 2], [3, 6], [5, 10]])
stop()
await verifyStorage(api, cjs)
await verifyStorage(cjs, api)
await verifyStorage(nativeEsm)
await verifyReact(api, cjsReact, reactApi)
await verifyReact(cjs, reactApi, cjsReact)
await verifyReact(nativeEsm, nativeReact)
console.log('ESM, native ESM and both mixed Node entry directions share core/React state.')
