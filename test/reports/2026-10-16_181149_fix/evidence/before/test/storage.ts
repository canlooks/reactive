import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import * as api from '../src/index.js'
import { batch, computed, effect, reactive, storage, watch, type StorageAdapter } from '../src/index.js'
import { stopStorage } from '../src/storage.js'
import { captureReference } from '../src/reference.js'

function memory(initial: string | null = null) {
    const values = new Map<string, string>(initial === null ? [] : [['store', initial]])
    const reads: string[] = []
    const writes: [string, string][] = []
    const adapter: StorageAdapter = {
        getItem(key) { assert.equal(this, adapter); reads.push(key); return values.get(key) ?? null },
        setItem(key, value) { assert.equal(this, adapter); writes.push([key, value]); values.set(key, value) },
    }
    return { adapter, values, reads, writes }
}
function persisted<T extends object>(t: TestContext, initial: T, adapter: StorageAdapter, name = 'store'): T {
    const state = storage(initial, { name, adapter })
    t.after(() => stopStorage(state))
    return state
}
function diagnostics(t: TestContext) {
    const entries: { phase: string; error: unknown }[] = []
    t.mock.method(console, 'warn', (_: string, detail: { phase: string; error: unknown }) => { entries.push(detail) })
    return entries
}
function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
    return { promise, resolve, reject }
}
// A turn boundary drains all queued promise reactions; request completion is always explicit.
const turn = () => new Promise<void>(resolve => setImmediate(resolve))

function delayedWriter(initial = '{"count":0}') {
    let value = initial
    let active = 0
    let maximum = 0
    const writes: { snapshot: string; done: ReturnType<typeof deferred<void>> }[] = []
    const adapter: StorageAdapter = {
        getItem() { return value },
        setItem(_key, snapshot) {
            active++
            maximum = Math.max(maximum, active)
            const done = deferred<void>()
            writes.push({ snapshot, done })
            return done.promise.then(() => { active--; value = snapshot }, error => { active--; throw error })
        },
    }
    return { adapter, writes, value: () => value, maximum: () => maximum }
}

test('storage is available from the core entry', () => {
    assert.equal(typeof Reflect.get(api, 'storage'), 'function')
})

test('object properties named length retain the same accessor and hidden-field protections', t => {
    for (const descriptor of [
        { get() { return 9 }, enumerable: true },
        { value: 9, enumerable: false, writable: false },
    ]) {
        const raw = Object.defineProperty({ count: 0 }, 'length', descriptor)
        const { adapter, writes } = memory('{"count":4,"length":2}')
        const state = persisted(t, raw, adapter)
        assert.equal(state.count, 4)
        assert.equal(Reflect.get(state, 'length'), 9)
        assert.deepEqual(writes, [])
        state.count++
        assert.deepEqual(writes, [['store', '{"count":5}']])
    }
})

test('storage restores synchronously, keeps root identity and preserves local methods and getters', t => {
    let getters = 0
    const tag = Symbol('local')
    const raw = {
        count: 1, enabled: true, profile: { theme: 'light', size: 10 }, [tag]: 7,
        get double() { getters++; return this.count * 2 },
        increment() { this.count++ },
    }
    Object.defineProperty(raw, 'hidden', { value: 'local', enumerable: false })
    const disk = memory('{"count":8,"profile":{"theme":"dark"},"double":99,"increment":0,"hidden":"remote"}')
    const state = persisted(t, raw, disk.adapter)
    assert.equal(state, reactive(raw))
    assert.equal(reactive(state), state)
    assert.equal(state.count, 8)
    assert.equal(state.enabled, true)
    assert.equal(state.profile.theme, 'dark')
    assert.equal(Object.hasOwn(state.profile, 'size'), false)
    assert.equal(getters, 0)
    assert.equal(Reflect.get(state, 'hidden'), 'local')
    assert.equal(state[tag], 7)
    assert.equal(disk.writes.length, 0)
    assert.equal(state.double, 16)
    assert.equal(state.double, 16)
    assert.equal(getters, 1)
    state.increment()
    assert.equal(state.double, 18)
    assert.deepEqual(JSON.parse(disk.writes[0][1]), { count: 9, enabled: true, profile: { theme: 'dark' } })
})

