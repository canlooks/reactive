import {RefObject, useEffect, useRef} from 'react'

/**
 * 组件卸载后得到{current: true}
 */
export function useUnmounted() {
    const isUnmounted = useRef(false)

    useEffect(() => () => {
        isUnmounted.current = true
    }, [])

    return isUnmounted
}

/**
 * 将某个值同步进ref
 */
export function useSync<T>(value: T): RefObject<T> {
    const sync = useRef<T>(value)
    sync.current = value
    return sync
}