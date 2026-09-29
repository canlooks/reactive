import type { Computed } from '../src/index.js'
import './reference.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { batch, computed, effect, reactive, watch, type WatchOptions } from '../src/index.js'

test('effects run immediately and track only the properties they read', () => {
    const state = reactive({ count: 1, message: 'hello' })
    const counts: number[] = []
    const messages: string[] = []
    effect(() => { counts.push(state.count, state.count) })
    effect(() => { messages.push(state.message) })
    state.count++
    state.message = 'hi'
    assert.deepEqual(counts, [1, 1, 2, 2])
    assert.deepEqual(messages, ['hello', 'hi'])
})

test('effects replace conditional dependencies and restore nested collection', () => {
    const state = reactive({ enabled: true, a: 1, b: 10, inner: 0, tail: 0 })
    const selected: number[] = []
    let innerRuns = 0
    let stopInner = () => {}
    effect(() => {
        stopInner()
        selected.push(state.enabled ? state.a : state.b)
        stopInner = effect(() => { state.inner; innerRuns++ })
        state.tail
    })
    state.enabled = false
    state.a++
    state.b++
    state.inner++
    assert.deepEqual(selected, [1, 10, 11])
    assert.equal(innerRuns, 4)
    state.tail++
    assert.deepEqual(selected, [1, 10, 11, 11])
})

test('stopping is idempotent and can remove queued or currently running effects', () => {
    const state = reactive({ value: 0, tail: 0 })
    let stopLater = () => {}
    effect(() => { if (state.value) stopLater() })
    let laterRuns = 0
    stopLater = effect(() => { state.value; laterRuns++ })
    let ownRuns = 0
    const stopSelf = effect(() => {
        ownRuns++
        if (state.value) stopSelf()
        state.tail
    })
    state.value++
    state.tail++
    stopLater()
    stopSelf()
    assert.equal(laterRuns, 1)
    assert.equal(ownRuns, 2)
})

test('Object.is and raw/proxy normalization determine changes', () => {
    const raw = { x: 1 }
    const state = reactive({ value: NaN, nested: raw })
    let runs = 0
    effect(() => { state.value; state.nested; runs++ })
    state.value = NaN
    state.nested = reactive(raw)
    assert.equal(runs, 1)
    state.value = 0
    state.value = -0
    assert.equal(runs, 3)
})

test('missing properties, additions, deletions and failed writes retain JS semantics', () => {
    const raw: { value?: number; fixed?: number } = {}
    Object.defineProperty(raw, 'fixed', { value: 2, writable: false, configurable: false })
    const state = reactive(raw)
    const values: (number | undefined)[] = []
    effect(() => { values.push(state.value) })
    state.value = undefined
    delete state.value
    delete state.value
    assert.deepEqual(values, [undefined, undefined, undefined])
    assert.equal(Reflect.set(state, 'fixed', 3), false)
    assert.equal(Reflect.deleteProperty(state, 'fixed'), false)
    assert.equal(state.fixed, 2)
})

test('deep proxies are stable, support cycles and discard replaced dependencies', () => {
    const raw: { child: { value: number }; self?: object } = { child: { value: 1 } }
    raw.self = raw
    const state = reactive(raw)
    assert.equal(reactive(raw), state)
    assert.equal(reactive(state), state)
    assert.equal(state.self, state)
    assert.equal(state.child, state.child)
    const old = state.child
    const seen: number[] = []
    effect(() => { seen.push(state.child.value) })
    state.child = { value: 2 }
    old.value++
    state.child.value++
    assert.deepEqual(seen, [1, 2, 3])
})

test('nested batches use one baseline, deduplicate effects and return their result', () => {
    const state = reactive({ a: 1, b: 10 })
    const seen: number[][] = []
    effect(() => { seen.push([state.a, state.b]) })
    const result = batch(() => {
        state.a = 2
        assert.equal(batch(() => { state.a = 3; return 'inner' }), 'inner')
        state.a = 1
        assert.equal(seen.length, 1)
        return 42
    })
    assert.equal(result, 42)
    assert.equal(seen.length, 1)
    batch(() => { state.a = 2; state.a = 3; state.b = 11 })
    assert.deepEqual(seen, [[1, 10], [3, 11]])
    state.a++
    state.a++
    assert.equal(seen.length, 4)
})

test('net property state includes existence and treats restored values as unchanged', () => {
    const state = reactive<{ value?: number }>({ value: 1 })
    let runs = 0
    effect(() => { state.value; runs++ })
    batch(() => { delete state.value; state.value = 1 })
    assert.equal(runs, 1)
    delete state.value
    batch(() => { state.value = 2; delete state.value })
    assert.equal(runs, 2)
    state.value = undefined
    assert.equal(runs, 3)
})

test('batch keeps active tracking and initial effects run immediately inside it', () => {
    const state = reactive({ a: 0, b: 0 })
    let runs = 0
    const stop = effect(() => batch(() => { state.a; runs++ }))
    batch(() => {
        state.a++
        effect(() => { state.b; runs++ })
        assert.equal(runs, 2)
        stop()
        state.b++
    })
    assert.equal(runs, 3)
})

test('empty batches and invalid arguments', () => {
    assert.equal(batch(() => {}), undefined)
    assert.throws(() => batch(null as never), TypeError)
    for (const value of [null, undefined, 1, 'x', true, Symbol('x')]) {
        assert.throws(() => reactive(value as never), TypeError)
    }
    assert.throws(() => effect(null as never), TypeError)
})

test('failed initial effects leave no subscriptions and restore tracking', () => {
    const state = reactive({ value: 0 })
    const error = new Error('initial')
    let failedRuns = 0
    assert.throws(() => effect(() => { state.value; failedRuns++; throw error }), e => e === error)
    let runs = 0
    effect(() => { state.value; runs++ })
    state.value++
    assert.equal(failedRuns, 1)
    assert.equal(runs, 2)
})

