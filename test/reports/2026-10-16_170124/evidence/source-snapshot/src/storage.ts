import {
    afterEffectsSettled, createEffectNode, outsideReadContext, runEffect, stopEffect, type EffectNode,
} from './effect.js'
import { batch } from './batch.js'
import { reactive, toRaw } from './reactive.js'
import { withoutReferenceCapture } from './reference.js'
import { decodeStorage, encodeStorage, isStorageRoot, prepareStorageRestore, scanStorage } from './storageSnapshot.js'

export interface StorageAdapter {
    getItem(key: string): string | null | PromiseLike<string | null>
    setItem(key: string, value: string): void | PromiseLike<void>
}
export interface StorageOptions {
    name: string
    /** Defaults to localStorage; a supplied adapter takes precedence. */
    type?: 'localStorage' | 'sessionStorage'
    adapter?: StorageAdapter
}

const roots = new WeakMap<object, StorageController>()
const backends = new WeakMap<StorageAdapter, Map<string, WeakRef<StorageController>>>()

function isolated<T>(fn: () => T): T {
    return outsideReadContext(() => withoutReferenceCapture(fn))
}

function report(name: string, phase: string, error: unknown): void {
    try { isolated(() => console.warn('@canlooks/reactive storage failed', { name, phase, error })) } catch { /* Diagnostics are best effort. */ }
}

/** Read then exactly once, defer its invocation, and adopt arbitrary PromiseLike results. */
function asPromise(value: unknown): Promise<unknown> | undefined {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined
    const then: unknown = Reflect.get(value, 'then')
    if (typeof then !== 'function') return undefined
    return Promise.resolve().then(() => new Promise<unknown>((resolve, reject) => {
        Reflect.apply(then, value, [resolve, reject])
    }))
}

interface Registration {
    node: EffectNode<void>
    backend: WeakRef<StorageAdapter>
    name: string
    reference: WeakRef<StorageController>
}

function release(registration: Registration): void {
    stopEffect(registration.node)
    const backend = registration.backend.deref()
    const names = backend && backends.get(backend)
    if (names?.get(registration.name) === registration.reference) names.delete(registration.name)
}

const finalizer = new FinalizationRegistry<Registration>(release)

// These factories must not close over a controller: shared children may outlive its root.
function observation(reference: WeakRef<StorageController>): EffectNode<void> {
    const node = createEffectNode(() => {
        const controller = reference.deref()
        if (controller) controller.observe()
        else stopEffect(node)
    })
    return node
}
function writer(reference: WeakRef<StorageController>): () => void {
    return () => isolated(() => reference.deref()?.drain())
}

class StorageController {
    readonly state: object
    readonly node: EffectNode<void>
    readonly registration: Registration
    private readonly writeAfterEffects: () => void
    private phase: 'reading' | 'ready' | 'stopped' = 'reading'
    private generation = 0
    private localRevision = 0
    private baseline = false
    private lastObserved?: string
    private confirmed?: string
    private pending?: string
    private inFlight?: { snapshot: string; generation: number }
    private retry = false

    constructor(readonly raw: object, readonly name: string, readonly adapter: StorageAdapter) {
        this.state = reactive(raw)
        const reference = new WeakRef(this)
        this.node = observation(reference)
        this.writeAfterEffects = writer(reference)
        this.registration = { node: this.node, backend: new WeakRef(adapter), name, reference }
    }

    observe(): void {
        if (this.phase === 'stopped') return
        if (!this.baseline) this.localRevision++
        scanStorage(this.raw)
        let snapshot: string
        try { snapshot = encodeStorage(this.raw) } catch (error) {
            this.pending = undefined
            this.retry = true
            report(this.name, 'encode', error)
            return
        }
        const changed = snapshot !== this.lastObserved || this.retry
        this.lastObserved = snapshot
        if (!this.baseline && this.phase === 'ready' && changed) this.queue(snapshot)
    }

    private sample(): void {
        this.baseline = true
        this.retry = false
        try { runEffect(this.node) } finally { this.baseline = false }
    }

    start(): void {
        this.sample()
        let result: unknown
        let promise: Promise<unknown> | undefined
        try {
            result = this.adapter.getItem(this.name)
            promise = asPromise(result)
        } catch (error) { this.readFailed('get', error); return }
        if (!promise) { this.receive(result); return }
        const generation = this.generation
        void promise.then(value => isolated(() => {
            if (!this.current(generation)) return
            try { this.receive(value) } catch (error) { report(this.name, 'hydrate', error) }
        }), error => isolated(() => {
            if (this.current(generation)) this.readFailed('get', error)
        })).catch(error => report(this.name, 'hydrate', error))
    }

    private current(generation: number): boolean {
        return this.phase !== 'stopped' && generation === this.generation
    }

    private readFailed(phase: string, error: unknown): void {
        report(this.name, phase, error)
        this.phase = 'ready'
        this.pending = undefined
        this.retry = false
        this.sample()
    }