test('storage creates a missing record once, preserves the name, and batches its initial write', t => {
    const disk = memory()
    let state!: { count: number }
    batch(() => {
        state = persisted(t, { count: 1 }, disk.adapter, ' app:key ')
        assert.equal(disk.writes.length, 0)
        state.count = 2
    })
    assert.deepEqual(disk.reads, [' app:key '])
    assert.deepEqual(disk.writes, [[' app:key ', '{"count":2}']])
    assert.deepEqual(Object.keys(state), ['count'])
    state.count = 3
    assert.equal(disk.values.get(' app:key '), '{"count":3}')
})

test('storage observes unseen additions, deletions, replacements and only the current graph', t => {
    const disk = memory()
    const rawChild: Record<string, unknown> = {}
    const state = persisted(t, { child: rawChild }, disk.adapter)
    state.child.new = { deep: 1 }
    ;(state.child.new as { deep: number }).deep = 2
    assert.deepEqual(JSON.parse(disk.writes.at(-1)![1]), { child: { new: { deep: 2 } } })
    delete state.child.new
    assert.equal(disk.writes.at(-1)![1], '{"child":{}}')
    state.child = {}
    const count = disk.writes.length
    reactive(rawChild).detached = true
    assert.equal(disk.writes.length, count)
    batch(() => { state.child = {}; state.child.created = 9 })
    assert.equal(disk.writes.at(-1)![1], '{"child":{"created":9}}')
})

test('storage preserves net batch semantics, settles throwing batches and skips equal JSON', t => {
    const disk = memory()
    const rawChild = { value: 1 }
    const state = persisted(t, { count: 1, child: rawChild }, disk.adapter)
    const double = computed(() => state.count * 2)
    const seen: number[] = []
    const stop = effect(() => { seen.push(double.value) })
    t.after(stop)
    batch(() => { state.count = 2; batch(() => { state.count = 3 }) })
    assert.deepEqual(seen, [2, 6])
    assert.equal(disk.writes.length, 2)
    batch(() => { state.count = 4; state.count = 3 })
    state.child = reactive(rawChild)
    state.child = { value: 1 }
    assert.equal(disk.writes.length, 2)
    const failure = new Error('business')
    assert.throws(() => batch(() => { state.count = 4; throw failure }), e => e === failure)
    assert.equal(JSON.parse(disk.writes.at(-1)![1]).count, 4)
    assert.deepEqual(seen, [2, 6, 8])
})

test('storage persists arrays, holes and implicit length changes without wrapping native methods', t => {
    const disk = memory('[9]')
    const raw = [1, 2, 3]
    const state = persisted(t, raw, disk.adapter)
    assert.equal(state, reactive(raw))
    assert.deepEqual([...state], [9])
    assert.equal(disk.writes.length, 0)
    state[3] = 4
    assert.equal(disk.writes.at(-1)![1], '[9,null,null,4]')
    delete state[0]
    assert.equal(disk.writes.at(-1)![1], '[null,null,null,4]')
    state.length = 1
    assert.equal(disk.writes.at(-1)![1], '[null]')
    const before = disk.writes.length
    batch(() => { state.push(8); state.pop() })
    assert.equal(disk.writes.length, before)
    batch(() => state.splice(0, 1, 2, 3))
    assert.equal(disk.writes.at(-1)![1], '[2,3]')
    assert.equal(disk.writes.length, before + 1)
})

test('storage writes after business effects settle and leaves enumeration and getter contracts intact', t => {
    const disk = memory()
    let getterCalls = 0
    const state = persisted(t, { count: 0, mirror: 0, get double() { getterCalls++; return this.count * 2 } }, disk.adapter)
    const stop = watch(() => state.count, value => { state.mirror = value * 10 })
    let enumerations = 0
    const stopKeys = effect(() => { Object.keys(state); enumerations++ })
    t.after(stop); t.after(stopKeys)
    state.count = 1
    assert.equal(disk.writes.length, 2)
    assert.deepEqual(JSON.parse(disk.writes[1][1]), { count: 1, mirror: 10 })
    assert.equal(getterCalls, 0)
    Reflect.set(state, 'new', 1)
    assert.equal(enumerations, 1)
})