test('batch and notification errors preserve every cause and the queue recovers', () => {
    const state = reactive({ value: 0 })
    const errors = [new Error('callback'), new Error('first'), new Error('second')]
    const seen: number[] = []
    effect(() => { if (state.value === 1) throw errors[1] })
    effect(() => { if (state.value === 1) throw errors[2] })
    effect(() => { seen.push(state.value) })
    assert.throws(() => batch(() => { state.value = 1; throw errors[0] }), error => {
        assert.ok(error instanceof AggregateError)
        assert.deepEqual(error.errors, errors)
        return true
    })
    assert.deepEqual(seen, [0, 1])
    state.value = 2
    assert.deepEqual(seen, [0, 1, 2])
    assert.throws(() => batch(() => { throw undefined }), error => error === undefined)
})

test('effects can start new batches while flushing and can run again later in the queue', () => {
    const state = reactive({ source: 0, derived: 0 })
    const seen: number[][] = []
    effect(() => { seen.push([state.source, state.derived]) })
    effect(() => { if (state.source) state.derived = state.source * 2 })
    state.source = 1
    assert.deepEqual(seen, [[0, 0], [1, 0], [1, 2]])
    let runs = 0
    effect(() => { runs++; state.derived++ })
    assert.equal(runs, 1)
})

test('setters batch backing fields, preserve errors and never evaluate getters for comparison', () => {
    let getterCalls = 0
    const error = new Error('setter')
    const state = reactive({
        a: 0,
        b: 0,
        get value() { getterCalls++; return this.a + this.b },
        set value(value: number) { this.a = value; this.b = value; if (value === 2) throw error },
    })
    const seen: number[][] = []
    effect(() => { seen.push([state.a, state.b]) })
    state.value = 1
    assert.equal(getterCalls, 0)
    assert.deepEqual(seen, [[0, 0], [1, 1]])
    assert.throws(() => { state.value = 2 }, e => e === error)
    assert.deepEqual(seen, [[0, 0], [1, 1], [2, 2]])
})

test('computed is lazy, cached and only reevaluates when read', () => {
    const state = reactive({ count: 1 })
    let calls = 0
    const double = computed(() => { calls++; return state.count * 2 })
    assert.equal(calls, 0)
    assert.equal(double.value, 2)
    assert.equal(double.value, 2)
    assert.equal(calls, 1)
    state.count = 2
    state.count = 3
    assert.equal(calls, 1)
    assert.equal(double.value, 6)
    assert.equal(calls, 2)
    assert.throws(() => computed(null as never), TypeError)
})

test('computed tracks its own branches without leaking source dependencies to consumers', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    const seen: number[] = []
    effect(() => { seen.push(selected.value) })
    state.enabled = false
    state.a++
    state.b++
    assert.deepEqual(seen, [1, 10, 11])
})

test('source, chain and diamond consumers observe one fresh result per batch', () => {
    const state = reactive({ count: 1 })
    const a = computed(() => state.count + 1)
    const b = computed(() => state.count * 2)
    const total = computed(() => a.value + b.value)
    const chain = computed(() => total.value * 10)
    const seen: number[][] = []
    effect(() => { seen.push([state.count, a.value, b.value, total.value, chain.value]) })
    state.count = 2
    batch(() => { state.count = 3; state.count = 4 })
    assert.deepEqual(seen, [[1, 2, 2, 4, 40], [2, 3, 4, 7, 70], [4, 5, 8, 13, 130]])
})

test('intermediate computed reads are current and a reverted batch does not notify', () => {
    const state = reactive({ count: 1 })
    const double = computed(() => state.count * 2)
    const chain = computed(() => double.value + 1)
    const seen: number[][] = []
    effect(() => { seen.push([state.count, double.value, chain.value]) })
    batch(() => {
        state.count = 2
        assert.equal(chain.value, 5)
        state.count = 1
    })
    assert.deepEqual(seen, [[1, 2, 3]])
    assert.equal(double.value, 2)
    assert.equal(chain.value, 3)
})

test('settlement preserves an already computed final cache with the same dependencies', () => {
    const state = reactive({ count: 1, reorder: false })
    let calls = 0
    const value = computed(() => {
        calls++
        // Reading the same dependency set in a different order must not discard the cache.
        if (calls % 2) { state.count; state.reorder } else { state.reorder; state.count }
        return state.count * 2
    })
    const seen: number[] = []
    effect(() => { seen.push(value.value) })
    batch(() => {
        state.count = 2
        assert.equal(value.value, 4)
        assert.equal(calls, 2)
    })
    assert.deepEqual(seen, [2, 4])
    assert.equal(calls, 2)
})

test('restoring computed branches does not miss a net change on the original branch', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    let calls = 0
    const selected = computed(() => { calls++; return state.enabled ? state.a : state.b })
    const seen: number[] = []
    effect(() => { seen.push(selected.value) })
    batch(() => {
        state.enabled = false
        assert.equal(selected.value, 10)
        state.a = 2
        state.enabled = true
        assert.equal(calls, 2)
    })
    assert.deepEqual(seen, [1, 2])
    assert.equal(calls, 3)
    state.b++
    assert.deepEqual(seen, [1, 2])
})

test('changes on temporary computed branches do not notify and original dependencies recover', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    const seen: number[] = []
    effect(() => { seen.push(selected.value) })
    batch(() => {
        state.enabled = false
        assert.equal(selected.value, 10)
        state.b = 20
        assert.equal(selected.value, 20)
        state.enabled = true
    })
    assert.deepEqual(seen, [1])
    state.b++
    assert.deepEqual(seen, [1])
    state.a = 2
    assert.deepEqual(seen, [1, 2])
    assert.equal(selected.value, 2)
})

