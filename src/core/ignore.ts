import {getMapValue} from '../utils'

export const prototype_ignoreProperties = new WeakMap<object, Set<PropertyKey>>()

/**
 * 属性修饰器，被修饰的属性会忽略"distribute"方法的分配
 */
export function ignore(target: Object, propertyKey: PropertyKey): void
export function ignore(): (target: Object, propertyKey: PropertyKey) => void
export function ignore(a?: Object, b?: PropertyKey) {
    const fn = (prototype: Object, propertyKey: PropertyKey) => {
        getMapValue(prototype_ignoreProperties, prototype, () => new Set()).add(propertyKey)
    }
    return b ? fn(a!, b) : fn
}