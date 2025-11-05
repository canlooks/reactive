import {FC, forwardRef, memo, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Effect, Proxyable} from '../core'
import {assignProps} from '../utils'
import {logPrefix} from '../utils/logHandler'

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

/**
 * 用于触发渲染副作用
 * @param render
 * @param force 若为true，则会绕过skipRender，强制刷新
 */
export function useRenderEffect<T>(render: () => T, force?: boolean) {
    const update = useUpdate()

    const effect = useMemo(() => {
        return new Effect(({skipRender}) => {
            // force与skipRender同时为true，表示props属性改变触发的chip更新，会导致react报错
            force && skipRender && console.error(logPrefix + 'Don\'t wrap "props" in <Chip.Strict>, use <Chip> instead.')
            if (force || !skipRender) {
                update()
            }
        })
    }, [])

    useEffect(() => () => {
        effect!.dispose()
    }, [])

    return effect.refer(render)
}

/**
 * 得到一个可以刷新组件的方法
 */
function useUpdate() {
    const mounted = useRef(false)

    useLayoutEffect(() => {
        mounted.current = true
    }, [])

    const [, setState] = useState<symbol>()
    return () => mounted.current && setState(Symbol())
}