import {ClassType, ReactiveOptions} from '../..'
import {isClass} from '../utils'
import {logPrefix} from '../utils'
import {implementDecorator} from './decoratorHelper'
import {distributeProperties} from './distributeProperties'
import {Proxyable} from './proxy'

/**
 * 判断target的类型，分配入口
 * @param target 
 * @param options 
 */
export function allocateTargets(target: any, options?: ReactiveOptions) {
    if (typeof target === 'function') {
        if (isClass(target)) {
            return targetIsClass(target)
        }
        throw TypeError(logPrefix + '"function" cannot pass in "reactive()". if it is "class", use "reactiveClass()" instead.')
    }
    if (typeof target === 'object' && target !== null) {
        return targetIsObject(target, options)
    }
    throw TypeError(logPrefix + 'Invalid parameter of "reactive()"')
}

export function targetIsClass<T extends ClassType>(target: T, options?: ReactiveOptions): T {
    const {proxy: ProxyClass} = distributeProperties(new Proxyable(target, options))
    return {
        [target.name]: class extends ProxyClass {
            constructor(...args: any[]) {
                super(...args)
                const proxyable = distributeProperties(new Proxyable(this, options), ProxyClass.prototype)
                implementDecorator(ProxyClass.prototype, proxyable)
                return proxyable.proxy
            }
        }
    }[target.name]
}

export function targetIsObject<T extends object>(target: T, options?: ReactiveOptions): T {
    return distributeProperties(new Proxyable(target, options)).proxy
}