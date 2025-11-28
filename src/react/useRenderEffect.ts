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

    useSyncExternalStore(onStoreChange => {
        storeChange.current = onStoreChange
        return () => {
            storeChange.current = void 0
        }
    }, () => snapshot.current, () => snapshot.current)

    return effect.refer(render)
}