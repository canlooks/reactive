import {FC, forwardRef, memo, useEffect, useMemo, useRef, useSyncExternalStore} from 'react'
import {Effect, Proxyable} from '../core'
import {assignProps} from '../utils'
import {Fn} from '../../index'

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
 * 渲染副作用
 * @param render
 */
export function useRenderEffect<T>(render: () => T) {
    const update = useUpdate()

    const effect = useMemo(() => {
        return new Effect(({skipRender}) => {
            if (!skipRender) {
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
 * 获得一个强制更新组件的方法
 */
function useUpdate() {
    useSyncExternalStore(ExternalStore.subscribe, ExternalStore.getSnapshot)

    return ExternalStore.update
}

class ExternalStore {
    static listeners = new Set<Fn>()

    static subscribe(listener: Fn) {
        ExternalStore.listeners.add(listener)
        return () => {
            ExternalStore.listeners.delete(listener)
        }
    }

    static snapshot = Symbol()

    static getSnapshot() {
        return ExternalStore.snapshot
    }

    static update() {
        ExternalStore.snapshot = Symbol()
        for (const listener of ExternalStore.listeners) {
            listener()
        }
    }
}