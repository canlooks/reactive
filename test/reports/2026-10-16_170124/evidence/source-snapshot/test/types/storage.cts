import { storage, reactive, type StorageAdapter, type StorageOptions } from '@canlooks/reactive'

const sync: StorageAdapter = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
}
const asyncAdapter: StorageAdapter = {
    getItem: async () => '{"count":1}',
    setItem: async () => {},
}
const promised: StorageAdapter = {
    getItem: () => ({ then: Promise.resolve<string | null>(null).then.bind(Promise.resolve<string | null>(null)) }),
    setItem: () => ({ then: Promise.resolve().then.bind(Promise.resolve()) }),
}
const options: StorageOptions = { name: 'settings', adapter: sync }
const state = storage({ count: 0, child: { name: '' } }, options)
const count: number = state.count
const name: string = state.child.name
const records = storage([{ id: 1 }], { name: 'list', type: 'sessionStorage', adapter: asyncAdapter })
const id: number = records[0].id
const numbers: number[] = storage([1, 2], { name: 'numbers', adapter: promised })
const existing = reactive({ active: true })
const same: typeof existing = storage(existing, { name: 'existing', type: 'localStorage' })
void [count, name, id, numbers, same]

// @ts-expect-error name is required
storage({}, {})
// @ts-expect-error type only permits the browser storage names
storage({}, { name: 'x', type: 'indexedDB' })
// @ts-expect-error the initial state must be an object
storage(1, { name: 'x' })
// @ts-expect-error the inferred state shape remains intact
state.count = 'one'
// @ts-expect-error readers return a string or null, never a number
const badRead: StorageAdapter = { getItem: () => 1, setItem: () => {} }
// @ts-expect-error async readers must also return a string or null
const badAsyncRead: StorageAdapter = { getItem: async () => ({}), setItem: () => {} }
// @ts-expect-error localforage-style Promise<string> setters need a void wrapper
const badWrite: StorageAdapter = { getItem: () => null, setItem: async () => 'saved' }
// @ts-expect-error lifecycle helpers are internal
import { stopStorage } from '@canlooks/reactive'
void [badRead, badAsyncRead, badWrite, stopStorage]
