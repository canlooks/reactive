import { isComputed } from './computed.js'
import { trackObjectChanges } from './effect.js'
import { toRaw } from './reactive.js'

/** Storage deliberately supports data objects, not class instances or branded built-ins. */
export function isStorageRoot(value: unknown): value is object {
    if (value === null || typeof value !== 'object') return false
    const raw = toRaw(value)
    if (isComputed(raw)) return false
    const prototype = Reflect.getPrototypeOf(raw)
    return Array.isArray(raw) || prototype === null || prototype === Object.prototype
}

function isIndex(key: string): boolean {
    const index = Number(key)
    return Number.isInteger(index) && index >= 0 && index < 0xffff_ffff && String(index) === key
}

function dataEntries(target: object): [string, PropertyDescriptor][] {
    return Object.keys(target)
        .filter(key => !Array.isArray(target) || isIndex(key))
        .map(key => [key, Reflect.getOwnPropertyDescriptor(target, key)!] as [string, PropertyDescriptor])
        .filter(([, descriptor]) => 'value' in descriptor)
}

/** Finish collecting the whole graph before encoding can fail on any one branch. */
export function scanStorage(root: object): void {
    const seen = new Set<object>()
    const pending: object[] = [root]
    while (pending.length) {
        const raw = toRaw(pending.pop()!)
        if (seen.has(raw) || !isStorageRoot(raw)) continue
        seen.add(raw)
        trackObjectChanges(raw)
        for (const [, descriptor] of dataEntries(raw)) {
            if (descriptor.value !== null && typeof descriptor.value === 'object') pending.push(descriptor.value)
        }
    }
}

function assertKey(key: string): void {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new TypeError(`storage cannot persist the reserved key ${key}`)
    }
}

function container(target: object): object {
    if (!Array.isArray(target)) return Object.create(null) as object
    // Even an inherited toJSON must not execute while saving business state.
    const result: unknown[] = []
    Object.setPrototypeOf(result, null)
    result.length = target.length
    return result
}

function define(target: object, key: string, value: unknown): void {
    Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true })
}

/** Canonical JSON of data descriptors only; never evaluate getters or toJSON. */
export function encodeStorage(root: object): string {
    const ancestors = new Set<object>()
    const copies = new Map<object, object>()
    function project(input: unknown): unknown {
        const value = toRaw(input)
        if (typeof value === 'bigint') throw new TypeError('storage cannot persist BigInt')
        if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) return undefined
        if (value === null || typeof value !== 'object') return value
        if (!isStorageRoot(value)) throw new TypeError('storage expects plain data objects and arrays')
        if (ancestors.has(value)) throw new TypeError('storage cannot persist circular references')
        const cached = copies.get(value)
        if (cached) return cached
        const result = container(value)
        copies.set(value, result)
        ancestors.add(value)
        for (const [key, descriptor] of dataEntries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
            const next = project(descriptor.value)
            if (next === undefined) continue
            assertKey(key)
            define(result, key, next)
        }
        ancestors.delete(value)
        return result
    }
    return JSON.stringify(project(root))
}

export function decodeStorage(value: unknown, root: object): { data: object; snapshot: string } {
    if (typeof value !== 'string') throw new TypeError('storage getItem must return a string or null')
    const data: unknown = JSON.parse(value)
    if (!isStorageRoot(data) || Array.isArray(data) !== Array.isArray(root)) {
        throw new TypeError('storage record must have the same object/array root shape as its initial state')
    }
    return { data, snapshot: encodeStorage(data) }
}

function protectedField(descriptor: PropertyDescriptor): boolean {
    return !descriptor.enumerable || !('value' in descriptor) || typeof descriptor.value === 'function'
}

function checkWrite(root: object, key: string, value: unknown): boolean {
    const own = Reflect.getOwnPropertyDescriptor(root, key)
    if (own) {
        if (protectedField(own) && !(Array.isArray(root) && key === 'length')) return false
        if (Object.is(toRaw(own.value), toRaw(value))) return false
        if (!own.writable) throw new TypeError(`storage cannot restore readonly property ${key}`)
    } else {
        if (!Object.isExtensible(root)) throw new TypeError('storage cannot restore a non-extensible object')
        let prototype: object | null = root
        while ((prototype = Reflect.getPrototypeOf(prototype))) {
            const inherited = Reflect.getOwnPropertyDescriptor(prototype, key)
            if (!inherited) continue
            if (!('value' in inherited) || !inherited.writable) {
                throw new TypeError(`storage cannot restore inherited readonly/accessor property ${key}`)
            }
            break
        }
    }
    return true
}

/** Prepare the complete patch before touching state; the caller applies it in one batch. */
export function prepareStorageRestore(root: object, data: object): { snapshot: string; apply(state: object): void } {
    const expected = container(root)
    for (const [key, descriptor] of dataEntries(root)) define(expected, key, descriptor.value)
    const writes: [string, unknown][] = []
    for (const [key, descriptor] of dataEntries(data)) {
        if (!checkWrite(root, key, descriptor.value)) continue
        writes.push([key, descriptor.value])
        define(expected, key, descriptor.value)
    }
    if (Array.isArray(root) && Array.isArray(data)) {
        if (data.length < root.length) {
            for (const key of Object.getOwnPropertyNames(root)) {
                if (!isIndex(key) || Number(key) < data.length) continue
                const descriptor = Reflect.getOwnPropertyDescriptor(root, key)!
                if (!descriptor.configurable || protectedField(descriptor)) {
                    throw new TypeError(`storage cannot truncate protected array index ${key}`)
                }
            }
        }
        if (checkWrite(root, 'length', data.length)) writes.push(['length', data.length])
        Reflect.set(expected, 'length', data.length)
        // Filling a hole past a fixed length would fail even if the index itself is writable.
        if (!Reflect.getOwnPropertyDescriptor(root, 'length')!.writable && data.length > root.length) {
            throw new TypeError('storage cannot extend a readonly array length')
        }
    }
    const snapshot = encodeStorage(expected)
    return {
        snapshot,
        apply(state) {
            for (const [key, value] of writes) {
                if (!Reflect.set(state, key, value)) throw new TypeError(`storage could not restore ${key}`)
            }
        },
    }
}
