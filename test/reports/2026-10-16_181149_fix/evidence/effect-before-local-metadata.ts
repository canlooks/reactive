interface DerivedLink {
    reference: WeakRef<EffectNode>
    retained?: EffectNode
}
interface DerivedRegistration { dep: WeakRef<Dep>; link: WeakRef<DerivedLink> }
export type Dep = Set<EffectNode | DerivedLink>

export interface ChangeSource { owner: object; commit: number }
export type ReadVersions = Map<Dep, number>
export type ChangeReceipt = Map<Dep, { before: number; after: number }>
export interface CandidateComputation {
    value: unknown
    reads: ReadVersions
    consumers: Dep
    adopt: () => void
}
export interface ReadView {
    values: Map<object, object>
    changed: Set<Dep>
    computations: Map<EffectNode, CandidateComputation>
    evaluating: Set<EffectNode>
}

export interface EffectNode<T = unknown> {
    fn: () => T
    deps: Dep[]
    active: boolean
    running: boolean
    hasRun: boolean
    afterRun?: () => void
    notify?: () => void
    computed?: {
        consumers: Dep
        invalidate: () => void
    }
}

export type PropertyState =
    | { kind: 'absent' }
    | { kind: 'data'; value: unknown }
    | { kind: 'accessor'; get: PropertyDescriptor['get']; set: PropertyDescriptor['set'] }

interface ChangeEntry {
    before: PropertyState
    readCurrent: () => PropertyState
    sources: Set<ChangeSource | undefined>
}

interface BatchContext {
    changes: Map<object, Map<PropertyKey, ChangeEntry>>
    computedDeps: Map<EffectNode, Dep[]>
    beforeFlush: Map<object, () => void>
    afterFlush: Map<object, () => void>
}

const targetDeps = new WeakMap<object, Map<PropertyKey, Dep>>()
const objectChanges = Symbol('object changes')
const pendingEffects = new Set<EffectNode>()
const pendingSources = new Map<EffectNode, Set<ChangeSource | undefined>>()
const afterEffects = new Map<object, () => void>()
const depVersions = new WeakMap<Dep, number>()
const computedOwners = new WeakMap<Dep, EffectNode>()
const derivedLinks = new WeakMap<EffectNode, DerivedLink>()
// Only a live node owns these strong Dep keys, never its source-side weak link.
const derivedRegistrations = new WeakMap<EffectNode, Map<Dep, DerivedRegistration>>()
const retentionOwners = new Set<EffectNode>()
let retentionDepth = 0
// Neither endpoint may be held strongly here: a retained link can reach its target.
const derivedFinalizer = new FinalizationRegistry<DerivedRegistration>(held => {
    const dep = held.dep.deref()
    const link = held.link.deref()
    if (dep && link) dep.delete(link)
})
let activeEffect: EffectNode | undefined
let activeCapture: ReadVersions | undefined
let activeView: ReadView | undefined
let subscriptionReads = false
let batchDepth = 0
let currentBatch: BatchContext | undefined
let flushing = false

export function createEffectNode<T>(fn: () => T): EffectNode<T> {
    return { fn, deps: [], active: true, running: false, hasRun: false }
}

export function getDep(target: object, key: PropertyKey): Dep {
    let keys = targetDeps.get(target)
    if (!keys) targetDeps.set(target, keys = new Map())
    let dep = keys.get(key)
    if (!dep) keys.set(key, dep = new Set())
    return dep
}

export function depVersion(dep: Dep): number { return depVersions.get(dep) ?? 0 }

export function readsAreCurrent(reads: ReadVersions): boolean {
    return [...reads].every(([dep, version]) => depVersion(dep) === version)
}

export function acknowledgeReads(reads: ReadVersions, receipt: ChangeReceipt): void {
    for (const [dep, change] of receipt) {
        if (reads.get(dep) === change.before) reads.set(dep, change.after)
    }
}

