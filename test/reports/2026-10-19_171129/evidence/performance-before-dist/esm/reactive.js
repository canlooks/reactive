import { recordChange, runInBatch, track } from './effect.js';
import { computed, isComputed } from './computed.js';
import { batch } from './batch.js';
import { recordReferenceRead, withoutReferenceCapture } from './reference.js';
const rawToProxy = new WeakMap();
const proxyToRaw = new WeakMap();
const getterCache = new WeakMap();
const batchedInstances = new WeakSet();
const methodCache = new WeakMap();
function isObject(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
}
/** Internal identity normalization; not part of the package API. */
export function toRaw(value) {
    return (isObject(value) ? proxyToRaw.get(value) ?? value : value);
}
function isNative(fn) {
    return /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn));
}
function isBuiltinConstructor(ctor) {
    if (isNative(ctor))
        return true;
    // Some hosts implement Web APIs such as URL and Headers in JavaScript. Their
    // branded prototypes still require internal slots. Inspect descriptors only,
    // so deciding whether to proxy never executes a user's toStringTag getter.
    const prototype = Reflect.getOwnPropertyDescriptor(ctor, 'prototype')?.value;
    const tag = isObject(prototype) ? Reflect.getOwnPropertyDescriptor(prototype, Symbol.toStringTag)?.value : undefined;
    return typeof tag === 'string' && tag === Reflect.getOwnPropertyDescriptor(ctor, 'name')?.value;
}
function canProxy(target) {
    if (typeof target === 'function')
        return !isBuiltinConstructor(target) && Object.hasOwn(target, 'prototype');
    if (Array.isArray(target))
        return true;
    let current = target;
    while ((current = Reflect.getPrototypeOf(current))) {
        current = toRaw(current);
        const ctor = Reflect.getOwnPropertyDescriptor(current, 'constructor')?.value;
        if (typeof ctor === 'function' && ctor !== Object && isBuiltinConstructor(ctor))
            return false;
    }
    return true;
}
function propertyState(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    if (!descriptor)
        return { kind: 'absent' };
    if ('value' in descriptor)
        return { kind: 'data', value: toRaw(descriptor.value) };
    return { kind: 'accessor', get: descriptor.get, set: descriptor.set };
}
function findProperty(target, key) {
    let current = target;
    while (current) {
        current = toRaw(current);
        const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
        if (descriptor)
            return { owner: current, descriptor };
        current = Reflect.getPrototypeOf(current);
    }
    return undefined;
}
function readGetter(receiver, key, getter) {
    if (!isObject(receiver))
        return Reflect.apply(getter, receiver, []);
    let cache = getterCache.get(receiver);
    if (!cache)
        getterCache.set(receiver, cache = new Map());
    let entry = cache.get(key);
    if (!entry || entry.getter !== getter) {
        entry = { getter, read: computed(() => Reflect.apply(getter, receiver, [])) };
        cache.set(key, entry);
    }
    return entry.read.value;
}
function isClassMethod(target, key, owner, descriptor) {
    if (typeof descriptor.value !== 'function')
        return false;
    if (typeof target === 'function') {
        return typeof owner === 'function' && !isBuiltinConstructor(owner) && !descriptor.enumerable;
    }
    if (!batchedInstances.has(target) || owner === target || key === 'constructor')
        return false;
    const ctor = Reflect.getOwnPropertyDescriptor(owner, 'constructor')?.value;
    return typeof ctor === 'function' && !isBuiltinConstructor(ctor);
}
function wrapMethod(receiver, key, method) {
    const wrap = () => function (...args) {
        return batch(() => Reflect.apply(method, this, args));
    };
    if (!isObject(receiver))
        return wrap();
    let cache = methodCache.get(receiver);
    if (!cache)
        methodCache.set(receiver, cache = new Map());
    let entry = cache.get(key);
    if (!entry || entry.method !== method) {
        entry = { method, wrapped: wrap() };
        cache.set(key, entry);
    }
    return entry.wrapped;
}
function isArrayIndex(key) {
    if (typeof key !== 'string')
        return false;
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < 0xffff_ffff && String(index) === key;
}
const handlers = {
    get(target, key, receiver) {
        const own = Reflect.getOwnPropertyDescriptor(target, key);
        if (own && !own.configurable) {
            if ('value' in own && !own.writable)
                return recordReferenceRead(receiver, target, key, own.value, own);
            if (!('value' in own) && !own.get)
                return recordReferenceRead(receiver, target, key, undefined, own);
        }
        track(target, key);
        const property = findProperty(target, key);
        const getter = property?.descriptor.get;
        if (property && isClassMethod(target, key, property.owner, property.descriptor)) {
            // Use the raw descriptor, never another proxy's already wrapped method.
            return recordReferenceRead(receiver, target, key, wrapMethod(receiver, key, property.descriptor.value), property.descriptor);
        }
        // Getter internals (including their computed cache) must not become the
        // assignment target. Dependency tracking remains active throughout.
        const value = withoutReferenceCapture(() => getter ? readGetter(receiver, key, getter) : Reflect.get(target, key, receiver));
        return recordReferenceRead(receiver, target, key, value !== null && typeof value === 'object' ? reactive(value) : value, property?.descriptor);
    },
    set(target, key, value, receiver) {
        return runInBatch(() => {
            const before = propertyState(target, key);
            const normalized = toRaw(value);
            const implicit = new Map();
            if (Array.isArray(target) && target === toRaw(receiver)) {
                if (isArrayIndex(key) && Number(key) >= target.length) {
                    implicit.set('length', propertyState(target, 'length'));
                }
                else if (key === 'length' && (typeof normalized !== 'number' || normalized < target.length)) {
                    // Enumerate actual own indices, never the holes of a sparse array. Avoid
                    // coercing non-number lengths here: Reflect.set owns value conversion.
                    for (const index of Reflect.ownKeys(target)) {
                        if (isArrayIndex(index) && (typeof normalized !== 'number' || Number(index) >= normalized)) {
                            implicit.set(index, propertyState(target, index));
                        }
                    }
                }
            }
            const success = Reflect.set(target, key, normalized, receiver);
            if (success && target === toRaw(receiver)) {
                recordChange(target, key, before, () => propertyState(target, key));
                for (const [implicitKey, state] of implicit) {
                    recordChange(target, implicitKey, state, () => propertyState(target, implicitKey));
                }
            }
            return success;
        });
    },
    deleteProperty(target, key) {
        return runInBatch(() => {
            const before = propertyState(target, key);
            const success = Reflect.deleteProperty(target, key);
            if (success)
                recordChange(target, key, before, () => propertyState(target, key));
            return success;
        });
    },
    construct(target, args, newTarget) {
        const instance = Reflect.construct(target, args, newTarget);
        batchedInstances.add(toRaw(instance));
        return reactive(instance);
    },
};
export function reactive(target) {
    // Only an omitted argument selects the factory; explicit undefined is still invalid.
    if (arguments.length === 0)
        return reactive;
    if (!isObject(target))
        throw new TypeError('reactive expects an object or a class');
    if (proxyToRaw.has(target) || isComputed(target))
        return target;
    const cached = rawToProxy.get(target);
    if (cached)
        return cached;
    if (!canProxy(target))
        return target;
    const proxy = new Proxy(target, handlers);
    rawToProxy.set(target, proxy);
    proxyToRaw.set(proxy, target);
    return proxy;
}
