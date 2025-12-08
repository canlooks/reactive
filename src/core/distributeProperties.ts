import {getAllPropertyDescriptors, isMapOrSet} from '../utils'
import {defineAction} from './defineAction'
import {Getter} from './defineGetter'
import {prototype_ignoreProperties} from './ignore'
import {Proxyable} from './proxy'

/**
 * 分配对象的所有属性，绑定this，并实现getter与action
 * @param proxyable
 * @param prototype 若分配类实例的属性，可传入类原型用于应用ignore修饰器
 */
export function distributeProperties<T extends Proxyable<any>>(proxyable: T, prototype?: Object): T {
    if (isMapOrSet(proxyable.target)) {
        return proxyable
    }

    const ignoreProperties = prototype && prototype_ignoreProperties.get(prototype)
    const {proxy} = proxyable
    const descriptors = getAllPropertyDescriptors(proxy)

    for (const p in descriptors) {
        if (ignoreProperties?.has(p)) {
            continue
        }

        const descriptor = descriptors[p]
        const {get, value} = descriptor

        if (get) {
            descriptor.get = new Getter(proxyable, p).defineGetter(get)
            descriptor.set = descriptor.set?.bind(proxy)
            Object.defineProperty(proxy, p, descriptor)
        } else if (typeof value === 'function') {
            descriptor.value = defineAction(value, proxy, p)
            Object.defineProperty(proxy, p, descriptor)
        }
    }

    return proxyable
}