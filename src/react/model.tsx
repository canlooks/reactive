import React, {cloneElement, ComponentProps, ComponentType, useCallback, useEffect, useState} from 'react'
import {ReactiveOptions} from '../..'
import {DefinedModelProps, ModelProps, UseModelReturn} from '../../react'
import {useRenderEffect} from './useRenderEffect'
import {Proxyable, TwoWay} from '../core'
import {getValueOnChange} from '../utils'
import {useSync} from './hooks'

export function defineModel<P = {}>(Component: ComponentType<P>, postValue?: (...args: any[]) => any): ComponentType<DefinedModelProps<P>> {
    return {
        [Component.name]({refer, ...props}: DefinedModelProps<P>) {
            return (
                <Model refer={refer} postValue={postValue}>
                    <Component {...props as any}/>
                </Model>
            )
        }
    }[Component.name]
}

export const Model = (props: ModelProps) => {
    const twoWay = useState(() => new TwoWay())[0]

    const syncPostValue = useSync(props.postValue)

    return useRenderEffect(() => {
        twoWay.refer(props.refer)
        const value = twoWay.getValue()
        const childProps: ComponentProps<'input'> = typeof value === 'boolean'
            ? {checked: value}
            : {value}

        childProps.onChange = useCallback((...args: React.ChangeEvent<any>[]) => {
            (props.children.props as any).onChange?.(...args)
            if (!twoWay.isBound) {
                return
            }
            const newValue = syncPostValue.current
                ? twoWay.setValue(syncPostValue.current(...args))
                : getValueOnChange(args[0], value)
            twoWay.setValue(newValue)
        }, [(props.children.props as any).onChange])

        return cloneElement(props.children, childProps)
    })
}

export function useModel<V>(initialValue?: V | (() => V), options?: ReactiveOptions): UseModelReturn<V> {
    const proxyable = useState(() => {
        const target: UseModelReturn<V> = {
            value: typeof initialValue === 'function' ? (initialValue as Function)() : initialValue,
            onChange(e) {
                if (typeof e === 'function') {
                    this.value = (e as Function)(this.value)
                    return
                }
                this.value = getValueOnChange(e, this.value)
            }
        }
        return new Proxyable(target, options)
    })[0]

    useEffect(() => () => {
        proxyable!.dispose()
    }, [])

    return proxyable.proxy
}