test('a pure branch round trip restores original dependencies even without a post-batch read', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    const seen: number[] = []
    effect(() => { seen.push(selected.value) })
    batch(() => {
        state.enabled = false
        selected.value
        state.enabled = true
    })
    assert.deepEqual(seen, [1])
    state.a = 3
    assert.deepEqual(seen, [1, 3])
})

test('computed-to-computed branch restoration restores both sides of every subscription', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const a = computed(() => state.a)
    const b = computed(() => state.b)
    const selected = computed(() => state.enabled ? a.value : b.value)
    const diamond = computed(() => selected.value + a.value)
    const top = computed(() => diamond.value * 2)
    const seen: number[] = []
    effect(() => { seen.push(top.value) })
    batch(() => {
        state.enabled = false
        assert.equal(top.value, 22)
        state.b = 20
        state.enabled = true
    })
    assert.deepEqual(seen, [4])
    state.b = 30
    assert.deepEqual(seen, [4])
    state.a = 2
    assert.deepEqual(seen, [4, 8])
})

test('new computed nodes use their first evaluation as the batch dependency baseline', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    const seen: number[] = []
    batch(() => {
        effect(() => { seen.push(selected.value) })
        state.enabled = false
        selected.value
        state.a = 2
        state.enabled = true
    })
    assert.deepEqual(seen, [1, 2])
})

test('computed restoration does not revive stopped consumers', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    let runs = 0
    const stop = effect(() => { selected.value; runs++ })
    batch(() => {
        state.enabled = false
        selected.value
        stop()
        state.a++
        state.enabled = true
    })
    state.a++
    assert.equal(runs, 1)
})

test('source net changes notify even when a computed result is equal', () => {
    const state = reactive({ count: 1 })
    const parity = computed(() => state.count % 2)
    const seen: number[] = []
    effect(() => { seen.push(parity.value) })
    state.count = 3
    assert.deepEqual(seen, [1, 1])
})

test('computed errors are retried, contexts recover and circular reads fail clearly', () => {
    const state = reactive({ value: 0 })
    const failure = new Error('computed')
    let fail = true
    const value = computed(() => { state.value; if (fail) throw failure; return state.value })
    assert.throws(() => value.value, error => error === failure)
    fail = false
    assert.equal(value.value, 0)
    const seen: number[] = []
    effect(() => { seen.push(value.value) })
    state.value++
    assert.deepEqual(seen, [0, 1])
    let recurse = true
    const circular: Computed<number> = computed(() => recurse ? circular.value : 7)
    assert.throws(() => circular.value, /Circular computed/)
    recurse = false
    assert.equal(circular.value, 7)
    const first: Computed<number> = computed(() => second.value)
    const second: Computed<number> = computed(() => first.value)
    assert.throws(() => first.value, /Circular computed/)
})

test('computed dependencies restore on a throwing batch and future updates still work', () => {
    const state = reactive({ enabled: true, a: 1, b: 10 })
    const selected = computed(() => state.enabled ? state.a : state.b)
    const seen: number[] = []
    effect(() => { seen.push(selected.value) })
    const error = new Error('batch')
    assert.throws(() => batch(() => {
        state.enabled = false
        selected.value
        state.b++
        state.enabled = true
        throw error
    }), e => e === error)
    assert.deepEqual(seen, [1])
    state.a++
    assert.deepEqual(seen, [1, 2])
})

test('object getters are lazy computed values and setters invalidate their backing fields', () => {
    let calls = 0
    const state = reactive({
        count: 1,
        get double() { calls++; return this.count * 2 },
        set double(value: number) { this.count = value / 2 },
    })
    assert.equal(calls, 0)
    assert.equal(state.double, 2)
    assert.equal(state.double, 2)
    assert.equal(calls, 1)
    state.double = 4
    assert.equal(calls, 1)
    assert.equal(state.double, 4)
    const seen: number[] = []
    effect(() => { seen.push(state.double) })
    batch(() => { state.count = 3; assert.equal(state.double, 6); state.count = 2 })
    assert.deepEqual(seen, [4])
    assert.equal(state.double, 4)
    const before = calls
    batch(() => { state.count = 4; assert.equal(state.double, 8) })
    assert.deepEqual(seen, [4, 8])
    assert.equal(calls, before + 1)
})

test('prototype getters are cached by receiver and work across a proxied prototype', () => {
    let calls = 0
    const prototype = reactive({ count: 0, get double() { calls++; return this.count * 2 } })
    const first = reactive(Object.assign(Object.create(prototype) as typeof prototype, { count: 1 }))
    const second = reactive(Object.assign(Object.create(prototype) as typeof prototype, { count: 10 }))
    assert.equal(first.double, 2)
    assert.equal(second.double, 20)
    assert.equal(first.double, 2)
    assert.equal(calls, 2)
    first.count++
    assert.equal(first.double, 4)
    assert.equal(second.double, 20)
    assert.equal(calls, 3)
})

test('deleting and replacing an own getter notifies its property consumers', () => {
    const raw: { count: number; readonly double?: number } = { count: 1, get double() { return this.count * 2 } }
    const descriptor = Object.getOwnPropertyDescriptor(raw, 'double')!
    const state = reactive(raw)
    const seen: (number | undefined)[] = []
    effect(() => { seen.push(state.double) })
    batch(() => {
        Reflect.deleteProperty(state, 'double')
        Object.defineProperty(state, 'double', descriptor)
    })
    assert.deepEqual(seen, [2])
    batch(() => { Reflect.deleteProperty(state, 'double'); Reflect.set(state, 'double', 2) })
    assert.deepEqual(seen, [2, 2])
    state.count++
    assert.deepEqual(seen, [2, 2])
    Reflect.deleteProperty(state, 'double')
    assert.deepEqual(seen, [2, 2, undefined])
    // Descriptor writes do not notify, but a later read recognizes a different getter.
    Object.defineProperty(state, 'double', { configurable: true, get() { return 99 } })
    assert.equal(state.double, 99)
})