export function captureDependencies<T>(fn: () => T): { value: T; reads: ReadVersions } {
    const previousEffect = activeEffect
    const previousCapture = activeCapture
    const previousReads = subscriptionReads
    const reads: ReadVersions = new Map()
    activeEffect = undefined
    activeCapture = reads
    subscriptionReads = true
    try { return { value: fn(), reads } } finally {
        activeEffect = previousEffect
        activeCapture = previousCapture
        subscriptionReads = previousReads
    }
}

export function withReadView<T>(view: ReadView, fn: () => T): T {
    const previous = activeView
    activeView = view
    try { return fn() } finally { activeView = previous }
}

export function getReadView(): ReadView | undefined { return activeView }
export function isSubscriptionRead(): boolean { return subscriptionReads }

/** React must see its own raw props when a notification reenters the renderer. */
export function outsideReadContext<T>(fn: () => T): T {
    const previousView = activeView
    const previousReads = subscriptionReads
    activeView = undefined
    subscriptionReads = false
    try { return untracked(fn) } finally {
        activeView = previousView
        subscriptionReads = previousReads
    }
}

export function registerComputed(dep: Dep, node: EffectNode): void { computedOwners.set(dep, node) }

function subscriptionEntry(node: EffectNode): EffectNode | DerivedLink {
    if (!node.computed) return node
    let link = derivedLinks.get(node)
    if (!link) derivedLinks.set(node, link = { reference: new WeakRef(node) })
    return link
}

/** Preserve subscription order and hold live nodes throughout synchronous traversal. */
function depNodes(dep: Dep): EffectNode[] {
    const nodes: EffectNode[] = []
    for (const entry of dep) {
        const node = 'reference' in entry ? entry.retained ?? entry.reference.deref() : entry
        if (node) nodes.push(node)
        else dep.delete(entry)
    }
    return nodes
}

export function hasDepSubscribers(dep: Dep): boolean { return depNodes(dep).some(node => node.active) }

function hasActiveConsumer(node: EffectNode, live: Set<EffectNode>, seen = new Set<EffectNode>()): boolean {
    if (live.has(node)) return true
    if (seen.has(node)) return false
    seen.add(node)
    // This walk invokes no user code, so it can stop at the first real consumer
    // without copying a potentially large subscriber set on every edge change.
    const dep = node.computed!.consumers
    for (const entry of dep) {
        const consumer = 'reference' in entry ? entry.retained ?? entry.reference.deref() : entry
        if (!consumer) { dep.delete(entry); continue }
        if (consumer.active && (!consumer.computed || hasActiveConsumer(consumer, live, seen))) {
            live.add(node)
            return true
        }
    }
    return false
}

/** Only real consumers pin derivations; a cycle of derived nodes cannot pin itself. */
function refreshComputedRetention(deps: Iterable<Dep>): void {
    for (const dep of deps) {
        const owner = computedOwners.get(dep)
        if (owner) retentionOwners.add(owner)
    }
    // Recollection temporarily removes edges. Assess the final synchronous graph
    // once, not every intermediate shape in a computed chain or notification wave.
    if (retentionDepth || !retentionOwners.size) return
    const pending = [...retentionOwners]
    retentionOwners.clear()
    const seen = new Set<EffectNode>()
    const live = new Set<EffectNode>()
    while (pending.length) {
        const node = pending.pop()!
        if (seen.has(node)) continue
        seen.add(node)
        const link = subscriptionEntry(node) as DerivedLink
        const retained = node.active && hasActiveConsumer(node, live) ? node : undefined
        if (link.retained === retained) continue
        link.retained = retained
        for (const dep of node.deps) {
            const owner = computedOwners.get(dep)
            if (owner) pending.push(owner)
        }
    }
}

function addSubscription(node: EffectNode, dep: Dep): boolean {
    const entry = subscriptionEntry(node)
    if (dep.has(entry)) return false
    dep.add(entry)
    if ('reference' in entry) {
        let registrations = derivedRegistrations.get(node)
        if (!registrations) derivedRegistrations.set(node, registrations = new Map())
        if (!registrations.has(dep)) {
            const registration = { dep: new WeakRef(dep), link: new WeakRef(entry) }
            registrations.set(dep, registration)
            derivedFinalizer.register(node, registration, registration)
        }
    }
    return true
}

