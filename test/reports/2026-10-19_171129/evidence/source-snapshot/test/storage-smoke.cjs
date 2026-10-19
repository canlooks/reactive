const assert = require('node:assert/strict')
const { runInNewContext } = require('node:vm')

function deferred() {
    let resolve
    const promise = new Promise(done => { resolve = done })
    return { promise, resolve }
}
const turn = () => new Promise(resolve => setImmediate(resolve))

// This helper also runs in a real tarball consumer with no DOM, React or localforage.
module.exports = async function verifyStorage(api, peer = api) {
    const foreignRaw = runInNewContext('({ child: { n: 0 } })')
    const foreignWrites = []
    const foreign = api.storage(foreignRaw, { name: 'foreign', adapter: {
        getItem() { return null },
        setItem(_key, value) { foreignWrites.push(value) },
    } })
    assert.equal(foreign, peer.reactive(foreignRaw))
    foreign.child.n = 1
    assert.deepEqual(foreignWrites, ['{"child":{"n":0}}', '{"child":{"n":1}}'])
    const browser = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'window')
    try {
        const initial = { count: 0 }
        const memory = api.storage(initial, { name: 'ssr' })
        assert.equal(memory, peer.reactive(initial))
        memory.count++
        assert.equal(memory.count, 1)
    } finally {
        if (browser) Object.defineProperty(globalThis, 'window', browser)
    }

    let record = '{"count":0}'
    let active = 0
    let maximum = 0
    let reads = 0
    const writes = []
    const adapter = {
        getItem() { reads++; return record },
        setItem(_key, value) {
            active++
            maximum = Math.max(maximum, active)
            const done = deferred()
            writes.push({ value, done })
            return done.promise.then(() => { record = value; active-- })
        },
    }
    const raw = { count: 0 }
    const state = api.storage(raw, { name: 'ordered', adapter })
    assert.equal(peer.storage(peer.reactive(raw), { name: 'ordered', adapter }), state)
    assert.equal(reads, 1)
    assert.throws(() => peer.storage({}, { name: 'ordered', adapter }), TypeError)
    const double = peer.computed(() => state.count * 2)
    const seen = []
    const stop = peer.effect(() => { seen.push([state.count, double.value]) })
    peer.batch(() => { state.count = 1; state.count = 2 })
    api.batch(() => { state.count = 3; state.count = 0 })
    assert.deepEqual(writes.map(item => item.value), ['{"count":2}'])
    writes[0].done.resolve()
    await turn()
    assert.deepEqual(writes.map(item => item.value), ['{"count":2}', '{"count":0}'])
    writes[1].done.resolve()
    await turn()
    assert.equal(record, '{"count":0}')
    assert.equal(maximum, 1)
    assert.deepEqual(seen, [[0, 0], [2, 4], [0, 0]])
    stop()

    for (const dirty of [false, true]) {
        const read = deferred()
        const saved = []
        const pending = api.storage({ count: 0, label: 'initial' }, { name: 'read', adapter: {
            getItem() { return { then: read.promise.then.bind(read.promise) } },
            setItem(_key, value) { saved.push(value) },
        } })
        const values = []
        const dispose = peer.effect(() => { values.push([pending.count, pending.label]) })
        assert.deepEqual(values, [[0, 'initial']])
        if (dirty) pending.count = 9
        assert.deepEqual(saved, [])
        read.resolve('{"count":4,"label":"cache"}')
        await turn()
        assert.deepEqual(values, dirty ? [[0, 'initial'], [9, 'initial']] : [[0, 'initial'], [4, 'cache']])
        assert.deepEqual(saved, dirty ? ['{"count":9,"label":"initial"}'] : [])
        peer.batch(() => { pending.count = 5; pending.label = 'next' })
        assert.equal(saved.at(-1), '{"count":5,"label":"next"}')
        dispose()
    }
}