test('fixed references and getter-less accessors respect proxy invariants', () => {
    const nested = { count: 1 }
    const fn = () => 1
    const raw = Object.create(null) as { nested: typeof nested; method: typeof fn; absent: undefined }
    Object.defineProperties(raw, {
        nested: { value: nested },
        method: { value: fn },
        absent: { get: undefined, configurable: false },
    })
    const state = reactive(raw)
    assert.equal(state.nested, nested)
    assert.equal(state.method, fn)
    assert.equal(state.absent, undefined)
    assert.equal(Reflect.set(state, 'nested', {}), false)
    const readonly = reactive({ get value() { return 1 } })
    assert.equal(Reflect.set(readonly, 'value', 2), false)
})

test('writes through a proxy in the prototype chain do not notify the parent object', () => {
    const parent = reactive({ value: 1 })
    const child = reactive(Object.create(parent) as typeof parent)
    const parents: number[] = []
    const children: number[] = []
    effect(() => { parents.push(parent.value) })
    effect(() => { children.push(child.value) })
    child.value = 2
    assert.deepEqual(parents, [1])
    assert.deepEqual(children, [1, 2])
    parent.value = 3
    assert.deepEqual(parents, [1, 3])
    assert.deepEqual(children, [1, 2])
})

test('built-ins are returned unchanged while replacing their containing property notifies', () => {
    class CustomDate extends Date {}
    const values = [
        new Map(), new Set(), new Date(), Promise.resolve(1), /x/, new Uint8Array(2), new CustomDate(),
        new URL('https://example.com'), new URLSearchParams(), new Headers(), new AbortController(), new DOMException(),
    ]
    for (const value of values) {
        assert.equal(reactive(value), value)
        assert.equal(reactive({ value }).value, value)
    }
    const state = reactive({ value: new Map<string, number>() })
    let runs = 0
    effect(() => { state.value; runs++ })
    state.value.set('x', 1)
    assert.equal(runs, 1)
    state.value = new Map()
    assert.equal(runs, 2)
    assert.equal(reactive(Map), Map)
    assert.equal(reactive(URL), URL)
})

test('proxy eligibility does not evaluate custom tags or reject own class tag fields', () => {
    let calls = 0
    const raw = { value: 1, get [Symbol.toStringTag]() { calls++; return 'Custom' } }
    const state = reactive(raw)
    assert.notEqual(state, raw)
    assert.equal(calls, 0)
    class Tagged { [Symbol.toStringTag] = 'URL'; value = 1 }
    const tagged = new Tagged()
    const proxy = reactive(tagged)
    assert.notEqual(proxy, tagged)
    const seen: number[] = []
    effect(() => { seen.push(proxy.value) })
    proxy.value++
    assert.deepEqual(seen, [1, 2])
})

test('symbol properties and null-prototype objects are reactive', () => {
    const key = Symbol('value')
    const state = reactive(Object.assign(Object.create(null) as Record<symbol, number>, { [key]: 1 }))
    const seen: (number | undefined)[] = []
    effect(() => { seen.push(state[key]) })
    state[key]++
    Reflect.deleteProperty(state, key)
    assert.deepEqual(seen, [1, 2, undefined])
})

test('array indices, implicit length growth and truncation notify the affected readers', () => {
    const list = reactive([10, 20, 30])
    const lengths: number[] = []
    const tail: (number | undefined)[] = []
    const together: (number | undefined)[][] = []
    effect(() => { lengths.push(list.length) })
    effect(() => { tail.push(list[2]) })
    effect(() => { together.push([list.length, list[2]]) })
    list.push(40)
    assert.deepEqual(lengths, [3, 4])
    assert.deepEqual(tail, [30])
    list.length = 1
    assert.deepEqual(lengths, [3, 4, 1])
    assert.deepEqual(tail, [30, undefined])
    assert.deepEqual(together, [[3, 30], [4, 30], [1, undefined]])
    list[2] = 50
    delete list[2]
    assert.deepEqual(lengths, [3, 4, 1, 3])
    assert.deepEqual(tail, [30, undefined, 50, undefined])
})

test('array batch round trips compare indices and length independently', () => {
    const list = reactive([1, 2, 3])
    const lengths: number[] = []
    const values: (number | undefined)[] = []
    effect(() => { lengths.push(list.length) })
    effect(() => { values.push(list[2]) })
    batch(() => { list.push(4); list.pop() })
    batch(() => { delete list[2]; list[2] = 3 })
    batch(() => { list.length = 1; list[1] = 2; list[2] = 3 })
    assert.deepEqual(lengths, [3])
    assert.deepEqual(values, [3])
    batch(() => { list.length = 1; list.length = 3 })
    assert.deepEqual(lengths, [3])
    assert.deepEqual(values, [3, undefined])
    assert.equal(2 in list, false)
})

test('array length computed values stay fresh inside a batch', () => {
    const list = reactive([1])
    const size = computed(() => list.length * 2)
    const last = computed(() => list[1])
    const seen: (number | undefined)[][] = []
    effect(() => { seen.push([size.value, last.value]) })
    batch(() => {
        list.push(2)
        assert.equal(size.value, 4)
        assert.equal(last.value, 2)
        list.pop()
    })
    assert.deepEqual(seen, [[2, undefined]])
    assert.equal(size.value, 2)
    assert.equal(last.value, undefined)
})

test('sparse truncation visits real indices and ignores noncanonical array index properties', () => {
    const list = reactive([] as number[])
    list[1_000_000] = 7
    const seen: (number | undefined)[] = []
    let lengthRuns = 0
    effect(() => { seen.push(list[1_000_000]) })
    effect(() => { list.length; lengthRuns++ })
    for (const key of ['01', '-1', '-0', '1.0', '4294967295']) Reflect.set(list, key, 99)
    assert.equal(lengthRuns, 1)
    Reflect.set(list, 'length', '0')
    assert.deepEqual(seen, [7, undefined])
    assert.equal(lengthRuns, 2)
    assert.equal(Reflect.get(list, '01'), 99)
})

