import { createEffectNode, isEffectPending, runEffect, stopEffect, untracked } from './effect.js'

export interface WatchOptions { immediate?: boolean }

/** Internal lifecycle handle; creation does not execute user code. */
export function createWatch<T>(
    source: () => T,
    callback: (newValue: T, oldValue: T | undefined) => void,
    options?: WatchOptions,
) {
    if (typeof source !== 'function' || typeof callback !== 'function') {
        throw new TypeError('watch expects source and callback functions')
    }
    const immediate = untracked(() => options?.immediate === true)
    let initialized = false
    let value: T
    let silent = false
    let refreshRequested = false
    let revision = 0
    const node = createEffectNode(() => {
        const hadValue = initialized
        const oldValue = value
        revision++
        const nextValue = source()
        value = nextValue
        initialized = true
        if (!silent && (hadValue || immediate)) {
            untracked(() => callback(nextValue, hadValue ? oldValue : undefined))
        }
    })
    const handle = {
        node,
        get revision() { return revision },
        initialize() {
            try { runEffect(node) } catch (error) { handle.stop(); throw error }
        },
        update(nextSource: () => T, nextCallback: (next: T, previous: T | undefined) => void) {
            source = nextSource
            callback = nextCallback
        },
        refresh() {
            if (!node.active || isEffectPending(node)) return
            if (node.running) { refreshRequested = true; return }
            silent = true
            try { runEffect(node) } finally { silent = false }
        },
        stop() {
            refreshRequested = false
            stopEffect(node)
        },
    }
    node.afterRun = () => {
        if (!refreshRequested) return
        refreshRequested = false
        handle.refresh()
    }
    return handle
}

export type WatchHandle<T> = ReturnType<typeof createWatch<T>>

export function watch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions & { immediate?: false }): () => void
export function watch<T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: WatchOptions): () => void
export function watch<T>(source: () => T, callback: (newValue: T, oldValue: T) => void, options?: WatchOptions): () => void {
    const handle = createWatch(source, callback as (next: T, previous: T | undefined) => void, options)
    handle.initialize()
    return handle.stop
}
