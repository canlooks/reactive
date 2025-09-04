import {Fn, ReactorOptions} from '../..'
import {defineAction, Effect} from '../core'
import {allocateTargets} from '../core/allocateTargets'

export function reactive<T extends object>(target: T): T
export function reactive(): <T extends object>(target: T) => T
export function reactive(a?: any) {
    return a
        ? allocateTargets(a)
        : (target: object) => allocateTargets(target)
}

reactive.deep = deep

function deep<T extends object>(target: T): T
function deep(): <T extends object>(target: T) => T
function deep(a?: any) {
    return a
        ? allocateTargets(a, {deep: true})
        : (target: object) => allocateTargets(target, {deep: true})
}

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