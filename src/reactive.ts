import { recordChange, runInBatch, track, type PropertyState } from './effect.js'
import { computed, isComputed, type Computed } from './computed.js'
import { batch } from './batch.js'
import { recordReferenceRead, withoutReferenceCapture } from './reference.js'

const rawToProxy = new WeakMap<object, object>()
const proxyToRaw = new WeakMap<object, object>()
const getterCache = new WeakMap<object, Map<PropertyKey, { getter: () => unknown; read: Computed<unknown> }>>()
const batchedInstances = new WeakSet<object>()
const methodCache = new WeakMap<object, Map<PropertyKey, { method: Function; wrapped: Function }>>()

function isObject(value: unknown): value is object {
    return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function toRaw<T>(value: T): T {
    return (isObject(value) ? proxyToRaw.get(value) ?? value : value) as T
}

function isNative(fn: Function): boolean {
    return /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn))
}

function isBuiltinConstructor(ctor: Function): boolean {
    if (isNative(ctor)) return true
    // Some hosts implement Web APIs such as URL and Headers in JavaScript. Their
    // branded prototypes still require internal slots. Inspect descriptors only,
    // so deciding whether to proxy never executes a user's toStringTag getter.
    const prototype = Reflect.getOwnPropertyDescriptor(ctor, 'prototype')?.value
    const tag = isObject(prototype) ? Reflect.getOwnPropertyDescriptor(prototype, Symbol.toStringTag)?.value : undefined
    return typeof tag === 'string' && tag === Reflect.getOwnPropertyDescriptor(ctor, 'name')?.value
}

function canProxy(target: object): boolean {
    if (typeof target === 'function') return !isBuiltinConstructor(target) && Object.hasOwn(target, 'prototype')
    if (Array.isArray(target)) return true
    let current: object | null = target
    while ((current = Reflect.getPrototypeOf(current))) {
        current = toRaw(current)
        const ctor = Reflect.getOwnPropertyDescriptor(current, 'constructor')?.value
        if (typeof ctor === 'function' && ctor !== Object && isBuiltinConstructor(ctor)) return false
    }
    return true
}

function propertyState(target: object, key: PropertyKey): PropertyState {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    if (!descriptor) return { kind: 'absent' }
    if ('value' in descriptor) return { kind: 'data', value: toRaw(descriptor.value) }
    return { kind: 'accessor', get: descriptor.get, set: descriptor.set }
}

function findProperty(target: object, key: PropertyKey): { owner: object; descriptor: PropertyDescriptor } | undefined {
    let current: object | null = target
    while (current) {
        current = toRaw(current)
        const descriptor = Reflect.getOwnPropertyDescriptor(current, key)
        if (descriptor) return { owner: current, descriptor }
        current = Reflect.getPrototypeOf(current)
    }
    return undefined
}

function readGetter(receiver: unknown, key: PropertyKey, getter: () => unknown): unknown {
    if (!isObject(receiver)) return Reflect.apply(getter, receiver, [])
    let cache = getterCache.get(receiver)
    if (!cache) getterCache.set(receiver, cache = new Map())
    let entry = cache.get(key)
    if (!entry || entry.getter !== getter) {
        entry = { getter, read: computed(() => Reflect.apply(getter, receiver, [])) }
        cache.set(key, entry)
    }
    return entry.read.value
}

function isClassMethod(target: object, key: PropertyKey, owner: object, descriptor: PropertyDescriptor): boolean {
    if (typeof descriptor.value !== 'function') return false
    if (typeof target === 'function') {
        return typeof owner === 'function' && !isBuiltinConstructor(owner) && !descriptor.enumerable
    }
    if (!batchedInstances.has(target) || owner === target || key === 'constructor') return false
    const ctor = Reflect.getOwnPropertyDescriptor(owner, 'constructor')?.value
    return typeof ctor === 'function' && !isBuiltinConstructor(ctor)
}

