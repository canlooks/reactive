import {Obj, ReactiveOptions} from '../..'
import {getMapValue, isMapOrSet} from '../utils'
import {Disposable} from './disposable'
import {Effect, Payload} from './effect'
import {TwoWay} from './twoWay'

interface ProxyableOptions<T extends object> extends Payload, ReactiveOptions {
    skipRenderPropNames?: Obj<boolean>
    triggerParent?(): void
    onGet?<V>(target: T, p: PropertyKey, oldValue: V): V
    onSet?(target: T, p: PropertyKey, newValue: any): boolean
    onHas?<H extends boolean>(target: T, p: PropertyKey, originHas: H): H
    onDefineProperty?(target: T, p: PropertyKey, attributes: PropertyDescriptor): boolean
    onDeleteProperty?(target: T, p: PropertyKey): boolean
}

// 原始对象与Proxyable类的映射
const target_proxyable = new WeakMap<object, Proxyable<object>>()
// 代理与原始对象的映射
const proxy_target = new WeakMap<object, object>()

// 会改变数组自身的方法
const changeArrayMethods: Obj<true> = {
    pop: true,
    shift: true,
    push: true,
    unshift: true,
    splice: true,
    fill: true,
    reverse: true,
    sort: true
}

// 会改变map或set自身的方法
const changeMapOrSetMethods: Obj<true> = {
    set: true,
    add: true,
    delete: true,
    clear: true
}

export class Proxyable<T extends object> extends Disposable {
    proxy: T

    constructor(public target: T, private options: ProxyableOptions<T> = {}) {
        super()
        this.proxy = new Proxy(
            target,
            Array.isArray(target)
                ? this.arrayHandler
                : isMapOrSet(target)
                    ? this.mapOrSetHandler
                    : this.objectHandler
        )
        target_proxyable.set(target, this)
        // 深度代理时，经过第一次代理的子属性已经是proxy，也要加入target_proxyable，避免重复代理
        target_proxyable.set(this.proxy, this)
        proxy_target.set(this.proxy, target)
    }

    /**
     * -----------------------------------------------------------------
     * 各类型拦截器
     */

    private objectHandler: ProxyHandler<T> = {
        get: (target, p) => {
            this.bindEffect(p)
            let value = Reflect.get(target, p)
            typeof value !== 'function' && this.linkTwoWay(p)
            if (p !== 'prototype') {
                value = this.proxyDeeper(p, value)
            }
            return this.options.onGet
                ? this.options.onGet(target, p, value)
                : value
        },
        set: (target, p, newValue) => {
            const oldValue = Reflect.get(target, p)
            let returnValue = Reflect.set(target, p, newValue)
            if (returnValue && oldValue !== newValue) {
                this.trigger(p)
                // 定义新属性时才触发父级
                !Reflect.has(target, p) && this.options.triggerParent?.()
                if (this.options.onSet) {
                    returnValue = this.options.onSet(target, p, newValue)
                }
            }
            return returnValue
        },
        defineProperty: (target, p, attributes) => {
            const returnValue = Reflect.defineProperty(target, p, attributes)
            this.trigger(p)
            !Reflect.has(target, p) && this.options.triggerParent?.()
            if (this.options.onDefineProperty && returnValue) {
                return this.options.onDefineProperty(target, p, attributes)
            }
            return returnValue
        },
        deleteProperty: (target, p) => {
            const returnValue = Reflect.deleteProperty(target, p)
            this.trigger(p)
            this.options.triggerParent?.()
            if (this.options.onDeleteProperty && returnValue) {
                return this.options.onDeleteProperty(target, p)
            }
            return returnValue
        },
        has: (target, p) => {
            this.bindEffect(p)
            const originHas = Reflect.has(target, p)
            return this.options.onHas
                ? this.options.onHas(target, p, originHas)
                : originHas
        }
    }

