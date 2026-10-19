import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM, type DOMWindow } from 'jsdom'
import { batch, effect, reactive, storage } from '../src/index.js'
import { stopStorage } from '../src/storage.js'

function restore(target: object, key: string, descriptor?: PropertyDescriptor) {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
}

function withWindow(run: (window: DOMWindow) => void) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const dom = new JSDOM('', { url: 'https://storage.test/' })
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window })
    try { run(dom.window) } finally {
        restore(globalThis, 'window', descriptor)
        dom.window.close()
    }
}

test('native storage restores before returning, defaults to localStorage and isolates sessionStorage', t => {
    withWindow(window => {
        const name = ' exact key '
        window.localStorage.setItem(name, '{"count":2}')
        window.sessionStorage.setItem(name, '{"count":8}')
        const raw = { count: 0, title: 'default' }
        const local = storage(raw, { name })
        const session = storage({ count: 0 }, { name, type: 'sessionStorage' })
        t.after(() => { stopStorage(local); stopStorage(session) })
        assert.equal(local, reactive(raw))
        assert.equal(storage(local, { name, type: 'localStorage' }), local)
        assert.deepEqual(local, { count: 2, title: 'default' })
        assert.equal(session.count, 8)
        // A cache hit does not rewrite the record just to add a missing default.
        assert.equal(window.localStorage.getItem(name), '{"count":2}')
        batch(() => { local.count = 3; local.count = 4; local.title = 'next' })
        assert.equal(window.localStorage.getItem(name), '{"count":4,"title":"next"}')
        assert.equal(window.sessionStorage.getItem(name), '{"count":8}')
        session.count++
        assert.equal(window.sessionStorage.getItem(name), '{"count":9}')
        assert.equal(window.localStorage.getItem(name.trim()), null)
    })
})

test('native storage creates a missing array snapshot and replaces cached array contents in place', t => {
    withWindow(window => {
        const list = storage([1, 2, 3], { name: 'new' })
        t.after(() => stopStorage(list))
        assert.equal(window.localStorage.getItem('new'), '[1,2,3]')
        batch(() => { list.splice(0, 2); list.push(4) })
        assert.equal(window.localStorage.getItem('new'), '[3,4]')
        window.sessionStorage.setItem('cached', '[9]')
        const initial = reactive([0, 1, 2])
        const cached = storage(initial, { name: 'cached', type: 'sessionStorage' })
        t.after(() => stopStorage(cached))
        assert.equal(cached, initial)
        assert.deepEqual(cached, [9])
    })
})

test('an explicit adapter takes precedence without touching either browser storage getter', t => {
    withWindow(window => {
        let accesses = 0
        for (const key of ['localStorage', 'sessionStorage']) {
            Object.defineProperty(window, key, { configurable: true, get() { accesses++; throw new Error(key) } })
        }
        const writes: string[] = []
        const state = storage({ count: 0 }, { name: 'custom', type: 'sessionStorage', adapter: {
            getItem() { return '{"count":5}' },
            setItem(_key, value) { writes.push(value) },
        } })
        t.after(() => stopStorage(state))
        state.count++
        assert.equal(accesses, 0)
        assert.deepEqual(writes, ['{"count":6}'])
    })
})

test('a blocked browser getter falls back to memory and can be bound once access is restored', t => {
    const warnings: unknown[] = []
    t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args) })
    withWindow(window => {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
        const raw = { count: 0 }
        const state = storage(raw, { name: 'blocked' })
        state.count++
        assert.equal(state, reactive(raw))
        assert.equal(warnings.length, 1)
        restore(window, 'localStorage', descriptor)
        assert.equal(storage(state, { name: 'blocked' }), state)
        t.after(() => stopStorage(state))
        state.count++
        assert.equal(window.localStorage.getItem('blocked'), '{"count":2}')
    })
})

test('native quota failures preserve notifications and retry on a later state change', t => {
    const warnings: unknown[] = []
    t.mock.method(console, 'warn', (...args: unknown[]) => { warnings.push(args) })
    withWindow(window => {
        const original = window.Storage.prototype.setItem
        let full = true
        let attempts = 0
        t.mock.method(window.Storage.prototype, 'setItem', function (this: Storage, key: string, value: string) {
            attempts++
            if (full) throw new window.DOMException('Full', 'QuotaExceededError')
            original.call(this, key, value)
        })
        const state = storage({ count: 0 }, { name: 'quota' })
        t.after(() => stopStorage(state))
        const seen: number[] = []
        const stop = effect(() => { seen.push(state.count) })
        t.after(stop)
        state.count++
        assert.equal(attempts, 2)
        assert.equal(warnings.length, 2)
        assert.equal(window.localStorage.getItem('quota'), null)
        full = false
        state.count++
        assert.deepEqual(seen, [0, 1, 2])
        assert.equal(window.localStorage.getItem('quota'), '{"count":2}')
    })
})

test('SSR ignores Node global storage and does not reserve a backend binding', () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    let accesses = 0
    Reflect.deleteProperty(globalThis, 'window')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { accesses++; throw new Error('Node storage') } })
    try {
        const raw = { count: 0 }
        const state = storage(raw, { name: 'server' })
        assert.equal(storage(raw, { name: 'another' }), state)
        state.count++
        assert.equal(state.count, 1)
        assert.equal(accesses, 0)
    } finally {
        restore(globalThis, 'window', windowDescriptor)
        restore(globalThis, 'localStorage', storageDescriptor)
    }
})
