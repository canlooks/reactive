const targetDeps = new WeakMap();
const objectChanges = Symbol('object changes');
const pendingEffects = new Set();
const pendingSources = new Map();
const afterEffects = new Map();
const depVersions = new WeakMap();
const computedOwners = new WeakMap();
let activeEffect;
let activeCapture;
let activeView;
let subscriptionReads = false;
let batchDepth = 0;
let currentBatch;
let flushing = false;
export function createEffectNode(fn) {
    return { fn, deps: [], active: true, running: false, hasRun: false };
}
export function getDep(target, key) {
    let keys = targetDeps.get(target);
    if (!keys)
        targetDeps.set(target, keys = new Map());
    let dep = keys.get(key);
    if (!dep)
        keys.set(key, dep = new Set());
    return dep;
}
export function depVersion(dep) { return depVersions.get(dep) ?? 0; }
export function readsAreCurrent(reads) {
    return [...reads].every(([dep, version]) => depVersion(dep) === version);
}
export function acknowledgeReads(reads, receipt) {
    for (const [dep, change] of receipt) {
        if (reads.get(dep) === change.before)
            reads.set(dep, change.after);
    }
}
export function captureDependencies(fn) {
    const previousEffect = activeEffect;
    const previousCapture = activeCapture;
    const previousReads = subscriptionReads;
    const reads = new Map();
    activeEffect = undefined;
    activeCapture = reads;
    subscriptionReads = true;
    try {
        return { value: fn(), reads };
    }
    finally {
        activeEffect = previousEffect;
        activeCapture = previousCapture;
        subscriptionReads = previousReads;
    }
}
export function withReadView(view, fn) {
    const previous = activeView;
    activeView = view;
    try {
        return fn();
    }
    finally {
        activeView = previous;
    }
}
export function getReadView() { return activeView; }
export function isSubscriptionRead() { return subscriptionReads; }
/** React must see its own raw props when a notification reenters the renderer. */
export function outsideReadContext(fn) {
    const previousView = activeView;
    const previousReads = subscriptionReads;
    activeView = undefined;
    subscriptionReads = false;
    try {
        return untracked(fn);
    }
    finally {
        activeView = previousView;
        subscriptionReads = previousReads;
    }
}
export function registerComputed(dep, node) { computedOwners.set(dep, node); }
export function hasViewChanges(node, view, seen = new Set()) {
    if (seen.has(node))
        return false;
    seen.add(node);
    return node.deps.some(dep => {
        if (view.changed.has(dep))
            return true;
        const parent = computedOwners.get(dep);
        return parent !== undefined && (view.computations.has(parent) || hasViewChanges(parent, view, seen));
    });
}
export function replaceDeps(node, deps) {
    cleanup(node);
    if (!node.active)
        return;
    node.deps = [...deps];
    for (const dep of node.deps)
        dep.add(node);
}
function cleanup(node) {
    for (const dep of node.deps)
        dep.delete(node);
    node.deps = [];
}
export function runEffect(node) {
    const context = currentBatch;
    if (node.computed && node.hasRun && context && !context.computedDeps.has(node)) {
        context.computedDeps.set(node, node.deps.slice());
    }
    cleanup(node);
    const previous = activeEffect;
    const previousCapture = activeCapture;
    const previousView = activeView;
    const previousReads = subscriptionReads;
    activeEffect = node;
    activeCapture = undefined;
    activeView = undefined;
    subscriptionReads = true;
    node.running = true;
    let result;
    let failed = false;
    let failure;
    try {
        result = node.fn();
    }
    catch (error) {
        failed = true;
        failure = error;
    }
    finally {
        node.running = false;
        node.hasRun = true;
        activeEffect = previous;
        activeCapture = previousCapture;
        activeView = previousView;
        subscriptionReads = previousReads;
        // A computed first read inside this batch starts with its first collected dependencies.
        if (node.computed && context && !context.computedDeps.has(node)) {
            context.computedDeps.set(node, node.deps.slice());
        }
    }
    try {
        node.afterRun?.();
    }
    catch (error) {
        if (failed)
            throw new AggregateError([failure, error], 'Multiple errors in reactive effect');
        throw error;
    }
    if (failed)
        throw failure;
    return result;
}
export function trackDep(dep) {
    if (activeCapture) {
        if (!activeCapture.has(dep))
            activeCapture.set(dep, depVersion(dep));
        return;
    }
    if (!activeEffect?.active || dep.has(activeEffect))
        return;
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
}
export function track(target, key) {
    if (!activeEffect?.active && !activeCapture)
        return;
    trackDep(getDep(target, key));
}
/** Internal deep observers subscribe without changing public enumeration semantics. */
export function trackObjectChanges(target) { track(target, objectChanges); }
export function stopEffect(node) {
    node.active = false;
    cleanup(node);
    pendingEffects.delete(node);
    pendingSources.delete(node);
}
export function isEffectPending(node) {
    return pendingEffects.has(node);
}
export function enqueueEffect(node, source) {
    if (!node.active || (node.running && !node.notify))
        return;
    pendingEffects.add(node);
    let sources = pendingSources.get(node);
    if (!sources)
        pendingSources.set(node, sources = new Set());
    sources.add(source);
}
/** Isolate callback reads, including reads from an enclosing effect. */
export function untracked(fn) {
    const previous = activeEffect;
    const previousCapture = activeCapture;
    activeEffect = undefined;
    activeCapture = undefined;
    try {
        return fn();
    }
    finally {
        activeEffect = previous;
        activeCapture = previousCapture;
    }
}
/** Commit-only integration phases, shared with an enclosing public batch. */
export function onBatchSettled(owner, before, after) {
    if (!currentBatch)
        throw new Error('Commit coordination requires a batch');
    currentBatch.beforeFlush.set(owner, before);
    currentBatch.afterFlush.set(owner, after);
}
/** Deduplicate passive work after ordinary notifications, including an enclosing batch. */
export function afterEffectsSettled(owner, callback) {
    if (currentBatch)
        currentBatch.afterFlush.set(owner, callback);
    else if (flushing)
        afterEffects.set(owner, callback);
    else
        runInBatch(() => { currentBatch.afterFlush.set(owner, callback); });
}
export function acknowledgeNotification(node, owner, commit) {
    const sources = pendingSources.get(node);
    if (!sources)
        return;
    for (const source of sources) {
        if (source?.owner === owner && source.commit <= commit)
            sources.delete(source);
    }
    if (!sources.size) {
        pendingEffects.delete(node);
        pendingSources.delete(node);
    }
}
/** Run immediately, collect synchronous reads, and return an idempotent disposer. */
export function effect(fn) {
    if (typeof fn !== 'function')
        throw new TypeError('effect expects a function');
    const node = createEffectNode(fn);
    try {
        runEffect(node);
    }
    catch (error) {
        stopEffect(node);
        throw error;
    }
    return () => stopEffect(node);
}
export function samePropertyState(a, b) {
    if (a.kind !== b.kind)
        return false;
    if (a.kind === 'data' && b.kind === 'data')
        return Object.is(a.value, b.value);
    if (a.kind === 'accessor' && b.kind === 'accessor')
        return a.get === b.get && a.set === b.set;
    return true;
}
function invalidateComputeds(dep, visited = new Set(), receipt) {
    if (!dep)
        return;
    const before = depVersion(dep);
    depVersions.set(dep, before + 1);
    if (receipt) {
        const previous = receipt.get(dep);
        receipt.set(dep, { before: previous?.before ?? before, after: before + 1 });
    }
    for (const node of [...dep]) {
        if (!node.active || !node.computed || visited.has(node))
            continue;
        visited.add(node);
        node.computed.invalidate();
        invalidateComputeds(node.computed.consumers, visited, receipt);
    }
}
export function recordChange(target, key, before, readCurrent, source, receipt) {
    if (samePropertyState(before, readCurrent()))
        return;
    // All proxy writes share runInBatch, including writes made by setters.
    const context = currentBatch;
    let keys = context.changes.get(target);
    if (!keys)
        context.changes.set(target, keys = new Map());
    if (!keys.has(key))
        keys.set(key, { before, readCurrent, sources: new Set() });
    keys.get(key).sources.add(source);
    invalidateComputeds(targetDeps.get(target)?.get(key), new Set(), receipt);
}
function restoreComputedDeps(context) {
    const restored = [];
    for (const [node, deps] of context.computedDeps) {
        if (!node.active || (node.deps.length === deps.length && deps.every(dep => dep.has(node))))
            continue;
        cleanup(node);
        node.deps = deps;
        for (const dep of deps)
            dep.add(node);
        restored.push(node);
    }
    // Restore the whole graph before propagating invalidation through it.
    invalidateComputeds(new Set(restored));
}
function collectEffects(dep, visited, source) {
    if (!dep)
        return;
    for (const node of [...dep]) {
        if (!node.active || visited.has(node))
            continue;
        visited.add(node);
        if (node.computed) {
            // Dirty nodes still have consumers. Collection must not invalidate a final cache.
            collectEffects(node.computed.consumers, visited, source);
        }
        else if (!node.running || node.notify) {
            enqueueEffect(node, source);
        }
    }
}
function settleBatch(context) {
    restoreComputedDeps(context);
    const visitedBySource = new Map();
    for (const [target, keys] of context.changes) {
        const objectDep = targetDeps.get(target)?.get(objectChanges);
        let objectChanged = false;
        for (const [key, entry] of keys) {
            if (!samePropertyState(entry.before, entry.readCurrent())) {
                if (objectDep && !objectChanged) {
                    objectChanged = true;
                    depVersions.set(objectDep, depVersion(objectDep) + 1);
                }
                for (const source of entry.sources) {
                    let visited = visitedBySource.get(source);
                    if (!visited)
                        visitedBySource.set(source, visited = new Set());
                    collectEffects(targetDeps.get(target)?.get(key), visited, source);
                    collectEffects(objectDep, visited, source);
                }
            }
        }
    }
}
function flushEffects() {
    const errors = [];
    if (flushing)
        return errors;
    flushing = true;
    try {
        while (pendingEffects.size || afterEffects.size) {
            if (!pendingEffects.size) {
                const [owner, finish] = afterEffects.entries().next().value;
                afterEffects.delete(owner);
                try {
                    finish();
                }
                catch (error) {
                    errors.push(error);
                }
                continue;
            }
            const node = pendingEffects.values().next().value;
            pendingEffects.delete(node);
            pendingSources.delete(node);
            if (!node.active || node.running)
                continue;
            try {
                if (node.notify) {
                    node.running = true;
                    try {
                        outsideReadContext(node.notify);
                    }
                    finally {
                        node.running = false;
                    }
                }
                else {
                    runEffect(node);
                }
            }
            catch (error) {
                errors.push(error);
            }
        }
    }
    finally {
        flushing = false;
    }
    return errors;
}
export function runInBatch(fn) {
    if (batchDepth++ === 0) {
        currentBatch = { changes: new Map(), computedDeps: new Map(), beforeFlush: new Map(), afterFlush: new Map() };
    }
    let result;
    const errors = [];
    try {
        result = fn();
    }
    catch (error) {
        errors.push(error);
    }
    finally {
        if (--batchDepth === 0) {
            const context = currentBatch;
            // Effects can write again: those writes need a fresh baseline and context.
            currentBatch = undefined;
            try {
                settleBatch(context);
            }
            catch (error) {
                errors.push(error);
            }
            for (const finish of context.beforeFlush.values()) {
                try {
                    finish();
                }
                catch (error) {
                    errors.push(error);
                }
            }
            for (const [owner, finish] of context.afterFlush)
                afterEffects.set(owner, finish);
            errors.push(...flushEffects());
        }
    }
    if (errors.length === 1)
        throw errors[0];
    if (errors.length > 1)
        throw new AggregateError(errors, 'Multiple errors in reactive batch');
    return result;
}
