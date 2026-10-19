import { runInBatch } from './effect.js'

/** Delay notifications until this synchronous callback's outermost batch finishes. */
export function batch<T>(fn: () => T): T {
    if (typeof fn !== 'function') throw new TypeError('batch expects a function')
    return runInBatch(fn)
}
