import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
const variants = {
    before: await import('../evidence/performance-before-dist/esm/index.js'),
    after: await import('../../../../dist/esm/index.js'),
}
assert.equal(typeof global.gc, 'function')
const rows = []
const turn = () => new Promise(resolve => setImmediate(resolve))
function measure(api, width, depth, writes) {
    const { reactive, computed, effect } = api
    const source = reactive({ n: 0 })
    let value = computed(() => source.n)
    for (let level = 1; level < depth; level++) { const parent = value; value = computed(() => parent.value + 1) }
    let notifications = 0, latest
    const start = performance.now()
    const stops = Array.from({ length: width }, () => effect(() => { notifications++; latest = value.value }))
    for (let n = 1; n <= writes; n++) source.n = n
    stops.forEach(stop => stop())
    const elapsed = performance.now() - start
    assert.equal(notifications, width * (writes + 1))
    assert.equal(latest, writes + depth - 1)
    return elapsed
}
for (const [name, width, depth, writes] of [['single', 1, 1, 10000], ['shared-100', 100, 1, 100], ['shared-1000', 1000, 1, 10], ['chain-16', 1, 16, 1000]]) {
    const samples = { before: [], after: [] }
    for (let round = 0; round < 13; round++) {
        for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
            // Unlike the uninterrupted stress probe, let discarded WeakRef targets
            // leave their keep-alive job before the next independent timing sample.
            await turn(); global.gc(); await turn()
            const elapsed = measure(variants[variant], width, depth, writes)
            if (round >= 3) samples[variant].push(elapsed)
        }
    }
    for (const variant of ['before', 'after']) {
        const sorted = samples[variant].toSorted((a, b) => a - b)
        rows.push({ name, variant, width, depth, writes, medianMs: (sorted[4] + sorted[5]) / 2, p95Ms: sorted[9], samples: samples[variant] })
    }
}
const output = process.argv[2] ?? 'derived-benchmark-isolated'
assert.match(output, /^[a-z0-9-]+$/)
writeFileSync(new URL(`../evidence/${output}.json`, import.meta.url), JSON.stringify(rows, null, 2))
console.log(JSON.stringify(rows.map(({ samples, ...row }) => row), null, 2))