test('storage isolates adapter reads and reference captures from all observers', t => {
    const other = reactive({ dependency: 0, selection: 1 })
    const disk = memory()
    const adapter: StorageAdapter = {
        getItem(key) { void other.dependency; return disk.adapter.getItem(key) },
        setItem(key, value) { void other.dependency; disk.adapter.setItem(key, value) },
    }
    let runs = 0
    let state!: { count: number }
    const stop = effect(() => { runs++; state = storage({ count: 0 }, { name: 'store', adapter }) })
    t.after(stop); t.after(() => stopStorage(state))
    other.dependency++
    assert.equal(runs, 1)
    assert.equal(disk.writes.length, 1)
    const selected = captureReference(() => {
        assert.equal(storage(state, { name: 'store', adapter }), state)
        return other.selection
    })
    selected.write(4)
    assert.equal(other.selection, 4)
    state.count++
    other.dependency++
    assert.equal(disk.writes.length, 2)
})

test('storage shares graph notifications without sharing controllers or retaining detached branches', t => {
    const child = { value: 0 }
    const a = memory(), b = memory()
    const first = persisted(t, { child }, a.adapter)
    const second = persisted(t, { child }, b.adapter)
    first.child.value++
    assert.equal(second.child.value, 1)
    assert.equal(a.writes.length, 2)
    assert.equal(b.writes.length, 2)
    first.child = { value: 1 }
    second.child.value++
    assert.equal(a.writes.length, 2)
    assert.equal(b.writes.length, 3)
    stopStorage(first)
    first.child.value++
    assert.equal(a.writes.length, 2)
})

test('storage returns immediately for async reads and never writes before they finish', async t => {
    for (const result of [null, '{"count":8}']) {
        const read = deferred<string | null>()
        const disk = memory()
        const adapter: StorageAdapter = { getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value) }
        const state = persisted(t, { count: 1 }, adapter)
        const seen: number[] = []
        const stop = effect(() => { seen.push(state.count) })
        t.after(stop)
        assert.equal(state.count, 1)
        assert.equal(disk.writes.length, 0)
        read.resolve(result)
        await turn()
        assert.equal(state.count, result === null ? 1 : 8)
        assert.deepEqual(seen, result === null ? [1] : [1, 8])
        assert.equal(disk.writes.length, result === null ? 1 : 0)
    }
})

test('storage gives the entire local state priority over a late read, including deletions and arrays', async t => {
    const read = deferred<string | null>()
    const disk = memory()
    const state = persisted(t, { count: 1, theme: 'light', nested: { x: 0 }, list: [1], remove: 1 as number | undefined }, {
        getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value),
    })
    batch(() => { state.count = 2; state.nested.x++; state.list.push(3); Reflect.deleteProperty(state, 'remove') })
    assert.equal(disk.writes.length, 0)
    read.resolve('{"count":8,"theme":"dark","remove":9}')
    await turn()
    assert.deepEqual(JSON.parse(disk.writes[0][1]), { count: 2, theme: 'light', nested: { x: 1 }, list: [1, 3] })
    assert.equal(Object.hasOwn(state, 'remove'), false)
})

test('async restore distinguishes net batch rollback from earlier edits and equivalent replacements', async t => {
    const cases: [boolean, (state: { value: { count: number } }) => void][] = [
        [true, state => batch(() => { state.value.count = 2; state.value.count = 1 })],
        [false, state => { state.value.count = 2; state.value.count = 1 }],
        [false, state => { state.value = { count: 1 } }],
    ]
    for (const [restores, mutate] of cases) {
        const read = deferred<string | null>()
        const disk = memory()
        const state = persisted(t, { value: { count: 1 } }, { getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value) })
        mutate(state)
        read.resolve('{"value":{"count":8}}')
        await turn()
        assert.equal(state.value.count, restores ? 8 : 1)
        assert.equal(disk.writes.length, restores ? 0 : 1)
    }
})

test('storage hydrates in one batch and persists subsequent watch edits without echoing the read', async t => {
    const read = deferred<string | null>()
    const disk = memory()
    const state = persisted(t, { a: 1, b: 1 }, { getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value) })
    const observed: [number, number][] = []
    const stop = effect(() => { observed.push([state.a, state.b]) })
    const stopWatch = watch(() => state.a, value => { if (value === 8) state.b = 10 })
    t.after(stop); t.after(stopWatch)
    read.resolve('{"a":8,"b":9}')
    await turn()
    assert.deepEqual(observed, [[1, 1], [8, 9], [8, 10]])
    assert.deepEqual(disk.writes, [['store', '{"a":8,"b":10}']])
})

