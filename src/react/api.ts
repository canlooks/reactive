import {useEffect, useCallback, FC, ComponentClass} from 'react'
import {ReactiveOptions, ReactorOptions, Fn} from '../..'
import {allocateReact} from './allocateReact'
import {createReactFunctionComponent} from './functionComponent'
import {defineAction} from '../core'
import {createReactClassComponent} from './classComponent'
import {autorun, reactor} from '../api'
import {allocateTargets} from '../core/allocateTargets'
import {useRenderEffect} from './useRenderEffect'
import {useSettledValue} from './hooks'

export function reactiveComponent<T extends object>(target: T): T
export function reactiveComponent(): <T extends object>(target: T) => T
export function reactiveComponent(a?: any) {
    return a
        ? allocateReact(a)
        : (target: object) => allocateReact(target)
}

reactiveComponent.deep = deep

function deep<T extends object>(target: T): T
function deep(): <T extends object>(target: T) => T
function deep(a?: any) {
    return a
        ? allocateReact(a, {deep: true})
        : (target: object) => allocateReact(target, {deep: true})
}

// alias for reactiveComponent
export const RC = reactiveComponent

export function reactiveFC(target: FC) {
    return createReactFunctionComponent(target)
}

export function reactiveClassComponent(target: ComponentClass) {
    return createReactClassComponent(target)
}

reactiveClassComponent.deep = (target: ComponentClass) => createReactClassComponent(target, {deep: true})

/**
 * --------------------------------------------------------------------
 * hooks
 */

export function useReactive<T extends object>(initialValue: () => T, options?: ReactiveOptions): T
export function useReactive<T extends object>(initialValue: T, options?: ReactiveOptions): T
export function useReactive(initialValue: any, options?: ReactiveOptions) {
    return useSettledValue(() => {
        const target = typeof initialValue === 'function' ? initialValue() : initialValue
        return allocateTargets(target, options)
    })
}

export function useAutorun(fn: () => void) {
    useEffect(() => {
        return autorun(fn)
    }, [])
}

export function useReactor<T>(refer: () => T, effect: (newValue: T, oldValue?: T) => void, options?: ReactorOptions) {
    useEffect(() => {
        return reactor(refer, effect, options)
    }, [])
}

export function useAction<T extends Fn>(fn: T): T {
    return useCallback(defineAction(fn), [])
}

/**
 * 將响应式数据嵌入非响应组件
 * @param refer 
 */
export function useExternalReactive<T>(refer: () => T): T {
    return useRenderEffect(refer)
}