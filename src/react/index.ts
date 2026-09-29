export { ReactiveFunctionComponent, ReactiveFunctionComponent as RFC } from './functionComponent.js'
export { useReactive, useWatch } from './hooks.js'
export type { WatchOptions } from '../watch.js'
export { Chip, AsyncChip, chip, strictChip, asyncChip, asyncStrictChip } from './chip.js'
export type { ChipProps, AsyncChipProps } from './chip.js'
export { useModel, Model, defineModel } from './model.js'
export type { ModelEvent, UseModelReturn, ModelProps, ModelValue, ModelChangeArgs, DefinedModelProps } from './model.js'
export { useLoading } from './loading.js'
export type { UseLoadingReturn } from './loading.js'
import type { ComponentClass, FunctionComponent, NamedExoticComponent } from 'react'
import { ReactiveFunctionComponent } from './functionComponent.js'
import { ReactiveClassComponent } from './classComponent.js'

export function ReactiveComponent<C extends ComponentClass<any>>(component: C): C
export function ReactiveComponent<P extends object>(component: FunctionComponent<P>): NamedExoticComponent<P>
export function ReactiveComponent(component: ComponentClass<any> | FunctionComponent<any>): ComponentClass<any> | NamedExoticComponent<any> {
    return typeof component === 'function' && component.prototype?.isReactComponent
        ? ReactiveClassComponent(component as ComponentClass<any>)
        : ReactiveFunctionComponent(component as FunctionComponent<any>)
}

export { ReactiveComponent as RC }
export { ReactiveClassComponent, ReactiveClassComponent as RCC } from './classComponent.js'