/** Reuse unchanged registrations across recollection; discard only detached edges. */
function pruneRegistrations(node: EffectNode): void {
    if (!node.computed) return
    const registrations = derivedRegistrations.get(node)
    if (!registrations || (registrations.size === node.deps.length && node.deps.every(dep => registrations.has(dep)))) return
    const current = new Set(node.deps)
    for (const [dep, registration] of registrations) {
        if (current.has(dep)) continue
        derivedFinalizer.unregister(registration)
        registrations.delete(dep)
    }
    if (!registrations.size) derivedRegistrations.delete(node)
}

export function hasViewChanges(node: EffectNode, view: ReadView, seen = new Set<EffectNode>()): boolean {
    if (seen.has(node)) return false
    seen.add(node)
    return node.deps.some(dep => {
        if (view.changed.has(dep)) return true
        const parent = computedOwners.get(dep)
        return parent !== undefined && (view.computations.has(parent) || hasViewChanges(parent, view, seen))
    })
}

export function replaceDeps(node: EffectNode, deps: Iterable<Dep>): void {
    const previous = cleanup(node, true)
    if (node.active) {
        node.deps = [...deps]
        for (const dep of node.deps) addSubscription(node, dep)
    }
    finishRecollection(node, previous)
}

/** Reordering the same subscriptions changes no ownership; inspect only changed edges. */
function finishRecollection(node: EffectNode, previous: Dep[]): void {
    const current = node.deps
    if (previous.length === current.length && previous.every((dep, i) => dep === current[i])) return
    pruneRegistrations(node)
    const before = new Set(previous)
    const after = new Set(current)
    refreshComputedRetention([...previous.filter(dep => !after.has(dep)), ...current.filter(dep => !before.has(dep))])
}

function cleanup(node: EffectNode, recollecting = false): Dep[] {
    const previous = node.deps
    const entry = subscriptionEntry(node)
    for (const dep of previous) dep.delete(entry)
    node.deps = []
    if (!recollecting) {
        pruneRegistrations(node)
        refreshComputedRetention(previous)
    }
    return previous
}

export function runEffect<T>(node: EffectNode<T>): T {
    const context = currentBatch
    if (node.computed && node.hasRun && context && !context.computedDeps.has(node)) {
        context.computedDeps.set(node, node.deps.slice())
    }

    retentionDepth++
    const previousDeps = cleanup(node, true)
    const previous = activeEffect
    const previousCapture = activeCapture
    const previousView = activeView
    const previousReads = subscriptionReads
    activeEffect = node
    activeCapture = undefined
    activeView = undefined
    subscriptionReads = true
    node.running = true
    let result!: T
    let failed = false
    let failure: unknown
    try {
        result = node.fn()
    } catch (error) {
        failed = true
        failure = error
    } finally {
        node.running = false
        node.hasRun = true
        activeEffect = previous
        activeCapture = previousCapture
        activeView = previousView
        subscriptionReads = previousReads
        // A computed first read inside this batch starts with its first collected dependencies.
        if (node.computed && context && !context.computedDeps.has(node)) {
            context.computedDeps.set(node, node.deps.slice())
        }
        finishRecollection(node, previousDeps)
        retentionDepth--
        refreshComputedRetention([])
    }
    try { node.afterRun?.() } catch (error) {
        if (failed) throw new AggregateError([failure, error], 'Multiple errors in reactive effect')
        throw error
    }
    if (failed) throw failure
    return result
}

export function trackDep(dep: Dep): void {
    if (activeCapture) {
        if (!activeCapture.has(dep)) activeCapture.set(dep, depVersion(dep))
        return
    }
    if (!activeEffect?.active || !addSubscription(activeEffect, dep)) return
    activeEffect.deps.push(dep)
}

export function track(target: object, key: PropertyKey): void {
    if (!activeEffect?.active && !activeCapture) return
    trackDep(getDep(target, key))
}