function wrapMethod(receiver: unknown, key: PropertyKey, method: Function): Function {
    const wrap = () => function (this: unknown, ...args: unknown[]) {
        return batch(() => Reflect.apply(method, this, args))
    }
    if (!isObject(receiver)) return wrap()
    let cache = methodCache.get(receiver)
    if (!cache) methodCache.set(receiver, cache = new Map())
    let entry = cache.get(key)
    if (!entry || entry.method !== method) {
        entry = { method, wrapped: wrap() }
        cache.set(key, entry)
    }
    return entry.wrapped
}

function isArrayIndex(key: PropertyKey): key is string {
    if (typeof key !== 'string') return false
    const index = Number(key)
    return Number.isInteger(index) && index >= 0 && index < 0xffff_ffff && String(index) === key
}

const handlers: ProxyHandler<object> = {
    get(target, key, receiver) {
        const own = Reflect.getOwnPropertyDescriptor(target, key)
        if (own && !own.configurable) {
            if ('value' in own && !own.writable) return recordReferenceRead(receiver, target, key, own.value, own)
            if (!('value' in own) && !own.get) return recordReferenceRead(receiver, target, key, undefined, own)
        }
        track(target, key)
        const property = findProperty(target, key)
        const getter = property?.descriptor.get
        if (property && isClassMethod(target, key, property.owner, property.descriptor)) {
            // Use the raw descriptor, never another proxy's already wrapped method.
            return recordReferenceRead(receiver, target, key, wrapMethod(receiver, key, property.descriptor.value), property.descriptor)
        }
        // Getter internals (including their computed cache) must not become the
        // assignment target. Dependency tracking remains active throughout.
        const value = withoutReferenceCapture(() => getter ? readGetter(receiver, key, getter) : Reflect.get(target, key, receiver))
        return recordReferenceRead(receiver, target, key, value !== null && typeof value === 'object' ? reactive(value) : value, property?.descriptor)
    },
    set(target, key, value, receiver) {
        return runInBatch(() => {
            const before = propertyState(target, key)
            const normalized = toRaw(value)
            const implicit = new Map<PropertyKey, PropertyState>()
            if (Array.isArray(target) && target === toRaw(receiver)) {
                if (isArrayIndex(key) && Number(key) >= target.length) {
                    implicit.set('length', propertyState(target, 'length'))
                } else if (key === 'length' && (typeof normalized !== 'number' || normalized < target.length)) {
                    // Enumerate actual own indices, never the holes of a sparse array. Avoid
                    // coercing non-number lengths here: Reflect.set owns value conversion.
                    for (const index of Reflect.ownKeys(target)) {
                        if (isArrayIndex(index) && (typeof normalized !== 'number' || Number(index) >= normalized)) {
                            implicit.set(index, propertyState(target, index))
                        }
                    }
                }
            }
            const success = Reflect.set(target, key, normalized, receiver)
            if (success && target === toRaw(receiver)) {
                recordChange(target, key, before, () => propertyState(target, key))
                for (const [implicitKey, state] of implicit) {
                    recordChange(target, implicitKey, state, () => propertyState(target, implicitKey))
                }
            }
            return success
        })
    },
    deleteProperty(target, key) {
        return runInBatch(() => {
            const before = propertyState(target, key)
            const success = Reflect.deleteProperty(target, key)
            if (success) recordChange(target, key, before, () => propertyState(target, key))
            return success
        })
    },
    construct(target, args, newTarget) {
        const instance: object = Reflect.construct(target as Function, args, newTarget)
        batchedInstances.add(toRaw(instance))
        return reactive(instance)
    },
}

/** Lazily proxy an object, array, or user class while preserving its public type. */
export function reactive<T extends object>(target: T): T
/** Create a decorator for the equivalent @reactive() syntax. */
export function reactive(): <T extends object>(target: T) => T
export function reactive(target?: object): object {
    // Only an omitted argument selects the factory; explicit undefined is still invalid.
    if (arguments.length === 0) return reactive
    if (!isObject(target)) throw new TypeError('reactive expects an object or a class')
    if (proxyToRaw.has(target) || isComputed(target)) return target
    const cached = rawToProxy.get(target)
    if (cached) return cached
    if (!canProxy(target)) return target
    const proxy = new Proxy(target, handlers)
    rawToProxy.set(target, proxy)
    proxyToRaw.set(proxy, target)
    return proxy
}
