// Compile the README adapter against the optional development dependency only.
// This file is deliberately not imported by the runtime or isolated consumers.
import localforage from 'localforage'
import type { StorageAdapter } from '../src/index.js'

const adapter: StorageAdapter = {
    getItem(key) { return localforage.getItem<string>(key) },
    async setItem(key, value) { await localforage.setItem(key, value) },
}
void adapter
