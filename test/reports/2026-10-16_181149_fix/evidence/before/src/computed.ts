import {
    captureDependencies, createEffectNode, getReadView, hasViewChanges,
    registerComputed, replaceDeps, runEffect, trackDep, type Dep,
} from './effect.js'
import { markDerivedRead, withoutReferenceCapture } from './reference.js'

export interface Computed<T> { readonly value: T }

const computedValues = new WeakSet<object>()
export function isComputed(value: object): boolean { return computedValues.has(value) }

/** Return a readonly, lazy value whose synchronous dependencies invalidate its cache. */
export function computed<T>(getter: () => T): Computed<T> {
    if (typeof getter !== 'function') throw new TypeError('computed expects a function')
    let dirty = true
    let value: T
    const consumers: Dep = new Set()
    const node = createEffectNode(getter)
    node.computed = { consumers, invalidate: () => { dirty = true } }
    registerComputed(consumers, node)

    const read = () => {
        if (node.running) throw new Error('Circular computed evaluation')
        trackDep(consumers)
        const view = getReadView()
        if (view) {
            if (view.evaluating.has(node)) throw new Error('Circular computed evaluation')
            const cached = view.computations.get(node)
            if (cached) return cached.value as T
            if (dirty || hasViewChanges(node, view)) {
                view.evaluating.add(node)
                try {
                    const candidate = captureDependencies(getter)
                    view.computations.set(node, {
                        ...candidate, consumers,
                        adopt() {
                            replaceDeps(node, candidate.reads.keys())
                            node.hasRun = true
                            value = candidate.value
                            dirty = false
                        },
                    })
                    return candidate.value
                } finally { view.evaluating.delete(node) }
            }
        }
        if (dirty) {
            // Only a successful evaluation can replace the cache and clear dirty.
            value = runEffect(node)
            dirty = false
        }
        return value
    }
    const result = Object.freeze({ get value() {
        markDerivedRead()
        return withoutReferenceCapture(read)
    } })
    computedValues.add(result)
    return result
}