/** Internal deep observers subscribe without changing public enumeration semantics. */
export function trackObjectChanges(target: object): void { track(target, objectChanges) }

export function stopEffect(node: EffectNode): void {
    node.active = false
    cleanup(node)
    pendingEffects.delete(node)
    pendingSources.delete(node)
}

export function isEffectPending(node: EffectNode): boolean {
    return pendingEffects.has(node)
}

export function enqueueEffect(node: EffectNode, source?: ChangeSource): void {
    if (!node.active || (node.running && !node.notify)) return
    pendingEffects.add(node)
    let sources = pendingSources.get(node)
    if (!sources) pendingSources.set(node, sources = new Set())
    sources.add(source)
}

/** Isolate callback reads, including reads from an enclosing effect. */
export function untracked<T>(fn: () => T): T {
    const previous = activeEffect
    const previousCapture = activeCapture
    activeEffect = undefined
    activeCapture = undefined
    try { return fn() } finally { activeEffect = previous; activeCapture = previousCapture }
}

/** Commit-only integration phases, shared with an enclosing public batch. */
export function onBatchSettled(owner: object, before: () => void, after: () => void): void {
    if (!currentBatch) throw new Error('Commit coordination requires a batch')
    currentBatch.beforeFlush.set(owner, before)
    currentBatch.afterFlush.set(owner, after)
}

/** Deduplicate passive work after ordinary notifications, including an enclosing batch. */
export function afterEffectsSettled(owner: object, callback: () => void): void {
    if (currentBatch) currentBatch.afterFlush.set(owner, callback)
    else if (flushing) afterEffects.set(owner, callback)
    else runInBatch(() => { currentBatch!.afterFlush.set(owner, callback) })
}

export function acknowledgeNotification(node: EffectNode, owner: object, commit: number): void {
    const sources = pendingSources.get(node)
    if (!sources) return
    for (const source of sources) {
        if (source?.owner === owner && source.commit <= commit) sources.delete(source)
    }
    if (!sources.size) {
        pendingEffects.delete(node)
        pendingSources.delete(node)
    }
}

/** Run immediately, collect synchronous reads, and return an idempotent disposer. */
export function effect(fn: () => void): () => void {
    if (typeof fn !== 'function') throw new TypeError('effect expects a function')
    const node = createEffectNode(fn)
    try {
        runEffect(node)
    } catch (error) {
        stopEffect(node)
        throw error
    }
    return () => stopEffect(node)
}

export function samePropertyState(a: PropertyState, b: PropertyState): boolean {
    if (a.kind !== b.kind) return false
    if (a.kind === 'data' && b.kind === 'data') return Object.is(a.value, b.value)
    if (a.kind === 'accessor' && b.kind === 'accessor') return a.get === b.get && a.set === b.set
    return true
}

function invalidateComputeds(dep: Dep | undefined, visited = new Set<EffectNode>(), receipt?: ChangeReceipt): void {
    if (!dep) return
    const before = depVersion(dep)
    depVersions.set(dep, before + 1)
    if (receipt) {
        const previous = receipt.get(dep)
        receipt.set(dep, { before: previous?.before ?? before, after: before + 1 })
    }
    for (const node of depNodes(dep)) {
        if (!node.active || !node.computed || visited.has(node)) continue
        visited.add(node)
        node.computed.invalidate()
        invalidateComputeds(node.computed.consumers, visited, receipt)
    }
}

export function recordChange(
    target: object,
    key: PropertyKey,
    before: PropertyState,
    readCurrent: () => PropertyState,
    source?: ChangeSource,
    receipt?: ChangeReceipt,
): void {
    if (samePropertyState(before, readCurrent())) return
    // All proxy writes share runInBatch, including writes made by setters.
    const context = currentBatch!
    let keys = context.changes.get(target)
    if (!keys) context.changes.set(target, keys = new Map())
    if (!keys.has(key)) keys.set(key, { before, readCurrent, sources: new Set() })
    keys.get(key)!.sources.add(source)
    invalidateComputeds(targetDeps.get(target)?.get(key), new Set(), receipt)
}

