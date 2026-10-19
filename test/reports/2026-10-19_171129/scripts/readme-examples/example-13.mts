import localforage from 'localforage'
import { storage, type StorageAdapter } from '@canlooks/reactive'

const adapter: StorageAdapter = {
    getItem(key) { return localforage.getItem<string>(key) },
    async setItem(key, value) { await localforage.setItem(key, value) },
}
const state = storage({ count: 1 }, { name: 'counter', adapter })

export const qa = {adapter,state}
