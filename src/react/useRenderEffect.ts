import {useEffect, useState, useSyncExternalStore} from 'react'
import {Effect} from '../core'
import {Fn} from '../../index'

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

/**
 * 一个强制更新组件的方法
 */
function useUpdate() {
    useSyncExternalStore(ExternalStore.subscribe, ExternalStore.getSnapshot)

    return ExternalStore.update
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