test('storage serializes async writes and retains a return to the previously confirmed snapshot', async t => {
    const disk = delayedWriter()
    const state = persisted(t, { count: 0 }, disk.adapter)
    state.count = 1
    state.count = 2
    state.count = 3
    state.count = 0
    assert.deepEqual(disk.writes.map(write => write.snapshot), ['{"count":1}'])
    disk.writes[0].done.resolve()
    await turn()
    assert.deepEqual(disk.writes.map(write => write.snapshot), ['{"count":1}', '{"count":0}'])
    disk.writes[1].done.resolve()
    await turn()
    assert.equal(disk.value(), '{"count":0}')
    assert.equal(disk.maximum(), 1)
})

test('storage resumes after failed writes, coalesces newer pending values and never spins on rejection', async t => {
    const errors = diagnostics(t)
    const disk = delayedWriter()
    const state = persisted(t, { count: 0 }, disk.adapter)
    state.count = 1
    state.count = 2
    state.count = 3
    disk.writes[0].done.reject(new Error('offline'))
    await turn()
    assert.equal(disk.writes.length, 2)
    assert.equal(disk.writes[1].snapshot, '{"count":3}')
    disk.writes[1].done.reject(new Error('still offline'))
    await turn()
    assert.equal(disk.writes.length, 2)
    state.count = 4
    disk.writes[2].done.resolve()
    await turn()
    assert.equal(disk.value(), '{"count":4}')
    assert.equal(disk.maximum(), 1)
    assert.deepEqual(errors.map(error => error.phase), ['set', 'set'])
})

test('encoding failures discard stale pending writes and recovery can retry the last observed value', async t => {
    const errors = diagnostics(t)
    const disk = delayedWriter('{"count":0,"extra":0}')
    const state = persisted(t, { count: 0, extra: 0 as unknown }, disk.adapter)
    state.count = 1
    state.count = 2
    state.extra = 1n
    disk.writes[0].done.resolve()
    await turn()
    assert.equal(disk.writes.length, 1)
    state.extra = 0
    assert.equal(disk.writes.length, 2)
    assert.equal(disk.writes[1].snapshot, '{"count":2,"extra":0}')
    disk.writes[1].done.resolve()
    await turn()
    assert.equal(JSON.parse(disk.value()).count, 2)
    assert.equal(errors.length, 1)
})

test('storage handles read rejection without overwriting records until a later local change', async t => {
    const errors = diagnostics(t)
    const read = deferred<string | null>()
    const disk = memory('{"count":9}')
    const state = persisted(t, { count: 1 }, { getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value) })
    state.count = 2
    read.reject(new Error('read failed'))
    await turn()
    assert.equal(state.count, 2)
    assert.equal(disk.writes.length, 0)
    state.count = 3
    assert.equal(disk.values.get('store'), '{"count":3}')
    assert.deepEqual(errors.map(error => error.phase), ['get'])
})

test('storage rejects malformed records without a partial restore or immediate rewrite', t => {
    const errors = diagnostics(t)
    for (const value of ['', 'null', '1', '"string"', '[]', '{', '{"__proto__":{"polluted":true}}', '{"nested":{"constructor":1}}']) {
        const disk = memory(value)
        const state = persisted(t, { count: 1 }, disk.adapter)
        assert.equal(state.count, 1)
        assert.equal(disk.values.get('store'), value)
        assert.equal(disk.writes.length, 0)
        state.count++
        assert.equal(disk.values.get('store'), '{"count":2}')
        assert.equal(Reflect.get({}, 'polluted'), undefined)
    }
    assert.equal(errors.length, 8)
})

