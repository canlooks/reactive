import {getMapValue} from '../utils'
import {Proxyable} from './proxy'

type RegisteredFn = (proxyable: Proxyable<any>) => any

const prototype_registeredFns = new WeakMap<object, RegisteredFn[]>()

export function registerDecorator(prototype: Object, callback: RegisteredFn) {
    getMapValue(prototype_registeredFns, prototype, () => []).push(callback)
}

export function implementDecorator(prototype: Object, proxyable: Proxyable<any>) {
    return prototype_registeredFns.get(prototype)?.map(fn => fn(proxyable))
}