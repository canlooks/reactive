import {RefObject, useEffect, useRef, useState} from 'react'

/**
 * 组件卸载后得到{current: true}
 */
export function useUnmounted() {
    const isUnmounted = useRef(false)

    useExternalClass(() => void 0, () => {
        isUnmounted.current = true
    })

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

/**
 * 使用外部类，该方法可避免`StrictMode`下，React渲染行为与外部类实例生命周期不同步的问题
 */
export function useExternalClass<T>(setup: () => T, cleanup?: (instance: T) => void): T {
    const mountTimes = useRef(0)
    const prevInstance = useRef<T>(void 0)

    const [instance] = useState(() => {
        if (!mountTimes.current++) {
            prevInstance.current = setup()
        }
        return prevInstance.current as T
    })

    useEffect(() => () => {
        !--mountTimes.current && cleanup?.(instance)
    }, [])

    return instance
}