test('storage reports synchronous get/set failures and a broken diagnostic sink does not break reactivity', t => {
    const errors = diagnostics(t)
    let attempts = 0
    const adapter: StorageAdapter = {
        getItem() { throw new Error('get') },
        setItem() { if (++attempts === 1) throw new Error('set') },
    }
    const state = persisted(t, { count: 0 }, adapter)
    const seen: number[] = []
    const stop = effect(() => { seen.push(state.count) })
    t.after(stop)
    state.count = 1
    state.count = 2
    assert.deepEqual(seen, [0, 1, 2])
    assert.equal(attempts, 2)
    assert.deepEqual(errors.map(error => error.phase), ['get', 'set'])
    t.mock.method(console, 'warn', () => { throw new Error('logger') })
    const invalid = persisted(t, { value: 1n as unknown }, memory().adapter)
    invalid.value = 2n
    invalid.value = 2
})

test('storage uses data-only canonical JSON, leaves getters and toJSON idle and repairs invalid graphs', t => {
    const errors = diagnostics(t)
    let calls = 0
    const disk = memory()
    const state = persisted(t, {
        z: NaN, a: undefined, signed: -0, symbol: Symbol('value'),
        list: [undefined, () => 0, Symbol('value'), , Infinity],
        get dangerous() { calls++; throw new Error('getter') },
        toJSON() { calls++; throw new Error('toJSON') },
        payload: {} as unknown, tail: { count: 0 },
    }, disk.adapter)
    assert.equal(calls, 0)
    assert.equal(disk.writes[0][1], '{"list":[null,null,null,null,null],"payload":{},"signed":0,"tail":{"count":0},"z":null}')
    const cycle: { self?: object } = {}
    cycle.self = cycle
    const invalid = [1n, cycle, new Date(), new Map(), new Set(), Promise.resolve(), new (class {})(), computed(() => 1)]
    for (const value of invalid) {
        const before = disk.writes.length
        state.payload = value
        state.tail.count++
        assert.equal(disk.writes.length, before)
        state.payload = {}
        assert.equal(disk.writes.length, before + 1)
    }
    assert.equal(errors.length, invalid.length * 2)
    assert.equal(calls, 0)
})

test('storage supports null prototypes and shared acyclic data without persisting alias identity', t => {
    const shared = { value: 1 }
    const raw = Object.assign(Object.create(null) as { a: typeof shared; b: typeof shared }, { a: shared, b: shared })
    const disk = memory()
    const state = persisted(t, raw, disk.adapter)
    assert.equal(Object.getPrototypeOf(state), null)
    state.a.value++
    assert.equal(state.b.value, 2)
    assert.equal(disk.writes.length, 2)
    assert.equal(disk.writes[1][1], '{"a":{"value":2},"b":{"value":2}}')
})

test('restore preflight is atomic for readonly fields, non-extensible roots and locked arrays', t => {
    const errors = diagnostics(t)
    const raw = { count: 1, fixed: 1 }
    Object.defineProperty(raw, 'fixed', { writable: false })
    persisted(t, raw, memory('{"count":8,"fixed":9}').adapter)
    assert.deepEqual(raw, { count: 1, fixed: 1 })
    const sealed = Object.preventExtensions({ count: 1 })
    persisted(t, sealed, memory('{"count":8,"new":9}').adapter)
    assert.equal(sealed.count, 1)
    for (const mode of ['length', 'index']) {
        const array = [1, 2]
        Object.defineProperty(array, mode === 'length' ? 'length' : '1', mode === 'length' ? { writable: false } : { configurable: false })
        persisted(t, array, memory(mode === 'length' ? '[8,9,10]' : '[8]').adapter)
        assert.deepEqual(array, [1, 2])
    }
    assert.equal(errors.length, 4)
})

test('storage preserves business errors and releases synchronous failed initialization bindings', async t => {
    const errors = diagnostics(t)
    const failure = new Error('consumer')
    const raw = { count: 1 }
    const proxy = reactive(raw)
    const stop = effect(() => { if (proxy.count === 8) throw failure })
    const disk = memory('{"count":8}')
    assert.throws(() => storage(raw, { name: 'store', adapter: disk.adapter }), e => e === failure)
    stop()
    const state = persisted(t, raw, disk.adapter)
    assert.equal(state.count, 8)
    const read = deferred<string | null>()
    const asyncState = persisted(t, { count: 1 }, { getItem: () => read.promise, setItem() {} })
    const stopAsync = effect(() => { if (asyncState.count === 8) throw failure })
    t.after(stopAsync)
    read.resolve('{"count":8}')
    await turn()
    assert.equal(asyncState.count, 8)
    asyncState.count = 9
    assert.equal(errors.length, 1)
    assert.equal(errors[0].phase, 'hydrate')
    assert.equal(errors[0].error, failure)
})

