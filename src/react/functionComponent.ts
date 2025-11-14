import {FC, forwardRef, memo, useRef} from 'react'
import {Proxyable} from '../core'
import {assignProps} from '../utils'
import {useRenderEffect} from './useRenderEffect'

export function createReactFunctionComponent<P extends object>(target: FC<P>, isForwardedRef?: boolean) {
    const namedComponent = {
        [target.name](props: P, ref: any) {
            const proxyProps = useRef<P>(void 0)

            proxyProps.current ||= new Proxyable({} as P, {
                skipRender: true
            }).proxy

            assignProps(proxyProps.current!, props)

            // @ts-ignore `ref` argument is compatible for React 18.
            return useRenderEffect(() => target(proxyProps.current!, ref))
        }
    }[target.name]

    return memo(
        isForwardedRef
            ? forwardRef<any, any>(namedComponent as any)
            : namedComponent as any
    )
}