function restoreComputedDeps(context: BatchContext): void {
    const restored: EffectNode[] = []
    const affected = new Set<Dep>()
    for (const [node, deps] of context.computedDeps) {
        if (!node.active || (node.deps.length === deps.length && deps.every(dep => dep.has(subscriptionEntry(node))))) continue
        for (const dep of cleanup(node, true)) affected.add(dep)
        node.deps = deps
        for (const dep of deps) { addSubscription(node, dep); affected.add(dep) }
        pruneRegistrations(node)
        restored.push(node)
    }
    refreshComputedRetention(affected)
    // Restore the whole graph before propagating invalidation through it.
    invalidateComputeds(new Set(restored))
}

function collectEffects(dep: Dep | undefined, visited: Set<EffectNode>, source: ChangeSource | undefined): void {
    if (!dep) return
    for (const node of depNodes(dep)) {
        if (!node.active || visited.has(node)) continue
        visited.add(node)
        if (node.computed) {
            // Dirty nodes still have consumers. Collection must not invalidate a final cache.
            collectEffects(node.computed.consumers, visited, source)
        } else if (!node.running || node.notify) {
            enqueueEffect(node, source)
        }
    }
}

function settleBatch(context: BatchContext): void {
    restoreComputedDeps(context)
    const visitedBySource = new Map<ChangeSource | undefined, Set<EffectNode>>()
    for (const [target, keys] of context.changes) {
        const objectDep = targetDeps.get(target)?.get(objectChanges)
        let objectChanged = false
        for (const [key, entry] of keys) {
            if (!samePropertyState(entry.before, entry.readCurrent())) {
                if (objectDep && !objectChanged) {
                    objectChanged = true
                    depVersions.set(objectDep, depVersion(objectDep) + 1)
                }
                for (const source of entry.sources) {
                    let visited = visitedBySource.get(source)
                    if (!visited) visitedBySource.set(source, visited = new Set())
                    collectEffects(targetDeps.get(target)?.get(key), visited, source)
                    collectEffects(objectDep, visited, source)
                }
            }
        }
    }
}

function flushEffects(): unknown[] {
    const errors: unknown[] = []
    if (flushing) return errors
    flushing = true
    try {
        while (pendingEffects.size || afterEffects.size) {
            if (!pendingEffects.size) {
                const [owner, finish] = afterEffects.entries().next().value!
                afterEffects.delete(owner)
                try { finish() } catch (error) { errors.push(error) }
                continue
            }
            const node = pendingEffects.values().next().value!
            pendingEffects.delete(node)
            pendingSources.delete(node)
            if (!node.active || node.running) continue
            try {
                if (node.notify) {
                    node.running = true
                    try { outsideReadContext(node.notify) } finally { node.running = false }
                } else {
                    runEffect(node)
                }
            } catch (error) {
                errors.push(error)
            }
        }
    } finally {
        flushing = false
    }
    return errors
}

export function runInBatch<T>(fn: () => T): T {
    retentionDepth++
    if (batchDepth++ === 0) {
        currentBatch = { changes: new Map(), computedDeps: new Map(), beforeFlush: new Map(), afterFlush: new Map() }
    }
    let result!: T
    const errors: unknown[] = []
    try {
        result = fn()
    } catch (error) {
        errors.push(error)
    } finally {
        if (--batchDepth === 0) {
            const context = currentBatch!
            // Effects can write again: those writes need a fresh baseline and context.
            currentBatch = undefined
            try { settleBatch(context) } catch (error) { errors.push(error) }
            for (const finish of context.beforeFlush.values()) {
                try { finish() } catch (error) { errors.push(error) }
            }
            for (const [owner, finish] of context.afterFlush) afterEffects.set(owner, finish)
            errors.push(...flushEffects())
        }
        retentionDepth--
        refreshComputedRetention([])
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, 'Multiple errors in reactive batch')
    return result
}
