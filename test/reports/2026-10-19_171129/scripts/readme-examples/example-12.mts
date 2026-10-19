import { storage, type StorageAdapter } from '@canlooks/reactive'

const records = new Map<string, string>()
const adapter: StorageAdapter = {
    getItem(key) { return records.get(key) ?? null },
    setItem(key, value) { records.set(key, value) },
}
const state = storage({ count: 1 }, { name: 'counter', adapter })

export const qa = {records,adapter,state}
