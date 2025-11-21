import {StorageEngine, StorageOptions} from '../..'
import {Proxyable} from '../core'
import {debounce, nextTick} from '../utils'

let storageEngine: StorageEngine<any> | undefined

export function registerStorageEngine<T>(engine: StorageEngine<T> | null) {
    storageEngine = engine || void 0
}

export function defineStorage<T extends object>(name: string, initialValues?: T, options: StorageOptions = {}) {
    const engine = storageEngine || window[options.mode || 'localStorage']

    const initialize = (): T => {
        let value = engine.getItem(name)
        if (value !== null && typeof value !== 'undefined') {
            try {
                value = JSON.parse(value)
            } catch (e) {
            }
        }
        value ??= initialValues ?? {}
        return value
    }

    const _sync = (target: T) => {
        const fn = () => {
            engine.setItem(name, JSON.stringify(target))
        }
        options.async !== false ? nextTick(fn) : fn()
    }

    const syncStorage = options.debounce ? debounce(_sync, options.debounce) : _sync

    const handler = (target: T) => {
        syncStorage(target)
        return true
    }

    const {proxy} = new Proxyable(initialize(), {
        onSet: handler,
        onDefineProperty: handler,
        onDeleteProperty: handler,
        deep: options.deep
    })

    return proxy
}