test('batched splice merges its writes without replacing native array methods', () => {
    const list = reactive([1, 2, 3])
    const seen: number[][] = []
    effect(() => { seen.push([...list]) })
    assert.equal(list.splice, Array.prototype.splice)
    batch(() => { list.splice(0, 2, 4, 5, 6) })
    assert.deepEqual(seen, [[1, 2, 3], [4, 5, 6, 3]])
})

test('@reactive preserves construction and batches instance and static methods', () => {
    let instanceGetterCalls = 0
    let staticGetterCalls = 0
    @reactive
    class Store {
        static count = 1
        static get double() { staticGetterCalls++; return this.count * 2 }
        static increase(by: number) { this.count += by; this.count += by; return this.count }
        constructor(public count: number, public message: string) {}
        get double() { instanceGetterCalls++; return this.count * 2 }
        increase(by: number) { this.count += by; this.count += by; return this.count }
        roundTrip() { this.count++; this.count-- }
        setMessage(message: string) { this.message = message; return this }
    }
    const first = new Store(1, 'hello')
    const second = new Store(10, 'world')
    assert.ok(first instanceof Store)
    assert.equal(first.message, 'hello')
    assert.equal(first.double, 2)
    assert.equal(second.double, 20)
    assert.equal(first.double, 2)
    assert.equal(instanceGetterCalls, 2)
    assert.equal(Store.double, 2)
    assert.equal(Store.double, 2)
    assert.equal(staticGetterCalls, 1)
    const instances: number[][] = []
    const statics: number[][] = []
    effect(() => { instances.push([first.count, first.double]) })
    effect(() => { statics.push([Store.count, Store.double]) })
    assert.equal(first.increase(2), 5)
    assert.equal(Store.increase(2), 5)
    first.roundTrip()
    assert.deepEqual(instances, [[1, 2], [5, 10]])
    assert.deepEqual(statics, [[1, 2], [5, 10]])
    assert.equal(second.double, 20)
    assert.equal(first.setMessage('new'), first)
})

test('@reactive() preserves constructor types, getter caches and automatic method batches', () => {
    class Base {
        constructor(public count: number) {}
        increase(by: number): number { this.count += by; this.count += by; return this.count }
    }
    let getterCalls = 0
    @reactive()
    class Store extends Base {
        static count = 1
        static get double() { return this.count * 2 }
        static increase(by: number): number { this.count += by; this.count += by; return this.count }
        constructor(count: number, public label: string) { super(count) }
        get double() { getterCalls++; return this.count * 2 }
        roundTrip() { this.count++; this.count-- }
    }
    const store: Store = new Store(1, 'factory')
    assert.ok(store instanceof Store)
    assert.ok(store instanceof Base)
    assert.equal(store.label, 'factory')
    assert.equal(store.double, 2)
    assert.equal(store.double, 2)
    assert.equal(getterCalls, 1)
    assert.equal(store.increase, store.increase)
    assert.equal(Store.increase, Store.increase)
    const instances: number[][] = []
    const statics: number[][] = []
    effect(() => { instances.push([store.count, store.double]) })
    effect(() => { statics.push([Store.count, Store.double]) })
    const instanceResult: number = store.increase(2)
    const staticResult: number = Store.increase(2)
    store.roundTrip()
    assert.equal(instanceResult, 5)
    assert.equal(staticResult, 5)
    assert.deepEqual(instances, [[1, 2], [5, 10]])
    assert.deepEqual(statics, [[1, 2], [5, 10]])
    assert.equal(getterCalls, 2)
})

test('reactive(Class) and reactive()(Class) share proxy identity and preserve signatures', () => {
    class RawStore {
        static label = 'store'
        static describe(prefix: string): string { return prefix + this.label }
        constructor(public value: number) {}
        update(next: number): number { this.value = next; this.value++; return this.value }
    }
    const Store: typeof RawStore = reactive(RawStore)
    const FromFactory: typeof RawStore = reactive()(RawStore)
    assert.equal(FromFactory, Store)
    assert.equal(reactive()(FromFactory), Store)
    const factoryStore: RawStore = new FromFactory(10)
    const factoryResult: number = factoryStore.update(20)
    const factoryLabel: string = FromFactory.describe('factory ')
    assert.equal(factoryResult, 21)
    assert.equal(factoryLabel, 'factory store')
    const store: RawStore = new Store(1)
    const result: number = batch(() => store.update(2))
    const label: string = Store.describe('my ')
    assert.equal(result, 3)
    assert.equal(label, 'my store')
    assert.equal(Store.prototype, RawStore.prototype)
    assert.equal(reactive(RawStore), Store)
    assert.equal(reactive(Store), Store)
    assert.equal(reactive(store), store)
    assert.ok(store instanceof Store)
    assert.ok(store instanceof RawStore)
})

test('inherited methods, super calls and explicit batches share the outermost boundary', () => {
    let constructedBy: unknown
    @reactive
    class Base {
        static count = 1
        static increase() { this.count++; this.count++; return this.count }
        constructor(public count: number) {}
        get double() { return this.count * 2 }
        increase() { this.count++; this.count++; return this.count }
    }
    @reactive
    class Derived extends Base {
        constructor(count: number, public name: string) { super(count); constructedBy = new.target }
        override increase() { super.increase(); this.again(); return this.count }
        again() { batch(() => { this.count++; this.count++ }) }
        nested() { this.increase(); this.again() }
    }
    const store = new Derived(1, 'derived')
    assert.ok(store instanceof Derived)
    assert.ok(store instanceof Base)
    assert.equal(constructedBy, Derived)
    assert.equal(store.double, 2)
    const seen: number[] = []
    effect(() => { seen.push(store.count) })
    assert.equal(store.increase(), 5)
    store.nested()
    batch(() => { store.increase(); store.again() })
    assert.deepEqual(seen, [1, 5, 11, 17])
    const base: number[] = []
    const derived: number[] = []
    effect(() => { base.push(Base.count) })
    effect(() => { derived.push(Derived.count) })
    Derived.increase()
    assert.deepEqual(base, [1])
    assert.deepEqual(derived, [1, 3])
})

