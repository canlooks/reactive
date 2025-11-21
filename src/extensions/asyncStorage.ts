import {AsyncStorageEngine, AsyncStorageOptions} from '../..'
import {Proxyable} from '../core'
import {debounce, logPrefix} from '../utils'

let asyncStorageEngine: AsyncStorageEngine<any> | undefined

export function registerAsyncStorageEngine<T>(engine: AsyncStorageEngine<T> | null) {
    asyncStorageEngine = engine || void 0
}

export async function defineAsyncStorage<T extends object>(name: string, initialValues?: T, options: AsyncStorageOptions = {}) {
    if (!asyncStorageEngine) {
        throw Error(logPrefix + 'Async-storage engine is not registered. Please call "registerAsyncStorageEngine()" first.')
    }

    const engine = asyncStorageEngine

    const initialize = async (): Promise<T> => {
        let value = await engine.getItem(name)
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
        engine.setItem(name, JSON.stringify(target))
    }

    const syncStorage = options.debounce ? debounce(_sync, options.debounce) : _sync

    const handler = (target: T) => {
        syncStorage(target)
        return true
    }

    const {proxy} = new Proxyable(await initialize(), {
        onSet: handler,
        onDefineProperty: handler,
        onDeleteProperty: handler,
        deep: options.deep
    })

    return proxy
}