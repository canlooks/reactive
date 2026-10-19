import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
const variants = {
    before: await import('../evidence/before/dist/esm/index.js'),
    after: await import('../../../../dist/esm/index.js'),
}
const rows = []
for (const [name, width, depth, writes] of [['single', 1, 1, 10000], ['shared-100', 100, 1, 100], ['shared-1000', 1000, 1, 10], ['chain-16', 1, 16, 1000]]) {
    for (const [variant, { reactive, computed, effect }] of Object.entries(variants)) {
        const samples = []
        for (let round = 0; round < 13; round++) {
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
            if (round >= 3) samples.push(elapsed)
        }
        const sorted = samples.toSorted((a, b) => a - b)
        rows.push({ name, variant, width, depth, writes, medianMs: (sorted[4] + sorted[5]) / 2, p95Ms: sorted[9], samples })
    }
}
writeFileSync(new URL('../evidence/derived-benchmark.json', import.meta.url), JSON.stringify(rows, null, 2))
console.log(JSON.stringify(rows.map(({ samples, ...row }) => row), null, 2))