test('inherited instance methods and static getters keep separate receiver caches', () => {
    let calls = 0
    class Base {
        static count = 1
        static get double() { calls++; return this.count * 2 }
        count = 1
        increase() { this.count++; this.count++ }
    }
    @reactive
    class First extends Base {}
    @reactive
    class Second extends Base { static override count = 10 }
    const first = new First()
    const seen: number[] = []
    effect(() => { seen.push(first.count) })
    first.increase()
    assert.deepEqual(seen, [1, 3])
    assert.equal(First.double, 2)
    assert.equal(Second.double, 20)
    assert.equal(First.double, 2)
    assert.equal(calls, 2)
    First.count = 2
    assert.equal(First.double, 4)
    assert.equal(Second.double, 20)
    assert.equal(calls, 3)
})

test('method wrappers have stable identity, refresh after replacement and preserve dynamic this', () => {
    class RawStore {
        count = 0
        add(by: number) { this.count += by; this.count += by; return this.count }
        static count = 0
        static add(by: number) { this.count += by; this.count += by; return this.count }
    }
    const Store = reactive(RawStore)
    const first = new Store()
    const second = new Store()
    const method = first.add
    assert.equal(method, first.add)
    assert.equal(Store.add, Store.add)
    const seen: number[] = []
    effect(() => { seen.push(second.count) })
    assert.equal(method.call(second, 2), 4)
    assert.equal(method.apply(second, [1]), 6)
    assert.equal(first.count, 0)
    assert.deepEqual(seen, [0, 4, 6])
    assert.throws(() => method(1), TypeError)
    assert.equal(Store.add.call(reactive({ count: 1 }), 2), 5)
    RawStore.prototype.add = function (by: number) { this.count += by * 3; return this.count }
    assert.notEqual(first.add, method)
    assert.equal(first.add, first.add)
    assert.equal(first.add(2), 6)
})

test('plain object methods and directly proxied instances do not acquire automatic batches', () => {
    const raw = { count: 0, increase() { this.count++; this.count++ } }
    const state = reactive(raw)
    const seen: number[] = []
    effect(() => { seen.push(state.count) })
    assert.equal(state.increase, raw.increase)
    state.increase()
    batch(() => state.increase())
    assert.deepEqual(seen, [0, 1, 2, 4])
    class RawStore { count = 0; increase() { this.count++; this.count++ } }
    const store = reactive(new RawStore())
    assert.equal(store.increase, RawStore.prototype.increase)
    const values: number[] = []
    effect(() => { values.push(store.count) })
    store.increase()
    assert.deepEqual(values, [0, 1, 2])
})

test('class function fields and functions returned by getters are not method wrappers', () => {
    const returned = function (this: { count: number }) { this.count++; this.count++ }
    @reactive
    class Store {
        static count = 0
        static field = function (this: typeof Store) { this.count++; this.count++ }
        count = 0
        field = returned
        arrow = () => { this.count++ }
        get callback() { return returned }
    }
    const store = new Store()
    assert.equal(store.field, returned)
    assert.equal(store.callback, returned)
    assert.equal(store.toString, Object.prototype.toString)
    const seen: number[] = []
    effect(() => { seen.push(store.count) })
    store.field()
    store.callback()
    store.arrow()
    assert.deepEqual(seen, [0, 1, 2, 3, 4])
    assert.equal(store.count, 5)
    batch(() => store.field())
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 7])
    const statics: number[] = []
    effect(() => { statics.push(Store.count) })
    Store.field()
    assert.deepEqual(statics, [0, 1, 2])
})

test('fixed static methods respect invariants and TypeScript private fields remain trackable', () => {
    const fixed = function () { return 1 }
    class RawStore {
        private value = 0
        get count() { return this.value }
        increase() { this.value++; this.value++ }
    }
    Object.defineProperty(RawStore, 'fixed', { value: fixed })
    const Store = reactive(RawStore)
    assert.equal(Reflect.get(Store, 'fixed'), fixed)
    const store = new Store()
    const seen: number[] = []
    effect(() => { seen.push(store.count) })
    store.increase()
    assert.deepEqual(seen, [0, 2])
})

test('throwing class methods settle successful writes, aggregate failures and remain reusable', () => {
    const callbackError = new Error('method')
    const effectError = new Error('effect')
    @reactive
    class Store {
        count = 0
        update(value: number) { this.count = value; this.count++; if (value === 1) throw callbackError }
    }
    const store = new Store()
    const seen: number[] = []
    effect(() => { if (store.count === 2) throw effectError })
    effect(() => { seen.push(store.count) })
    assert.throws(() => store.update(1), error => {
        assert.ok(error instanceof AggregateError)
        assert.deepEqual(error.errors, [callbackError, effectError])
        return true
    })
    store.update(3)
    assert.deepEqual(seen, [0, 2, 4])
})

test('reads inside automatic methods stay tracked and method array writes share the batch', () => {
    @reactive
    class Store {
        count = 0
        list = [1, 2, 3]
        read() { return this.count }
        edit() { this.list.splice(0, 2, 4, 5, 6); this.list.push(7) }
    }
    const store = new Store()
    const values: number[] = []
    effect(() => { values.push(store.read()) })
    store.count++
    assert.deepEqual(values, [0, 1])
    const arrays: number[][] = []
    effect(() => { arrays.push([...store.list]) })
    store.edit()
    assert.deepEqual(arrays, [[1, 2, 3], [4, 5, 6, 3, 7]])
})

