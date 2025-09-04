import {ReactiveOptions} from '../..'
import {isClass} from '../utils'
import {logPrefix} from '../utils/logHandler'
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
            // target is a class
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
    }
    if (typeof target === 'object' && target !== null) {
        const {proxy} = distributeProperties(new Proxyable(target, options))
        return proxy
    }
    throw TypeError(logPrefix + 'Invalid parameter at "reactive()"')
}