    private receive(value: unknown): void {
        if (value === null) {
            this.phase = 'ready'
            this.sample()
            if (!this.retry && this.lastObserved !== undefined) this.queue(this.lastObserved)
            return
        }
        let decoded: ReturnType<typeof decodeStorage>
        try { decoded = decodeStorage(value, this.raw) } catch (error) { this.readFailed('decode', error); return }
        if (this.localRevision) {
            this.confirmed = decoded.snapshot
            this.phase = 'ready'
            this.sample()
            if (!this.retry && this.lastObserved !== undefined) this.queue(this.lastObserved)
            return
        }
        let restore: ReturnType<typeof prepareStorageRestore>
        try { restore = prepareStorageRestore(this.raw, decoded.data) } catch (error) { this.readFailed('restore', error); return }
        this.confirmed = this.lastObserved = restore.snapshot
        this.retry = false
        this.phase = 'ready'
        // Set the expected baseline before notifying consumers, so only business edits save.
        // Errors from those consumers are deliberately outside the decode/preflight catch.
        batch(() => {
            restore.apply(this.state)
            this.sample()
        })
    }

    private queue(snapshot: string): void {
        this.retry = false
        this.pending = snapshot
        afterEffectsSettled(this, this.writeAfterEffects)
    }

    drain(): void {
        if (this.phase !== 'ready' || this.inFlight || this.pending === undefined) return
        const snapshot = this.pending
        this.pending = undefined
        if (snapshot === this.confirmed) return
        const attempt = this.inFlight = { snapshot, generation: this.generation }
        let promise: Promise<unknown> | undefined
        try {
            const result: unknown = this.adapter.setItem(this.name, snapshot)
            promise = asPromise(result)
            if (!promise && result !== undefined) throw new TypeError('storage setItem must return void or a PromiseLike')
        } catch (error) { this.written(attempt, false, error); return }
        if (!promise) { this.written(attempt, true); return }
        void promise.then(() => isolated(() => this.written(attempt, true)),
            error => isolated(() => this.written(attempt, false, error)))
            .catch(error => report(this.name, 'set', error))
    }

    private written(attempt: NonNullable<StorageController['inFlight']>, success: boolean, error?: unknown): void {
        if (!this.current(attempt.generation) || this.inFlight !== attempt) return
        this.inFlight = undefined
        if (success) this.confirmed = attempt.snapshot
        else {
            this.retry = true
            if (this.pending === attempt.snapshot) this.pending = undefined
            report(this.name, 'set', error)
        }
        if (this.pending !== undefined) afterEffectsSettled(this, this.writeAfterEffects)
    }

    stop(): void {
        if (this.phase === 'stopped') return
        this.phase = 'stopped'
        this.generation++
        this.pending = this.inFlight = undefined
        release(this.registration)
        finalizer.unregister(this.registration)
        if (roots.get(this.raw) === this) roots.delete(this.raw)
    }
}

function validAdapter(value: unknown): value is StorageAdapter {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'getItem') === 'function' && typeof Reflect.get(value, 'setItem') === 'function'
}

function backend(options: StorageOptions): StorageAdapter | undefined {
    if (options.adapter !== undefined) {
        if (!validAdapter(options.adapter)) throw new TypeError('storage adapter requires getItem and setItem functions')
        return options.adapter
    }
    // Structural access keeps browser declarations out of the core's public types.
    try {
        const browser = (globalThis as { window?: { localStorage?: unknown; sessionStorage?: unknown } }).window
        if (!browser) return undefined
        const adapter = browser[options.type ?? 'localStorage']
        if (!validAdapter(adapter)) throw new TypeError('Browser storage is unavailable')
        return adapter
    } catch (error) { report(options.name, 'access', error); return undefined }
}

/** Create a reactive data object with automatic, ordered JSON persistence. */
export function storage<T extends object>(initialState: T, options: StorageOptions): T {
    return isolated(() => {
        if (!isStorageRoot(initialState)) throw new TypeError('storage expects a plain object or array')
        if (!options || typeof options.name !== 'string' || !options.name.trim()) throw new TypeError('storage requires a non-empty name')
        if (options.type !== undefined && options.type !== 'localStorage' && options.type !== 'sessionStorage') {
            throw new TypeError('storage type must be localStorage or sessionStorage')
        }
        const raw = toRaw(initialState)
        const adapter = backend(options)
        const previous = roots.get(raw)
        if (previous) {
            if (previous.adapter !== adapter || previous.name !== options.name) throw new TypeError('storage root is already bound to another key or adapter')
            return previous.state as T
        }
        if (!adapter) return reactive(initialState)
        let names = backends.get(adapter)
        if (!names) backends.set(adapter, names = new Map())
        for (const [name, reference] of names) if (!reference.deref()) names.delete(name)
        if (names.get(options.name)?.deref()) throw new TypeError('storage key already belongs to another root')
        const controller = new StorageController(raw, options.name, adapter)
        roots.set(raw, controller)
        names.set(options.name, controller.registration.reference)
        finalizer.register(controller, controller.registration, controller.registration)
        try { controller.start() } catch (error) { controller.stop(); throw error }
        return controller.state as T
    })
}

/** Internal lifecycle cleanup; intentionally absent from the public entry. */
export function stopStorage(state: object): void { roots.get(toRaw(state))?.stop() }