test('batch returns the original Promise and only batches its synchronous portion', async () => {
    const state = reactive({ count: 0 })
    const seen: number[] = []
    effect(() => { seen.push(state.count) })
    let original!: Promise<number>
    const result = batch(() => original = (async () => {
        state.count++
        state.count++
        await Promise.resolve()
        state.count++
        state.count++
        batch(() => { state.count++; state.count++ })
        return state.count
    })())
    assert.equal(result, original)
    assert.deepEqual(seen, [0, 2])
    assert.equal(await result, 6)
    assert.deepEqual(seen, [0, 2, 3, 4, 6])
})

test('async class methods, generator iteration, microtasks and timers do not extend a batch', async () => {
    @reactive
    class Store {
        count = 0
        async update() {
            this.count++; this.count++
            await Promise.resolve()
            this.count++; this.count++
        }
        *steps() { this.count++; this.count++; yield this.count }
        promise(value: Promise<number>) { this.count++; this.count++; return value }
    }
    const store = new Store()
    const seen: number[] = []
    effect(() => { seen.push(store.count) })
    const completion = store.update()
    assert.deepEqual(seen, [0, 2])
    await completion
    assert.deepEqual(seen, [0, 2, 3, 4])
    const original = Promise.resolve(42)
    assert.equal(store.promise(original), original)
    const iterator = store.steps()
    assert.equal(store.count, 6)
    assert.deepEqual(iterator.next(), { value: 8, done: false })
    assert.deepEqual(seen, [0, 2, 3, 4, 6, 7, 8])
    await batch(() => new Promise<void>(resolve => {
        queueMicrotask(() => { store.count++; store.count++ })
        setTimeout(() => { store.count++; store.count++; resolve() }, 0)
    }))
    assert.deepEqual(seen, [0, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12])
})

test('effect dependencies stop at asynchronous boundaries', async () => {
    const state = reactive({ sync: 0, async: 0, timer: 0 })
    let runs = 0
    let completion!: Promise<void>
    let timer!: Promise<void>
    effect(() => {
        state.sync
        runs++
        completion = (async () => { await Promise.resolve(); state.async })()
        timer = new Promise(resolve => setTimeout(() => { state.timer; resolve() }, 0))
    })
    await Promise.all([completion, timer])
    state.async++
    state.timer++
    assert.equal(runs, 1)
    state.sync++
    assert.equal(runs, 2)
    await Promise.all([completion, timer])
})

test('batch net comparisons cover normalized references, signed zero and independent nested fields', () => {
    const raw = { value: 1 }
    const state = reactive({ value: NaN, zero: 0, child: raw, other: 0 })
    const seen: number[][] = []
    effect(() => { state.value; seen.push([state.zero, state.child.value, state.other]) })
    batch(() => {
        state.value = 2; state.value = NaN
        state.zero = -0; state.zero = 0
        state.child = { value: 10 }; state.child = reactive(raw)
        state.child.value = 2; state.child.value = 1
    })
    assert.deepEqual(seen, [[0, 1, 0]])
    batch(() => {
        state.zero = -0
        state.child.value = 2; state.child.value = 1
        state.other = 1
    })
    assert.deepEqual(seen, [[0, 1, 0], [-0, 1, 1]])
})

test('caught inner batch errors keep the outer baseline and single update errors retain identity', () => {
    const state = reactive({ value: 1 })
    const error = new Error('inner')
    const seen: number[] = []
    effect(() => { seen.push(state.value) })
    batch(() => {
        state.value = 2
        assert.throws(() => batch(() => { state.value = 3; throw error }), e => e === error)
        assert.deepEqual(seen, [1])
        state.value = 1
    })
    assert.deepEqual(seen, [1])
    effect(() => { if (state.value === 4) throw error })
    assert.throws(() => { state.value = 4 }, e => e === error)
    state.value = 5
    assert.deepEqual(seen, [1, 4, 5])
})

test('failed additions and invalid array lengths produce no changes or leaked batch context', () => {
    const state = reactive(Object.preventExtensions({ value: 1 }) as { value: number; missing?: number })
    let runs = 0
    effect(() => { state.missing; runs++ })
    assert.equal(Reflect.set(state, 'missing', 1), false)
    assert.equal(runs, 1)
    const list = reactive([1, 2])
    const seen: number[] = []
    effect(() => { seen.push(list.length) })
    assert.throws(() => { list.length = -1 }, RangeError)
    assert.deepEqual(seen, [2])
    list.push(3)
    assert.deepEqual(seen, [2, 3])
})

test('a failed computed update can retry and does not block other consumers', () => {
    const state = reactive({ value: 0 })
    const error = new Error('computed update')
    const derived = computed(() => { if (state.value === 1) throw error; return state.value * 2 })
    const seen: number[] = []
    const independent: number[] = []
    effect(() => { seen.push(derived.value) })
    effect(() => { independent.push(state.value) })
    assert.throws(() => { state.value = 1 }, e => e === error)
    assert.throws(() => derived.value, e => e === error)
    state.value = 2
    assert.deepEqual(seen, [0, 4])
    assert.deepEqual(independent, [0, 1, 2])
})

test('automatic getter branches recover and static method round trips do not notify', () => {
    @reactive
    class Store {
        static count = 1
        static roundTrip() { this.count++; this.count-- }
        static outer() { this.roundTrip(); this.count++; this.count++ }
        enabled = true
        a = 1
        b = 10
        get selected() { return this.enabled ? this.a : this.b }
        update() { this.enabled = false; assert.equal(this.selected, 10); this.a = 2; this.enabled = true }
    }
    const state = new Store()
    const seen: number[] = []
    effect(() => { seen.push(state.selected) })
    state.update()
    assert.deepEqual(seen, [1, 2])
    const statics: number[] = []
    effect(() => { statics.push(Store.count) })
    Store.roundTrip()
    assert.deepEqual(statics, [1])
    Store.outer()
    assert.deepEqual(statics, [1, 3])
})

