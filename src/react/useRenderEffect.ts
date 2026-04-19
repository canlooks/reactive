import {useRef, useSyncExternalStore} from 'react'
import {Effect} from '../core'
import {useExternalClass} from './hooks'

export function useRenderEffect<T>(render: () => T): T {
    const snapshot = useRef<symbol>(void 0)

    const storeChange = useRef<() => void>(void 0)

    const effect = useExternalClass(
        () => new Effect(({skipRender}) => {
            if (!skipRender) {
                snapshot.current = Symbol()
                storeChange.current?.()
            }
        }),
        effect => effect.dispose()
    )

    const getSnapshot = () => snapshot.current

    useSyncExternalStore(onStoreChange => {
        if (!effect.current) {
            // 订阅时无effect可能是<Activity>组件导致，需要更新snapshot使组件重新渲染，才能创建新的Effect
            snapshot.current = Symbol()
        }
        storeChange.current = onStoreChange

        return () => {
            storeChange.current = void 0
        }
    }, getSnapshot, getSnapshot)

    return effect.current.refer(render)
}