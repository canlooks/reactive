import assert from 'node:assert/strict'
import { test } from 'node:test'
import { batch, computed, effect, reactive, watch } from '../src/index.js'
import { captureReference } from '../src/reference.js'

test('computed shells are lazy, readonly, non-callable and retain identity in reactive containers', () => {
    const state = reactive({ count: 1 })
    let calls = 0
    const value = { count: 1 }
    const derived = computed(() => { calls++; return state.count ? value : undefined })
    assert.equal(calls, 0)
    assert.ok(Object.isFrozen(derived))
    assert.equal(reactive(derived), derived)
    assert.equal(reactive({ derived }).derived, derived)
    assert.equal(reactive([derived])[0], derived)
    assert.equal(calls, 0)
    assert.equal(derived.value, value)
    assert.equal(derived.value, value)
    assert.equal(calls, 1)
    assert.equal(Object.isFrozen(value), false)
    assert.equal(Reflect.set(derived, 'value', 123), false)
    assert.throws(() => { Object.assign(derived, { value: 123 }) }, TypeError)
    assert.throws(() => Reflect.apply(derived as never, undefined, []), TypeError)
    const seen: unknown[] = []
    const stop = watch(() => derived.value, (next, prev) => seen.push([next, prev]))
    state.count = 0
    assert.deepEqual(seen, [[undefined, value]])
    assert.equal(calls, 2)
    stop()
    const fn = () => 'data'
    assert.equal(computed(() => fn).value, fn)
    const ordinary = reactive({ value: 1 })
    ordinary.value = 2
    assert.equal(ordinary.value, 2)
})

test('property references support nested paths, arrays, symbols, empty and missing keys', () => {
    const key = Symbol('field')
    const state = reactive({ user: { name: 'A' }, items: ['first'], '': 0, [key]: 1, optional: undefined as number | undefined })
    const seen: unknown[] = []
    const stop = effect(() => seen.push([state.user.name, state.items[0], state[''], state[key]]))
    batch(() => {
        captureReference(() => state.user.name).write('B')
        captureReference(() => state.items[0]).write('second')
        captureReference(() => state['']).write(2)
        captureReference(() => state[key]).write(3)
    })
    assert.deepEqual(seen, [['A', 'first', 0, 1], ['B', 'second', 2, 3]])
    const missing = reactive({} as { value?: number })
    captureReference(() => missing.value).write(1)
    assert.equal(missing.value, 1)
    const previous = state.user
    state.user = { name: 'C' }
    captureReference(() => state.user.name).write('D')
    assert.equal(previous.name, 'B')
    assert.equal(state.user.name, 'D')
    stop()
})

test('writable getter references isolate backing reads and invoke their setter once', () => {
    let getterCalls = 0
    let setterCalls = 0
    const state = reactive({
        first: 'A', last: 'B',
        get name() { getterCalls++; return `${this.first} ${this.last}` },
        set name(value: string) { setterCalls++; [this.first, this.last] = value.split(' ') },
    })
    const seen: string[] = []
    const stop = effect(() => seen.push(state.name))
    assert.equal(captureReference(() => state.name).value, 'A B')
    assert.equal(getterCalls, 1)
    captureReference(() => state.name).write('C D')
    assert.equal(setterCalls, 1)
    assert.deepEqual(seen, ['A B', 'C D'])
    const nested = reactive({ get user() { return state } })
    captureReference(() => nested.user.name).write('E F')
    assert.equal(setterCalls, 2)
    stop()
})

test('reference validation rejects readonly, derived and ambiguous selectors and restores contexts', () => {
    const state = reactive({ a: 1, b: 1, get readonly() { return this.a } })
    const double = computed(() => state.a)
    assert.equal(double.value, 1) // Derived reads must fail even on a cache hit.
    const raw = { value: 1 }
    const frozen = reactive(Object.freeze({ value: 1 }))
    const nonextensible = reactive(Object.preventExtensions({}) as { value?: number })
    const fixedRawChild = reactive(Object.freeze({ child: raw }))
    for (const selector of [() => 1, () => raw.value, () => state.readonly, () => double.value,
        () => state.a + 1, () => state.a + state.b - 1, () => (state.a, state.b),
        () => frozen.value, () => nonextensible.value, () => fixedRawChild.child.value]) {
        assert.throws(() => captureReference(selector), TypeError)
    }
    const error = new Error('selector')
    assert.throws(() => captureReference(() => { state.a; throw error }), e => e === error)
    const nested = captureReference(() => {
        assert.throws(() => captureReference(() => double.value), TypeError)
        return state.a
    })
    nested.write(2)
    assert.equal(state.a, 2)
    const reference = captureReference(() => state.b)
    Object.defineProperty(state, 'b', { writable: false })
    assert.throws(() => reference.write(3), TypeError)
})