test('public API preserves generic results and ignores effect callback return values', () => {
    const state = reactive({ count: 1 })
    const read: Computed<number> = computed(() => state.count * 2)
    const result: { value: number } = batch(() => ({ value: read.value }))
    const promise = Promise.resolve(result)
    const returned: Promise<{ value: number }> = batch(() => promise)
    let cleanupCalls = 0
    const stop: () => void = effect(() => {
        state.count
        return () => { cleanupCalls++ }
    })
    state.count++
    stop()
    assert.equal(cleanupCalls, 0)
    assert.deepEqual(result, { value: 2 })
    assert.equal(returned, promise)
})

test('watch defaults, immediate, undefined values and options are initialized once', () => {
    for (const options of [undefined, {}, { immediate: false }, { immediate: undefined }, { immediate: true }]) {
        const state = reactive({ count: 1 })
        let reads = 0
        const seen: unknown[] = []
        const stop = watch(() => { reads++; return state.count }, (next, prev) => seen.push([next, prev]), options)
        assert.equal(reads, 1)
        assert.deepEqual(seen, options?.immediate ? [[1, undefined]] : [])
        state.count = 2
        assert.deepEqual(seen.at(-1), [2, 1])
        stop(); stop()
        state.count = 3
        assert.equal(reads, 2)
    }
    const state = reactive({ count: 0 })
    const seen: unknown[] = []
    const options: WatchOptions = { immediate: true }
    const stop = watch(() => { void state.count }, (next, prev) => seen.push([next, prev]), options)
    options.immediate = false
    state.count++
    assert.deepEqual(seen, [[undefined, undefined], [undefined, undefined]])
    stop()
})

test('watch callback and option reads are isolated from both source and enclosing effect', () => {
    const state = reactive({ count: 1, side: 0, immediate: true })
    let outer = 0
    let callbacks = 0
    let stop = () => {}
    const stopOuter = effect(() => {
        outer++
        stop = watch(() => state.count, () => { callbacks++; void state.side }, state)
    })
    state.side++
    state.immediate = false
    assert.equal(outer, 1)
    assert.equal(callbacks, 1)
    state.count++
    assert.equal(callbacks, 2)
    assert.equal(outer, 1)
    stop(); stopOuter()
})

test('watch follows dependency changes without result equality filtering or deep snapshots', () => {
    const state = reactive({ branch: true, a: 1, b: 10, user: { name: 'A' } })
    const value = computed(() => state.branch ? state.a % 2 : state.b)
    const seen: unknown[] = []
    const stop = watch(() => value.value, (next, prev) => seen.push([next, prev]))
    state.a = 3
    batch(() => { state.a = 4; state.a = 3 })
    state.branch = false
    state.a++
    batch(() => { state.b = 11; state.b = 12 })
    assert.deepEqual(seen, [[1, 1], [10, 1], [12, 10]])
    stop()
    let shallow = 0
    let nested = 0
    const stopShallow = watch(() => state.user, () => shallow++)
    const stopNested = watch(() => { void state.user.name; return state.user }, (next, prev) => {
        nested++; assert.equal(next, prev)
    })
    state.user.name = 'B'
    assert.equal(shallow, 0)
    assert.equal(nested, 1)
    stopShallow(); stopNested()
})

test('immediate watches inside batches initialize synchronously and suppress direct recursion', () => {
    const state = reactive({ count: 1 })
    const seen: unknown[] = []
    let stop = () => {}
    batch(() => {
        stop = watch(() => state.count, (next, prev) => seen.push([next, prev]), { immediate: true })
        assert.deepEqual(seen, [[1, undefined]])
        state.count = 2
        state.count = 1
    })
    assert.equal(seen.length, 1)
    stop()
    let calls = 0
    const stopWrite = watch(() => state.count, () => { calls++; state.count++ }, { immediate: true })
    assert.equal(calls, 1)
    state.count++
    assert.equal(calls, 2)
    stopWrite()
})

test('watch failures clean initial subscriptions and preserve the last successful value', () => {
    const state = reactive({ count: 1 })
    const failure = new Error('watch failure')
    let initial = 0
    assert.throws(() => watch(() => { initial++; void state.count; throw failure }, () => {}), error => error === failure)
    assert.throws(() => watch(() => state.count, () => { initial++; throw failure }, { immediate: true }), error => error === failure)
    state.count++
    assert.equal(initial, 2)
    const seen: unknown[] = []
    const stop = watch(() => {
        if (state.count === 3) throw failure
        return state.count
    }, (next, prev) => {
        seen.push([next, prev])
        if (next === 4) throw failure
    })
    assert.throws(() => { state.count = 3 }, error => error === failure)
    assert.throws(() => { state.count = 4 }, error => error === failure)
    state.count = 5
    assert.deepEqual(seen, [[4, 2], [5, 4]])
    stop()
    assert.throws(() => watch(null as never, () => {}), TypeError)
    assert.throws(() => watch(() => 1, null as never), TypeError)
})

test('watch queue cancellation, self-stop and aggregated failures remain usable', () => {
    const state = reactive({ count: 0 })
    let stopSecond = () => {}
    const stopFirst = watch(() => state.count, () => stopSecond())
    stopSecond = watch(() => state.count, () => assert.fail('stopped queued watcher'))
    state.count++
    stopFirst()
    let calls = 0
    const stopSelf = watch(() => state.count, () => { calls++; stopSelf(); state.count++ })
    state.count++
    state.count++
    assert.equal(calls, 1)
    const errors = [new Error('one'), new Error('two')]
    const stops = errors.map(error => watch(() => state.count, () => { throw error }))
    assert.throws(() => { state.count++ }, error => error instanceof AggregateError && errors.every((e, i) => e === error.errors[i]))
    stops.forEach(stop => stop())
    state.count++
})
