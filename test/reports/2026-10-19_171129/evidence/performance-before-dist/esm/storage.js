import { afterEffectsSettled, createEffectNode, outsideReadContext, runEffect, stopEffect, } from './effect.js';
import { batch } from './batch.js';
import { reactive, toRaw } from './reactive.js';
import { withoutReferenceCapture } from './reference.js';
import { decodeStorage, encodeStorage, isStorageRoot, prepareStorageRestore, scanStorage } from './storageSnapshot.js';
const roots = new WeakMap();
const backends = new WeakMap();
function isolated(fn) {
    return outsideReadContext(() => withoutReferenceCapture(fn));
}
function report(name, phase, error) {
    try {
        isolated(() => console.warn('@canlooks/reactive storage failed', { name, phase, error }));
    }
    catch { /* Diagnostics are best effort. */ }
}
/** Read then exactly once, defer its invocation, and adopt arbitrary PromiseLike results. */
function asPromise(value) {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
        return undefined;
    const then = Reflect.get(value, 'then');
    if (typeof then !== 'function')
        return undefined;
    return Promise.resolve().then(() => new Promise((resolve, reject) => {
        Reflect.apply(then, value, [resolve, reject]);
    }));
}
function release(registration) {
    stopEffect(registration.node);
    const backend = registration.backend.deref();
    const names = backend && backends.get(backend);
    if (names?.get(registration.name) === registration.reference)
        names.delete(registration.name);
}
const finalizer = new FinalizationRegistry(release);
// These factories must not close over a controller: shared children may outlive its root.
function observation(reference) {
    const node = createEffectNode(() => {
        const controller = reference.deref();
        if (controller)
            controller.observe();
        else
            stopEffect(node);
    });
    return node;
}
function writer(reference) {
    return () => isolated(() => reference.deref()?.drain());
}
class StorageController {
    raw;
    name;
    adapter;
    state;
    node;
    registration;
    writeAfterEffects;
    phase = 'reading';
    generation = 0;
    localRevision = 0;
    baseline = false;
    lastObserved;
    confirmed;
    pending;
    inFlight;
    retry = false;
    constructor(raw, name, adapter) {
        this.raw = raw;
        this.name = name;
        this.adapter = adapter;
        this.state = reactive(raw);
        const reference = new WeakRef(this);
        this.node = observation(reference);
        this.writeAfterEffects = writer(reference);
        this.registration = { node: this.node, backend: new WeakRef(adapter), name, reference };
    }
    observe() {
        if (this.phase === 'stopped')
            return;
        if (!this.baseline)
            this.localRevision++;
        scanStorage(this.raw);
        let snapshot;
        try {
            snapshot = encodeStorage(this.raw);
        }
        catch (error) {
            this.pending = undefined;
            this.retry = true;
            report(this.name, 'encode', error);
            return;
        }
        const changed = snapshot !== this.lastObserved || this.retry;
        this.lastObserved = snapshot;
        if (!this.baseline && this.phase === 'ready' && changed)
            this.queue(snapshot);
    }
    sample() {
        this.baseline = true;
        this.retry = false;
        try {
            runEffect(this.node);
        }
        finally {
            this.baseline = false;
        }
    }
    start() {
        this.sample();
        let result;
        let promise;
        try {
            result = this.adapter.getItem(this.name);
            promise = asPromise(result);
        }
        catch (error) {
            this.readFailed('get', error);
            return;
        }
        if (!promise) {
            this.receive(result);
            return;
        }
        const generation = this.generation;
        void promise.then(value => isolated(() => {
            if (!this.current(generation))
                return;
            try {
                this.receive(value);
            }
            catch (error) {
                report(this.name, 'hydrate', error);
            }
        }), error => isolated(() => {
            if (this.current(generation))
                this.readFailed('get', error);
        })).catch(error => report(this.name, 'hydrate', error));
    }
    current(generation) {
        return this.phase !== 'stopped' && generation === this.generation;
    }
    readFailed(phase, error) {
        report(this.name, phase, error);
        this.phase = 'ready';
        this.pending = undefined;
        this.retry = false;
        this.sample();
    }
    receive(value) {
        if (value === null) {
            this.phase = 'ready';
            this.sample();
            if (!this.retry && this.lastObserved !== undefined)
                this.queue(this.lastObserved);
            return;
        }
        let decoded;
        try {
            decoded = decodeStorage(value, this.raw);
        }
        catch (error) {
            this.readFailed('decode', error);
            return;
        }
        if (this.localRevision) {
            this.confirmed = decoded.snapshot;
            this.phase = 'ready';
            this.sample();
            if (!this.retry && this.lastObserved !== undefined)
                this.queue(this.lastObserved);
            return;
        }
        let restore;
        try {
            restore = prepareStorageRestore(this.raw, decoded.data);
        }
        catch (error) {
            this.readFailed('restore', error);
            return;
        }
        this.confirmed = this.lastObserved = restore.snapshot;
        this.retry = false;
        this.phase = 'ready';
        // Set the expected baseline before notifying consumers, so only business edits save.
        // Errors from those consumers are deliberately outside the decode/preflight catch.
        batch(() => {
            restore.apply(this.state);
            this.sample();
        });
    }
    queue(snapshot) {
        this.retry = false;
        this.pending = snapshot;
        afterEffectsSettled(this, this.writeAfterEffects);
    }
    drain() {
        if (this.phase !== 'ready' || this.inFlight || this.pending === undefined)
            return;
        const snapshot = this.pending;
        this.pending = undefined;
        if (snapshot === this.confirmed)
            return;
        const attempt = this.inFlight = { snapshot, generation: this.generation };
        let promise;
        try {
            const result = this.adapter.setItem(this.name, snapshot);
            promise = asPromise(result);
            if (!promise && result !== undefined)
                throw new TypeError('storage setItem must return void or a PromiseLike');
        }
        catch (error) {
            this.written(attempt, false, error);
            return;
        }
        if (!promise) {
            this.written(attempt, true);
            return;
        }
        void promise.then(() => isolated(() => this.written(attempt, true)), error => isolated(() => this.written(attempt, false, error)))
            .catch(error => report(this.name, 'set', error));
    }
    written(attempt, success, error) {
        if (!this.current(attempt.generation) || this.inFlight !== attempt)
            return;
        this.inFlight = undefined;
        if (success)
            this.confirmed = attempt.snapshot;
        else {
            this.retry = true;
            if (this.pending === attempt.snapshot)
                this.pending = undefined;
            report(this.name, 'set', error);
        }
        if (this.pending !== undefined)
            afterEffectsSettled(this, this.writeAfterEffects);
    }
    stop() {
        if (this.phase === 'stopped')
            return;
        this.phase = 'stopped';
        this.generation++;
        this.pending = this.inFlight = undefined;
        release(this.registration);
        finalizer.unregister(this.registration);
        if (roots.get(this.raw) === this)
            roots.delete(this.raw);
    }
}
function validAdapter(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'getItem') === 'function' && typeof Reflect.get(value, 'setItem') === 'function';
}
function backend(options) {
    if (options.adapter !== undefined) {
        if (!validAdapter(options.adapter))
            throw new TypeError('storage adapter requires getItem and setItem functions');
        return options.adapter;
    }
    // Structural access keeps browser declarations out of the core's public types.
    try {
        const browser = globalThis.window;
        if (!browser)
            return undefined;
        const adapter = browser[options.type ?? 'localStorage'];
        if (!validAdapter(adapter))
            throw new TypeError('Browser storage is unavailable');
        return adapter;
    }
    catch (error) {
        report(options.name, 'access', error);
        return undefined;
    }
}
/** Create a reactive data object with automatic, ordered JSON persistence. */
export function storage(initialState, options) {
    return isolated(() => {
        if (!isStorageRoot(initialState))
            throw new TypeError('storage expects a plain object or array');
        if (!options || typeof options.name !== 'string' || !options.name.trim())
            throw new TypeError('storage requires a non-empty name');
        if (options.type !== undefined && options.type !== 'localStorage' && options.type !== 'sessionStorage') {
            throw new TypeError('storage type must be localStorage or sessionStorage');
        }
        const raw = toRaw(initialState);
        const adapter = backend(options);
        const previous = roots.get(raw);
        if (previous) {
            if (previous.adapter !== adapter || previous.name !== options.name)
                throw new TypeError('storage root is already bound to another key or adapter');
            return previous.state;
        }
        if (!adapter)
            return reactive(initialState);
        let names = backends.get(adapter);
        if (!names)
            backends.set(adapter, names = new Map());
        for (const [name, reference] of names)
            if (!reference.deref())
                names.delete(name);
        if (names.get(options.name)?.deref())
            throw new TypeError('storage key already belongs to another root');
        const controller = new StorageController(raw, options.name, adapter);
        roots.set(raw, controller);
        names.set(options.name, controller.registration.reference);
        finalizer.register(controller, controller.registration, controller.registration);
        try {
            controller.start();
        }
        catch (error) {
            controller.stop();
            throw error;
        }
        return controller.state;
    });
}
/** Internal lifecycle cleanup; intentionally absent from the public entry. */
export function stopStorage(state) { roots.get(toRaw(state))?.stop(); }
