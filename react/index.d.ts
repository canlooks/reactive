import React, {ComponentClass, ComponentType, FC, ReactElement, ReactNode} from 'react'
import {Autoload, Fn, ReactiveOptions, ReactiveOverload, ReactorOptions} from '..'

declare namespace ReactiveForReact {
    /**
     * ----------------------------------------------------------------------
     * auto allocate
     */

    const reactiveComponent: ReactiveOverload & {
        deep: ReactiveOverload
    }

    // alias for reactiveComponent
    const RC: typeof reactiveComponent

    /**
     * ----------------------------------------------------------------------
     * manual determinate
     */

    function reactiveFC<T extends FC>(target: T): T

    type ReactiveClass = <T extends ComponentClass>(target: T) => T

    const reactiveClass: ReactiveClass & {
        deep: ReactiveClass
    }

    /**
     * ----------------------------------------------------------------------
     * hooks
     */

    function useReactive<T extends object>(initialValue: () => T, options?: ReactiveOptions): T
    function useReactive<T extends object>(initialValue: T, options?: ReactiveOptions): T

    function useAutorun(fn: () => void): void

    function useReactor<T>(refer: () => T, effect: (newValue: T, oldValue?: T) => void, options?: ReactorOptions): void

    function useAction<F extends Fn>(fn: F): F

    function useExternalReactive<T>(refer: () => T): T

    /**
     * ----------------------------------------------------------------------
     * extensions - Chip
     */

    // chip component

    type ChipProps = {children(): ReactNode}

    const Chip: {
        (props: ChipProps): ReactElement
        Strict: typeof StrictChip
    }

    function StrictChip(props: ChipProps): ReactElement

    // chip function

    function chip(render: () => ReactNode): ReactElement
    function strictChip(render: () => ReactNode): ReactElement

    /**
     * ----------------------------------------------------------------------
     * extensions - Modal
     */

    type PostValue = (...args: any[]) => any

    type DefinedModelProps<P> = Omit<P, 'refer'> & { refer(): any }

    function defineModel<P = {}>(Component: ComponentType<P>, postValue?: PostValue): ComponentType<DefinedModelProps<P>>

    type ModelProps = {
        refer(): any
        postValue?: PostValue
        children: ReactElement
    }

    function Model(props: ModelProps): ReactElement

    type UseModelReturn<V> = {
        value: V,
        onChange(value: V | ((currentValue: V) => V) | React.ChangeEvent): void
    }

    function useModel<V = undefined>(initialValue?: void, options?: ReactiveOptions): UseModelReturn<V | undefined>
    function useModel<V>(initialValue: V | (() => V), options?: ReactiveOptions): UseModelReturn<V>

    /**
     * ----------------------------------------------------------------------
     * extensions - loading & autoload
     */

    function useLoading<F extends Fn = Fn, L extends boolean | number = boolean>(fn: F, initialLoading?: L): {
        load: F
        loading: L
        stacks: number
    }

    function useAutoload<D = any, A = any>(loadData: (...args: A[]) => D | Promise<D>, options?: ReactiveOptions): Autoload<D, A>
}

export = ReactiveForReact