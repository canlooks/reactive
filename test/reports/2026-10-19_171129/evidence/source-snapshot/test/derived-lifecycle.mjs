// Run after build: node --expose-gc test/derived-lifecycle.mjs [--cjs]
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

assert.equal(typeof global.gc, 'function', 'Run this diagnostic with --expose-gc')
const cjs = process.argv.includes('--cjs')
const require = createRequire(import.meta.url)
const load = path => {
    const url = new URL(`../dist/${cjs ? 'cjs' : 'esm'}/${path}.js`, import.meta.url)
    return cjs ? require(fileURLToPath(url)) : import(url.href)
}
const { reactive, computed, effect, watch, storage } = await load('index')
const { captureDependencies, createEffectNode, getDep, readsAreCurrent, replaceDeps, stopEffect } = await load('effect')
const { PropsCell } = await load('react/props')
const turn = () => new Promise(resolve => setImmediate(resolve))
async function collect() {
    for (let round = 0; round < 12; round++) { await turn(); global.gc() }
}
const alive = refs => refs.filter(ref => ref.deref() !== undefined).length

test('unused computed payloads and getter receivers are collectible while their source stays alive', async () => {
    const raw = { n: 0 }, source = reactive(raw)
    function make() {
        const payload = { buffer: new Array(200).fill(7) }
        const value = computed(() => source.n + payload.buffer[0])
        const receiver = reactive({ get value() { return source.n + 1 } })
        assert.equal(value.value, 7)
        assert.equal(receiver.value, 1)
        return [new WeakRef(payload), new WeakRef(receiver)]
    }
    // Repeated waves also exercise cleanup of registrations on a long-lived Dep.
    for (let wave = 0; wave < 3; wave++) {
        const refs = Array.from({ length: 1000 }, make)
        await collect()
        assert.equal(alive(refs.map(pair => pair[0])), 0, 'computed payloads retained')
        assert.equal(alive(refs.map(pair => pair[1])), 0, 'getter receivers retained')
        source.n++
        assert.equal(getDep(raw, 'n').size, 0, 'dead entries remain after dependency traversal')
        source.n = 0
    }
})

test('effects and watches depending only on computed remain active without retained disposers', async () => {
    const source = reactive({ n: 0 }), effects = [], watches = []
    function subscribe() {
        const first = computed(() => source.n + 1)
        const last = computed(() => first.value * 2)
        effect(() => { effects.push(last.value) })
        watch(() => last.value, (next, previous) => { watches.push([next, previous]) })
    }
    subscribe()
    await collect()
    source.n = 1
    await collect()
    source.n = 2
    assert.deepEqual(effects, [2, 4, 6])
    assert.deepEqual(watches, [[4, 2], [6, 4]])
})

test('retained computed and getter caches stay lazy after their last consumer stops', async () => {
    const source = reactive({ n: 1 })
    let calls = 0, notifications = 0
    const value = computed(() => { calls++; return source.n * 2 })
    const receiver = reactive({ get value() { return value.value + 1 } })
    const stop = effect(() => { void receiver.value; notifications++ })
    stop()
    await collect()
    source.n = 3
    assert.equal(calls, 1)
    assert.equal(notifications, 1)
    assert.equal(receiver.value, 7)
    assert.equal(value.value, 6)
    assert.equal(calls, 2)
})

test('read snapshots keep ephemeral upstream computations alive until commit or release', async () => {
    const source = reactive({ n: 0 })
    function capture() { return captureDependencies(() => computed(() => source.n).value) }
    const snapshot = capture()
    await collect()
    source.n = 1
    assert.equal(readsAreCurrent(snapshot.reads), false)
    let notifications = 0
    const node = createEffectNode(() => {})
    node.notify = () => { notifications++ }
    replaceDeps(node, snapshot.reads.keys())
    await collect()
    source.n = 2
    assert.equal(notifications, 1)
    stopEffect(node)
    source.n = 3
    assert.equal(notifications, 1)
})

test('consumer reruns release temporary computed payloads and stop releases the final one', async () => {
    const source = reactive({ n: 0 }), refs = [], seen = []
    const stop = effect(() => {
        const payload = { n: 10 }
        refs.push(new WeakRef(payload))
        const value = computed(() => source.n + payload.n)
        seen.push(value.value)
    })
    for (let n = 1; n <= 10; n++) source.n = n
    await collect()
    assert.equal(alive(refs), 1)
    assert.deepEqual(seen, Array.from({ length: 11 }, (_, n) => n + 10))
    stop()
    await collect()
    assert.equal(alive(refs), 0)
})

test('switching away from a derived branch releases it while the ordinary consumer remains active', async () => {
    const source = reactive({ n: 0, derived: true }), refs = [], seen = []
    const stop = effect(() => {
        if (!source.derived) { seen.push(source.n); return }
        const payload = { n: 10 }
        refs.push(new WeakRef(payload))
        seen.push(computed(() => source.n + payload.n).value)
    })
    source.derived = false
    await collect()
    assert.equal(alive(refs), 0)
    source.n = 1
    source.derived = true
    await collect()
    source.n = 2
    assert.deepEqual(seen, [10, 0, 1, 11, 12])
    stop()
})

test('an entire active source and derived consumer graph can be collected', async () => {
    function createGraph() {
        const source = reactive({ n: 0 }), payload = { n: 1 }
        const first = computed(() => source.n + payload.n)
        const last = computed(() => first.value * 2)
        effect(() => { void last.value })
        watch(() => last.value, () => {})
        return [new WeakRef(source), new WeakRef(payload)]
    }
    const refs = Array.from({ length: 100 }, createGraph).flat()
    await collect()
    assert.equal(alive(refs), 0)
})

test('props slots count retained derivations and ignore collected ones', async () => {
    const props = new PropsCell({ n: 1 }, true)
    function temporary() { const value = computed(() => props.readSlot().n); void value.value }
    temporary()
    await collect()
    assert.equal(props.hasSlotConsumers(), false)
    const live = computed(() => props.readSlot().n)
    assert.equal(live.value, 1)
    await collect()
    assert.equal(props.hasSlotConsumers(), true)
    props.publish({ n: 2 }, { owner: props, commit: 1 })
    // Initial publish establishes the baseline; the next change invalidates it.
    const { batch } = await load('index')
    batch(() => props.publish({ n: 3 }, { owner: props, commit: 2 }))
    assert.equal(live.value, 3)
})

test('shared storage children and completed I/O do not retain discarded roots', async () => {
    const child = reactive({ n: 0 })
    function synchronous(i) {
        const root = storage({ child }, { name: `sync-${i}`, adapter: { getItem() { return null }, setItem() {} } })
        return new WeakRef(root)
    }
    const syncRefs = Array.from({ length: 1000 }, (_, i) => synchronous(i))
    await collect()
    assert.equal(alive(syncRefs), 0)
    const completions = []
    function pending(i) {
        const root = storage({ n: 0 }, { name: `pending-${i}`, adapter: {
            getItem() { return Promise.resolve(null) },
            setItem() { return new Promise(resolve => completions.push(resolve)) },
        } })
        return new WeakRef(root)
    }
    const asyncRefs = Array.from({ length: 1000 }, (_, i) => pending(i))
    await turn()
    while (completions.length) completions.shift()()
    await collect()
    assert.equal(alive(asyncRefs), 0)
    child.n++
})