test('storage validates options and binding identities before extra I/O', t => {
    const disk = memory()
    for (const value of [null, undefined, 1, 'x', () => 0, new Date(), new (class {})(), computed(() => 1)]) {
        assert.throws(() => storage(value as never, { name: 'store', adapter: disk.adapter }), TypeError)
    }
    for (const options of [undefined, {}, { name: '' }, { name: '  ' }, { name: 1 }, { name: 'x', type: 'other' }, { name: 'x', adapter: {} }]) {
        assert.throws(() => storage({}, options as never), TypeError)
    }
    assert.equal(disk.reads.length, 0)
    const raw = { count: 0 }
    const state = persisted(t, raw, disk.adapter)
    assert.equal(storage(raw, { name: 'store', adapter: disk.adapter, type: 'sessionStorage' }), state)
    assert.equal(storage(state, { name: 'store', adapter: disk.adapter }), state)
    assert.throws(() => storage(raw, { name: 'other', adapter: disk.adapter }), TypeError)
    assert.throws(() => storage({}, { name: 'store', adapter: disk.adapter }), TypeError)
    assert.throws(() => storage(raw, { name: 'store', adapter: memory().adapter }), TypeError)
    assert.equal(disk.reads.length, 1)
    assert.equal(disk.writes.length, 1)
    persisted(t, { count: 3 }, disk.adapter, 'other')
    assert.equal(disk.reads.length, 2)
})

test('storage stop is idempotent and ignores late reads and writes without reopening subscriptions', async t => {
    const read = deferred<string | null>()
    const disk = memory()
    const adapter: StorageAdapter = { getItem: () => read.promise, setItem: (key, value) => disk.adapter.setItem(key, value) }
    const state = persisted(t, { count: 1 }, adapter)
    stopStorage(state); stopStorage(state)
    read.resolve('{"count":8}')
    await turn()
    assert.equal(state.count, 1)
    state.count++
    assert.equal(disk.writes.length, 0)
    const write = delayedWriter()
    const other = persisted(t, { count: 0 }, write.adapter)
    other.count = 1
    other.count = 2
    stopStorage(other)
    write.writes[0].done.resolve()
    await turn()
    assert.equal(write.writes.length, 1)
    persisted(t, { count: 0 }, write.adapter)
})

test('storage accepts non-Promise thenables, settles once and handles throwing then accessors', async t => {
    const errors = diagnostics(t)
    const disk = memory()
    let thenCalls = 0
    const thenable = { then(resolve: (value: string | null) => void, reject: (error: unknown) => void) {
        thenCalls++; resolve('{"count":8}'); resolve(null); reject(new Error('ignored'))
    } }
    const state = persisted(t, { count: 1 }, {
        getItem: () => thenable as PromiseLike<string | null>,
        setItem: (key, value) => disk.adapter.setItem(key, value),
    })
    assert.equal(state.count, 1)
    await turn()
    assert.equal(state.count, 8)
    assert.equal(thenCalls, 1)
    assert.equal(disk.writes.length, 0)
    const broken = { get then(): never { throw new Error('then getter') } }
    const bad = persisted(t, { count: 0 }, { getItem: () => broken, setItem: () => broken })
    bad.count++
    assert.deepEqual(errors.map(error => error.phase), ['get', 'set'])
})

test('storage handles mixed sync/async setters independently from the getter', async t => {
    const writes: number[] = []
    const done = deferred<void>()
    const state = persisted(t, { count: 0 }, {
        getItem: () => '{"count":0}',
        setItem(_key, snapshot) {
            const value: number = JSON.parse(snapshot).count
            writes.push(value)
            if (value === 2) return done.promise
        },
    })
    state.count = 1
    assert.deepEqual(writes, [1])
    state.count = 2
    state.count = 3
    assert.deepEqual(writes, [1, 2])
    done.resolve()
    await turn()
    assert.deepEqual(writes, [1, 2, 3])
})
