import {Fn, ReactiveOptions, ReactorOptions} from '../..'
import {defineAction, Effect} from '../core'
import {allocateTargets, targetIsClass, targetIsObject} from '../core/allocateTargets'

export function reactive(a?: any, options?: ReactiveOptions) {
    return a
        ? allocateTargets(a, options)
        : (target: any) => allocateTargets(target, options)
}

export function reactiveClass(a?: any, options?: ReactiveOptions) {
    return a
        ? targetIsClass(a, options)
        : (target: any) => targetIsClass(target, options)
}

export function reactiveObject(target: any, options?: ReactiveOptions) {
    return targetIsObject(target, options)
}

reactive.deep = (a?: any) => reactive(a, {deep: true})
reactiveClass.deep = (a?: any) => reactiveClass(a, {deep: true})
reactiveObject.deep = (a?: any) => reactiveObject(a, {deep: true})

export function reactor<T>(refer: () => T, effect: (newValue: T, oldValue?: T) => void, options?: ReactorOptions) {
    let calledOnce = false
    let newValue: T
    let oldValue: T | undefined
    const callback = () => {
        newValue = effectInstance.refer(refer)
        if (newValue !== oldValue || !calledOnce) {
            effect(newValue, oldValue)
            options?.once && effectInstance.dispose()
            calledOnce = true
            oldValue = newValue
        }
    }
    const effectInstance = new Effect(callback)
    options?.immediate
        ? callback()
        : oldValue = effectInstance.refer(refer)
    return () => effectInstance.dispose()
}

export function autorun(fn: Fn) {
    const effectInstance = new Effect(fn)
    effectInstance.refer(fn)
    return () => effectInstance.dispose()
}

export function action<T extends Fn>(fn: T): T {
    return defineAction(fn)
}

export function act<R>(fn: () => R): R {
    return defineAction(fn)()
}