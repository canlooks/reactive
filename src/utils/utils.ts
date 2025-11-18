import {ClassType, Fn} from '../..'

export function isClass(fn: Function | ClassType): fn is ClassType {
    if (fn.prototype?.constructor !== fn) {
        return false
    }
    return Function.prototype.toString.call(fn).startsWith('class')
}

/**
 * 判断变量是否是Map或Set
 * @param target
 */
export function isMapOrSet(target: any): target is Map<any, any> | Set<any> | WeakMap<any, any> | WeakSet<any> {
    return target instanceof Map || target instanceof Set || target instanceof WeakMap || target instanceof WeakSet
}

/**
 * 得到所有属性的描述符，包括被继承的父类
 * @param o
 */
export function getAllPropertyDescriptors(o: any): {[p: PropertyKey]: PropertyDescriptor} {
    const {constructor, ...desc} = Object.getOwnPropertyDescriptors(o)
    const prototype = Object.getPrototypeOf(o)
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== Function.prototype) {
        return {
            ...getAllPropertyDescriptors(prototype),
            ...desc
        }
    }
    return desc
}

/**
 * 获取Map的值，找不到时赋上默认值
 */
export function getMapValue<K, V>(data: Map<K, V>, key: K): V | undefined
export function getMapValue<K, V>(data: Map<K, V>, key: K, defaultValue: () => V): V
export function getMapValue<K extends object, V>(data: WeakMap<K, V>, key: K): V | undefined
export function getMapValue<K extends object, V>(data: WeakMap<K, V>, key: K, defaultValue: () => V): V
export function getMapValue(data: any, key: any, defaultValue?: () => any) {
    if (data.has(key)) {
        return data.get(key)
    }
    if (defaultValue) {
        const value = defaultValue()
        data.set(key, value)
        return value
    }
}

/**
 * 合并react组件的props，主要用于删除没有的属性
 * @param oldProps
 * @param newProps
 */
export function assignProps<P extends {}>(oldProps: P, newProps: P) {
    for (const p in oldProps) {
        if (!(p in newProps)) {
            delete oldProps[p]
        }
    }
    Object.assign(oldProps, newProps)
}

/**
 * 判断变量是否为Promise
 * @param it
 */
export function isPromise<T>(it: any): it is Promise<T> {
    return it instanceof Promise || typeof it?.then === 'function'
}

/**
 * 获取promise的状态
 * @param promise
 */
export function getPromiseState(promise: Promise<any>): Promise<'pending' | 'fulfilled' | 'rejected'>
export function getPromiseState(promise: Promise<any>) {
    const s = Symbol()
    return Promise.race([promise, s]).then(res => {
        return res === s ? 'pending' : 'fulfilled'
    }).catch(() => 'rejected')
}

/**
 * 从onChange回调中获取值
 * @param e
 * @param prevValue 传入当前的值作为参考
 */
export function getValueOnChange(e: any, prevValue?: any) {
    if (typeof e === 'object' && e !== null && typeof e.target === 'object' && e.target !== null) {
        return typeof prevValue === 'boolean' ? e.target.checked : e.target.value
    }
    return e
}

/**
 * 下一个事件循环
 * @param callback
 * @param args
 * @returns
 */
export function nextTick<T>(callback?: (...args: T[]) => void, ...args: T[]): Promise<T> {
    return new Promise(resolve => {
        if (typeof queueMicrotask === 'function') {
            return queueMicrotask(settle)
        }
        if (typeof process === 'object' && process !== null && process.nextTick) {
            return process.nextTick(settle, ...args)
        }
        setTimeout(settle, 0, ...args)

        function settle(...a: any[]) {
            callback?.(...a)
            resolve(a[0])
        }
    })
}

/**
 * 防抖
 * @param fn
 * @param ms
 */
export function debounce<F extends Fn>(fn: F, ms: number): (...args: Parameters<F>) => void {
    let timeout: any
    return function (this: any, ...args: Parameters<F>) {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
            fn.apply(this, args)
        }, ms)
    }
}