    private mapOrSetHandler: ProxyHandler<T> = {
        get: (target, p, receiver) => {
            const value = Reflect.get(target, p)
            if (p === 'get' || p === 'has') {
                return this.bindDeeper(target, value)
            }
            if (changeMapOrSetMethods[p]) {
                return this.triggerParent(target, value, 'size', true)
            }
            if (typeof value === 'function') {
                // value为函数时，只需绑定上下文，无需进入get拦截器
                return value.bind(target)
            }
            return this.objectHandler.get!(target, p, receiver)
        },
        set: this.objectHandler.set
    }

    private arrayHandler: ProxyHandler<T> = {
        get: (target, p, receiver) => {
            if (changeArrayMethods[p]) {
                const value = Reflect.get(target, p)
                return this.triggerParent(target, value, 'length')
            }
            if (p === 'at') {
                const value = Reflect.get(target, p)
                return this.bindDeeper(target, value)
            }
            return this.objectHandler.get!(target, p, receiver)
        },
        set: this.objectHandler.set
    }

    /**
     * -----------------------------------------------------------------
     * 绑定与触发副作用
     */

    private p_effectSet = new Map<PropertyKey, Set<Effect>>()

    /**
     * 绑定属性与effect
     * @param p
     */
    private bindEffect(p: PropertyKey) {
        const lastEffect = Effect.stacks[Effect.stacks.length - 1]
        if (!lastEffect) {
            return
        }
        const effectSet = getMapValue(this.p_effectSet, p, () => new Set())
        if (effectSet.has(lastEffect)) {
            return
        }
        effectSet.add(lastEffect)
        lastEffect.addDisposer(() => {
            effectSet.size > 1
                ? effectSet.delete(lastEffect)
                : this.p_effectSet.delete(p)
        })
    }

    /**
     * 深度代理
     * @param p
     * @param value
     */
    private proxyDeeper<V = any>(p: PropertyKey, value: V): V {
        if (!this.options.deep
            || typeof value !== 'object'
            || value === null
            || value instanceof Promise
        ) {
            return value
        }
        return target_proxyable.get(value)?.proxy ||
            new Proxyable<any>(value, {
                ...this.options,
                triggerParent: () => this.trigger(p)
            }).proxy
    }

    /**
     * 深度绑定属性，用于array.at(), map.get()等
     * @param target
     * @param method 原生方法
     */
    private bindDeeper(target: T, method: any) {
        return (...args: any[]) => {
            if (args.length) {
                // 将第一个参数作为属性名进行绑定
                const p = args[0].toString()
                this.bindEffect(p)
                const value = method.apply(target, args)
                return this.proxyDeeper(p, value)
            }
            return method.call(target)
        }
    }

    /**
     * 修改对象自身的方法会触发父级副作用，如length、size的变化
     * @param target
     * @param method
     * @param sizeProp 长度属性，如length、size
     * @param triggerFirstArg 触发第一个属性，用于，map.set()等
     */
    private triggerParent(target: T, method: any, sizeProp: 'size' | 'length', triggerFirstArg?: boolean) {
        return (...args: any[]) => {
            const prevSize = Reflect.get(target, sizeProp)
            const ret = method.apply(target, args)
            triggerFirstArg && args.length && this.trigger(args[0])
            this.options.triggerParent?.()
            const newSize = Reflect.get(target, sizeProp)
            newSize !== prevSize && this.trigger(sizeProp)
            return ret
        }
    }

    /**
     * 触发属性p的effect
     * @param p
     */
    trigger(p: PropertyKey) {
        const effectSet = this.p_effectSet.get(p)
        if (effectSet) {
            const {skipRenderPropNames, skipRender} = this.options
            const payload: Payload = {
                skipRender: typeof skipRender === 'boolean'
                    ? skipRender
                    : skipRenderPropNames?.[p],
                proxyable: this,
                p
            }
            for (const effect of effectSet) {
                effect.trigger(payload)
            }
        }
    }

    private linkTwoWay(p: PropertyKey) {
        TwoWay.stacks[TwoWay.stacks.length - 1]?.link(this.proxy, p)
    }
}

/**
 * 通过proxy获取原始对象
 * @param proxy
 */
export function getOriginalObject<T extends object>(proxy: T) {
    return proxy_target.get(proxy) || proxy
}