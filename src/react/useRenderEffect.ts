import {useEffect, useState, useSyncExternalStore} from 'react'
import {Effect} from '../core'

class ExternalStore {
    private onStoreChange?: () => void

    subscribe = (onStoreChange: () => void) => {
        this.onStoreChange = onStoreChange
        return () => {
        }
    }

    private snapshot = Symbol()

    getSnapshot = () => {
        return this.snapshot
    }

    update = () => {
        if (this.onStoreChange) {
            this.snapshot = Symbol()
            this.onStoreChange()
        }
    }
}

/**
 * 一个强制更新组件的方法
 */
function useUpdate() {
    const [externalStore] = useState(() => new ExternalStore())

    useSyncExternalStore(externalStore.subscribe, externalStore.getSnapshot)

    return externalStore.update
}

/**
 * 用于渲染的副作用
 * @param render
 */
export function useRenderEffect<T>(render: () => T) {
    const update = useUpdate()

    const [effect] = useState(() => {
        return new Effect(({skipRender}) => {
            if (!skipRender) {
                update()
            }
        })
    })

    useEffect(() => () => {
        effect!.dispose()
    }, [])

    return effect.refer(render)
}